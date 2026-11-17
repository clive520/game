import { createMoveEngine, applyMoveToPieces, nextLivingFaction } from "./game/move-engine.js";
import { chooseComputerMove } from "./game/computer-player.js";
import { shouldComputerAcceptDraw } from "./game/draw-vote.js";
import { callServer, initializeFirebaseClient, loadMatchEvents, loadPublicMatches, monitorRoomPresence, subscribeRoom } from "./firebase-client.js";

const FACTION_ORDER = ["SH", "WU", "WE"];
const FACTIONS = {
  SH: { name: "蜀・紅", short: "蜀", color: "red", fill: "#b64335" },
  WU: { name: "吳・藍", short: "吳", color: "blue", fill: "#397ca2" },
  WE: { name: "魏・金", short: "魏", color: "gold", fill: "#b48634" },
};
const GLYPHS = {
  general: { SH: "帥", WU: "將", WE: "將" },
  rook: "車",
  horse: "馬",
  elephant: "象",
  advisor: "士",
  cannon: "炮",
  pawn: "兵",
};
const PIECE_NAMES = {
  general: "主帥",
  rook: "車",
  horse: "馬",
  elephant: "象",
  advisor: "士",
  cannon: "炮",
  pawn: "兵",
};

const svg = document.querySelector("#board");
const boardArt = document.querySelector("#board-art");
const moveHints = document.querySelector("#move-hints");
const nodeLayer = document.querySelector("#node-layer");
const pieceLayer = document.querySelector("#piece-layer");
const turnPill = document.querySelector("#turn-pill");
const seatList = document.querySelector("#seat-list");
const actionMessage = document.querySelector("#action-message");
const selectedPiecePanel = document.querySelector("#selected-piece");
const moveLog = document.querySelector("#move-log");
const moveCount = document.querySelector("#move-count");
const turnNumber = document.querySelector("#turn-number");
const gameModeSelect = document.querySelector("#game-mode");
const firebaseStatus = document.querySelector("#firebase-status");
const roomMessage = document.querySelector("#room-message");
const roomCredentials = document.querySelector("#room-credentials");
const roomCodeInput = document.querySelector("#room-code");
const roomPinInput = document.querySelector("#room-pin");
const displayNameInput = document.querySelector("#display-name");
const createRoomButton = document.querySelector("#create-room-button");
const joinRoomButton = document.querySelector("#join-room-button");
const leaveRoomButton = document.querySelector("#leave-room-button");
const connectionLabel = document.querySelector("#connection-label");
const historyScope = document.querySelector("#history-scope");
const storageNote = document.querySelector("#storage-note");
const loadMatchesButton = document.querySelector("#load-matches-button");
const matchList = document.querySelector("#match-list");
const replayControls = document.querySelector("#replay-controls");
const replayCaption = document.querySelector("#replay-caption");
const proposeDrawButton = document.querySelector("#propose-draw-button");
const drawVoteBox = document.querySelector("#draw-vote-box");
const drawVoteMessage = document.querySelector("#draw-vote-message");
const acceptDrawButton = document.querySelector("#accept-draw-button");
const rejectDrawButton = document.querySelector("#reject-draw-button");
const COMPUTER_DELAY_MS = 520;

let topology;
let startingPosition;
let engine;
let state;
let selectedPieceId = null;
let selectedMoves = [];
let computerTimer = null;
let boardRotation = 0;
let boardZoom = 1;
let firebaseReady = null;
let onlineRoomId = null;
let onlineSeat = null;
let onlineRoom = null;
let unsubscribeRoom = null;
let stopRoomPresence = null;
let onlineMovePending = false;
let drawActionPending = false;
let replayFrames = [];
let replayIndex = 0;
let replayMatch = null;
let stateBeforeReplay = null;

function humanFactionsForMode(mode) {
  if (mode === "one-human") return ["SH"];
  if (mode === "two-humans") return ["SH", "WU"];
  return [...FACTION_ORDER];
}

function isHumanFaction(faction) {
  if (onlineRoomId) return onlineSeat?.role === "player" && onlineSeat.faction === faction;
  return Boolean(state?.humanFactions.includes(faction));
}

function element(tag, attributes = {}, text = null) {
  const node = document.createElementNS("http://www.w3.org/2000/svg", tag);
  for (const [key, value] of Object.entries(attributes)) node.setAttribute(key, String(value));
  if (text !== null) node.textContent = text;
  return node;
}

function factionOfNode(nodeId) {
  return topology.nodesById.get(nodeId)?.faction ?? null;
}

function addPolygon(points, className, fill) {
  boardArt.append(element("polygon", { points, class: className, fill }));
}

function drawBoard() {
  boardArt.replaceChildren();
  nodeLayer.replaceChildren();

  addPolygon("282,50 675,50 872,390 675,730 282,730 85,390", "board-base", "url(#boardSurface)");
  addPolygon("282,50 478.5,50 478.5,390 183.5,560 85,390", "sector-wash", "#b48634");
  addPolygon("478.5,50 675,50 872,390 773.5,560 478.5,390", "sector-wash", "#397ca2");
  addPolygon("282,730 675,730 773.5,560 478.5,390 183.5,560", "sector-wash", "#b64335");

  for (const d of [
    "M478.5 390 L478.5 50",
    "M478.5 390 L773.5 560",
    "M478.5 390 L183.5 560",
  ]) {
    boardArt.append(element("path", { d, class: "river-band" }));
    boardArt.append(element("path", { d, class: "river-edge" }));
  }

  const kindClass = {
    "local-file": "edge-local-file",
    "local-rank": "edge-local-rank",
    "palace-diagonal": "edge-palace-diagonal",
    "outer-boundary": "edge-outer-boundary",
    "river-shoreline": "edge-river-shoreline",
    "central-link": "edge-highlight",
    "river-crossing": "edge-highlight",
    "river-continuation": "edge-highlight",
    "outer-connector": "edge-highlight",
  };
  const renderEdges = [...topology.edges].sort((a, b) => {
    const aHighlight = ["central-link", "river-crossing", "river-continuation", "outer-connector"].includes(a.kind);
    const bHighlight = ["central-link", "river-crossing", "river-continuation", "outer-connector"].includes(b.kind);
    return Number(aHighlight) - Number(bHighlight);
  });
  for (const edge of renderEdges) {
    const from = topology.nodesById.get(edge.from);
    const to = topology.nodesById.get(edge.to);
    if (!from || !to || !kindClass[edge.kind]) continue;
    boardArt.append(element("line", {
      x1: from.x, y1: from.y, x2: to.x, y2: to.y,
      class: kindClass[edge.kind],
      "data-edge-kind": edge.kind,
    }));
  }

  boardArt.append(element("polygon", {
    points: "282,50 675,50 872,390 675,730 282,730 85,390",
    class: "board-inner-rim",
  }));
  boardArt.append(element("text", { x: 170, y: 366, class: "sector-label", fill: FACTIONS.WE.fill }, "魏・金"));
  boardArt.append(element("text", { x: 790, y: 366, class: "sector-label", fill: FACTIONS.WU.fill }, "吳・藍"));
  boardArt.append(element("text", { x: 478.5, y: 701, class: "sector-label", fill: FACTIONS.SH.fill }, "蜀・紅"));
  boardArt.append(element("text", { x: 478.5, y: 281, class: "river-label", "text-anchor": "middle" }, "楚河・漢界"));

  for (const node of topology.nodes) {
    const circle = element("circle", {
      cx: node.x,
      cy: node.y,
      r: node.highlight ? 5.1 : 3.5,
      class: `play-node ${node.highlight ? "highlight-node" : ""}`,
      "data-node-id": node.id,
      tabindex: "0",
      role: "button",
      "aria-label": `棋位 ${node.id}`,
    });
    nodeLayer.append(circle);
  }
}

function glyphFor(piece) {
  const label = GLYPHS[piece.type];
  return typeof label === "object" ? label[piece.faction] : label;
}

function pieceShape(piece, node) {
  const group = element("g", {
    transform: `translate(${node.x} ${node.y})`,
    class: `piece-group piece-${FACTIONS[piece.faction].color} ${piece.faction === state.currentFaction && !state.gameOver ? "active-piece" : ""}`,
    "data-node-id": piece.nodeId,
    "data-piece-id": piece.id,
    tabindex: "0",
    role: "button",
    "aria-label": `${FACTIONS[piece.faction].name}${PIECE_NAMES[piece.type]}`,
  });
  if (piece.id === selectedPieceId) group.classList.add("active-piece");
  group.append(element("ellipse", { cx: 1, cy: 4, rx: 17, ry: 5.3, class: "piece-shadow" }));
  group.append(element("path", { d: "M-14 -8 Q0 -1 14 -8 L12 1 Q0 7 -12 1 Z", class: "piece-base-side" }));
  group.append(element("ellipse", { cx: 0, cy: -8, rx: 14, ry: 5.3, class: "piece-base-top" }));
  group.append(element("path", { d: "M-10 -12 Q-9 -17 -6 -21 L-5 -35 Q0 -41 5 -35 L6 -21 Q10 -17 10 -12 Q0 -7 -10 -12 Z", class: "piece-figure" }));
  group.append(element("path", { d: "M-7 -25 Q-14 -23 -13 -19 L-7 -18 M7 -25 Q14 -23 13 -19 L7 -18", fill: "none", stroke: "rgba(255,238,190,.62)", "stroke-width": "2.2", "stroke-linecap": "round" }));
  group.append(element("circle", { cx: 0, cy: -41, r: 6.4, class: "piece-figure" }));
  group.append(element("path", { d: "M-8 -43 Q-5 -52 0 -50 Q6 -53 9 -42 Q4 -45 0 -44 Q-4 -45 -8 -43 Z", class: "piece-helmet" }));
  group.append(element("path", { d: "M0 -49 Q3 -58 8 -60", fill: "none", stroke: "rgba(255,229,163,.9)", "stroke-width": "2", "stroke-linecap": "round" }));
  group.append(element("circle", { cx: 0, cy: -22, r: 6.7, class: "piece-sigil" }));
  group.append(element("text", { x: 0, y: -21.6, class: "piece-glyph" }, glyphFor(piece)));
  return group;
}

function alivePieces() {
  return state.pieces.filter((piece) => piece.alive !== false && piece.nodeId);
}

function renderPieces() {
  pieceLayer.replaceChildren();
  const nodeMap = topology.nodesById;
  for (const piece of alivePieces()) {
    const node = nodeMap.get(piece.nodeId);
    if (node) pieceLayer.append(pieceShape(piece, node));
  }
}

function renderHints() {
  moveHints.replaceChildren();
  const selected = state.pieces.find((piece) => piece.id === selectedPieceId);
  if (!selected) return;
  const selectedNode = topology.nodesById.get(selected.nodeId);
  if (selectedNode) {
    moveHints.append(element("circle", { cx: selectedNode.x, cy: selectedNode.y, r: 19, class: "selected-ring" }));
  }
  const occupied = new Set(alivePieces().map((piece) => piece.nodeId));
  for (const move of selectedMoves) {
    const node = topology.nodesById.get(move.to);
    if (!node) continue;
    moveHints.append(element("circle", {
      cx: node.x,
      cy: node.y,
      r: occupied.has(move.to) ? 12 : 8.5,
      class: `move-hint ${occupied.has(move.to) ? "capture-hint" : ""}`,
      "data-node-id": move.to,
    }));
  }
}

function factionPieceCount(faction) {
  return alivePieces().filter((piece) => piece.faction === faction).length;
}

function renderSeats() {
  seatList.replaceChildren();
  for (const faction of FACTION_ORDER) {
    const meta = FACTIONS[faction];
    const eliminated = state.eliminated.includes(faction);
    const roomSeat = onlineRoom?.seats?.[faction];
    const seat = document.createElement("div");
    seat.className = `seat ${state.currentFaction === faction && !state.gameOver ? "active" : ""} ${eliminated ? "eliminated" : ""}`;
    const controller = onlineRoom
      ? roomSeat?.controller === "human" ? "真人" : roomSeat?.controller === "open" ? "等待玩家" : "電腦"
      : isHumanFaction(faction) ? "真人" : "電腦";
    const displayName = onlineRoom && roomSeat?.controller === "human" ? ` · ${roomSeat.displayName}` : "";
    const connection = onlineRoom && roomSeat?.controller === "human" && roomSeat.connectionState === "offline" ? " · 離線" : "";
    seat.innerHTML = `<span class="seat-token ${faction}">${meta.short}</span><span class="seat-copy"><strong>${meta.name}${displayName}</strong><small>${eliminated ? "已淘汰" : `${controller}${connection} · ${factionPieceCount(faction)} 枚棋子`}</small></span><span class="seat-state">${eliminated ? "出局" : state.currentFaction === faction && !state.gameOver ? "行棋中" : "等待"}</span>`;
    seatList.append(seat);
  }
}

function renderLog() {
  moveLog.replaceChildren();
  if (state.history.length === 0) {
    const empty = document.createElement("li");
    empty.className = "empty-log";
    empty.textContent = "棋局開始後，走棋紀錄會顯示在這裡。";
    moveLog.append(empty);
    return;
  }
  for (const [index, entry] of state.history.slice(-14).entries()) {
    const item = document.createElement("li");
    const number = document.createElement("span");
    number.className = "log-index";
    number.textContent = `${state.history.length - Math.min(14, state.history.length) + index + 1}.`;
    const text = document.createElement("span");
    text.textContent = entry;
    item.append(number, text);
    moveLog.append(item);
  }
  moveLog.scrollTop = moveLog.scrollHeight;
}

function renderPanel() {
  const faction = state.currentFaction;
  const meta = faction ? FACTIONS[faction] : null;
  turnPill.dataset.faction = faction ?? "";
  const controller = onlineRoom?.seats?.[faction]?.controller;
  const actorLabel = onlineRoom
    ? controller === "ai" ? "・電腦" : isHumanFaction(faction) ? "・你" : "・真人"
    : meta && !isHumanFaction(faction) ? "・電腦" : "";
  turnPill.querySelector("span").textContent = state.draw
    ? "全體同意和棋"
    : state.gameOver
      ? `${FACTIONS[state.winner]?.name ?? "對局結束"} 獲勝`
      : `${meta?.name ?? "等待"}${meta ? actorLabel : ""}行棋`;
  document.querySelector("#move-count").textContent = `第 ${state.turnNumber ?? Math.floor(state.history.length / 3) + 1} 回合`;
  turnNumber.textContent = String(state.turnNumber ?? state.history.length + 1).padStart(2, "0");
  if (state.draw) {
    actionMessage.textContent = "所有存活玩家一致同意和棋。";
  } else if (state.gameOver) {
    actionMessage.textContent = `${FACTIONS[state.winner]?.name ?? "本局"}成為最後存活的陣營。`;
  } else if (state.statusMessage) {
    actionMessage.textContent = state.statusMessage;
  } else if (onlineRoom && onlineRoom.seats?.[faction]?.controller === "human" && !isHumanFaction(faction)) {
    actionMessage.textContent = `等待${meta?.name ?? "玩家"}方行棋。`;
  } else if (faction && !isHumanFaction(faction)) {
    actionMessage.textContent = `輪到${meta?.name ?? "電腦"}，電腦正在思考。`;
  } else {
    actionMessage.textContent = `輪到${meta?.name ?? "玩家"}。選擇棋子，再點選亮起的棋位。`;
  }

  const selected = state.pieces.find((piece) => piece.id === selectedPieceId && piece.alive !== false);
  if (selected) {
    selectedPiecePanel.querySelector(".selection-emblem").textContent = glyphFor(selected);
    selectedPiecePanel.querySelector("small").textContent = FACTIONS[selected.faction].name;
    selectedPiecePanel.querySelector("strong").textContent = PIECE_NAMES[selected.type];
  } else {
    selectedPiecePanel.querySelector(".selection-emblem").textContent = "將";
    selectedPiecePanel.querySelector("small").textContent = "已選棋子";
    selectedPiecePanel.querySelector("strong").textContent = "尚未選擇";
  }
  renderSeats();
  renderLog();
  historyScope.textContent = onlineRoomId ? "線上同步" : "僅本機";
  storageNote.textContent = onlineRoomId ? "線上棋局與事件會保存至 Firebase" : "本機遊玩不會上傳棋局資料";
  document.querySelector("#restart-button").disabled = Boolean(onlineRoomId);
  gameModeSelect.disabled = Boolean(onlineRoomId);
  loadMatchesButton.disabled = Boolean(!firebaseReady?.configured || onlineRoomId || stateBeforeReplay);
  createRoomButton.disabled = Boolean(!firebaseReady?.configured || stateBeforeReplay || onlineRoomId);
  joinRoomButton.disabled = Boolean(!firebaseReady?.configured || stateBeforeReplay || onlineRoomId);
  leaveRoomButton.disabled = Boolean(!onlineRoomId || stateBeforeReplay);
  const canOfferDraw = Boolean(!state.gameOver && !state.drawOffer && !stateBeforeReplay
    && state.drawDeclinedTurn !== state.turnNumber
    && (onlineRoomId
      ? onlineSeat?.role === "player" && onlineSeat.faction === state.currentFaction
      : state.humanFactions.includes(state.currentFaction)));
  proposeDrawButton.hidden = !canOfferDraw;
  proposeDrawButton.disabled = drawActionPending;
  const offer = state.drawOffer;
  const voteFaction = onlineRoomId
    ? onlineSeat?.role === "player" ? onlineSeat.faction : null
    : offer?.requiredFactions?.find((side) => state.humanFactions.includes(side) && !(side in offer.votes));
  const canVote = Boolean(offer && voteFaction && voteFaction !== offer.proposer && !(voteFaction in offer.votes));
  drawVoteBox.hidden = !offer;
  acceptDrawButton.hidden = !canVote;
  rejectDrawButton.hidden = !canVote;
  acceptDrawButton.disabled = drawActionPending;
  rejectDrawButton.disabled = drawActionPending;
  const voted = offer ? Object.keys(offer.votes ?? {}).length : 0;
  const needed = offer?.requiredFactions?.length ?? 0;
  drawVoteMessage.textContent = offer
    ? canVote ? `和棋提議：請${FACTIONS[voteFaction]?.name ?? "玩家"}表決（${voted}/${needed} 票）。`
      : `和棋提議等待其他存活玩家表決（${voted}/${needed} 票）。`
    : "";
}

function render() {
  renderHints();
  renderPieces();
  renderPanel();
}

function renderReplayFrame() {
  const frame = replayFrames[replayIndex];
  if (!frame) return;
  state = {
    ...frame.state,
    mode: "replay",
    humanFactions: [],
    statusMessage: "公開棋譜回放中。",
  };
  replayCaption.textContent = `${replayMatch?.label ?? "棋譜"} · ${replayIndex}/${replayFrames.length - 1} 事件${frame.caption ? `：${frame.caption}` : ""}`;
  document.querySelector("#replay-previous").disabled = replayIndex === 0;
  document.querySelector("#replay-next").disabled = replayIndex >= replayFrames.length - 1;
  render();
}

function buildReplayFrames(match, events) {
  const frames = [{
    state: {
      pieces: startingPosition.pieces.map((piece) => ({ ...piece })),
      currentFaction: "SH",
      eliminated: [],
      history: [],
      gameOver: false,
      winner: null,
      draw: false,
      turnNumber: 1,
    },
    caption: "開局",
  }];
  for (const event of events) {
    const previous = frames.at(-1).state;
    const next = {
      ...previous,
      pieces: previous.pieces.map((piece) => ({ ...piece })),
      eliminated: [...previous.eliminated],
      history: [...previous.history],
    };
    const payload = event.payload ?? {};
    let caption = "";
    if (event.type === "move") {
      const moved = next.pieces.find((piece) => piece.id === payload.pieceId);
      const taken = payload.captureId ? next.pieces.find((piece) => piece.id === payload.captureId) : null;
      const result = applyMoveToPieces(next.pieces, {
        pieceId: payload.pieceId,
        from: payload.from,
        to: payload.to,
        captureId: payload.captureId ?? undefined,
      });
      next.pieces = result.pieces;
      const eliminated = new Set([...(result.eliminatedFactions ?? []), ...(payload.eliminatedFactions ?? [])]);
      for (const faction of eliminated) {
        if (!next.eliminated.includes(faction)) next.eliminated.push(faction);
        next.pieces = next.pieces.map((piece) => piece.faction === faction ? { ...piece, alive: false, nodeId: null } : piece);
      }
      const name = { SH: "蜀", WU: "吳", WE: "魏" };
      const pieceName = { general: "主帥", rook: "車", horse: "馬", elephant: "象", advisor: "士", cannon: "炮", pawn: "兵" };
      const historyText = payload.historyText ?? `${name[moved?.faction] ?? ""}${pieceName[moved?.type] ?? "棋子"} ${payload.from} → ${payload.to}${taken ? `，吃 ${pieceName[taken.type] ?? "棋子"}` : ""}`;
      next.history.push(historyText, ...(payload.additionalHistory ?? []));
      next.turnNumber = (next.turnNumber ?? 1) + 1;
      next.currentFaction = payload.nextFaction ?? null;
      next.winner = payload.winner ?? null;
      next.gameOver = Boolean(next.winner) || next.currentFaction === null;
      caption = historyText;
    } else if (event.type === "elimination") {
      if (!next.eliminated.includes(event.faction)) next.eliminated.push(event.faction);
      next.pieces = next.pieces.map((piece) => piece.faction === event.faction ? { ...piece, alive: false, nodeId: null } : piece);
      const factionName = { SH: "蜀", WU: "吳", WE: "魏" }[event.faction] ?? "玩家";
      caption = `${factionName}淘汰：${payload.reason === "no_legal_moves" ? "沒有合法走法" : "主帥被吃"}`;
      next.history.push(caption);
      next.currentFaction = payload.nextFaction ?? null;
      next.winner = payload.winner ?? null;
      next.gameOver = Boolean(next.winner) || next.currentFaction === null;
    } else if (event.type === "ai_takeover" || event.type === "player_reconnected") {
      const factionName = { SH: "蜀", WU: "吳", WE: "魏" }[event.faction] ?? "玩家";
      caption = event.type === "ai_takeover" ? `${factionName}玩家離線，電腦接手` : `${factionName}玩家重新連線`;
    } else if (event.type === "draw_offer" || event.type === "draw_vote") {
      const factionName = { SH: "蜀", WU: "吳", WE: "魏" };
      caption = event.type === "draw_offer"
        ? `${factionName[payload.proposer] ?? "玩家"}提議和棋`
        : `${factionName[payload.voter] ?? "玩家"}${payload.accepted ? "同意" : "拒絕"}和棋`;
      if (payload.result === "rejected") next.drawDeclinedTurn = next.turnNumber;
      if (payload.result === "accepted") {
        next.draw = true;
        next.gameOver = true;
        next.winner = null;
        next.currentFaction = null;
      }
    } else if (event.type === "match_end") {
      next.currentFaction = null;
      next.gameOver = true;
      caption = "對局中斷";
      next.history.push(caption);
    }
    frames.push({ state: next, caption });
  }
  if (match.winnerFaction && !frames.at(-1).state.winner) {
    const finalState = { ...frames.at(-1).state, winner: match.winnerFaction, gameOver: true, currentFaction: null };
    frames.push({ state: finalState, caption: `本局由${{ SH: "蜀", WU: "吳", WE: "魏" }[match.winnerFaction]}獲勝` });
  }
  return frames;
}

function exitReplay() {
  if (!stateBeforeReplay) return;
  window.clearTimeout(computerTimer);
  state = stateBeforeReplay;
  stateBeforeReplay = null;
  replayFrames = [];
  replayMatch = null;
  replayControls.hidden = true;
  loadMatchesButton.disabled = !firebaseReady?.configured;
  if (!onlineRoomId) {
    gameModeSelect.disabled = false;
    document.querySelector("#restart-button").disabled = false;
  }
  render();
  scheduleComputerTurn();
}

async function openReplay(match) {
  try {
    loadMatchesButton.disabled = true;
    replayCaption.textContent = "正在載入完整棋譜…";
    const events = await loadMatchEvents(match.id);
    stateBeforeReplay = state;
    replayMatch = {
      ...match,
      label: `${match.seats?.map((seat) => seat.displayName ?? "玩家").join(" vs ") ?? "三國棋對局"} · ${match.status === "interrupted" ? "中斷" : match.winnerFaction ? `${FACTIONS[match.winnerFaction].name}獲勝` : "和棋"}`,
    };
    replayFrames = buildReplayFrames(match, events);
    replayIndex = 0;
    window.clearTimeout(computerTimer);
    selectedPieceId = null;
    selectedMoves = [];
    replayControls.hidden = false;
    gameModeSelect.disabled = true;
    document.querySelector("#restart-button").disabled = true;
    renderReplayFrame();
  } catch (error) {
    replayCaption.textContent = `棋譜載入失敗：${error.message}`;
    loadMatchesButton.disabled = false;
  }
}

async function refreshPublicMatches() {
  loadMatchesButton.disabled = true;
  matchList.replaceChildren();
  const loading = document.createElement("li");
  loading.className = "empty-log";
  loading.textContent = "正在載入公開棋譜…";
  matchList.append(loading);
  try {
    const matches = await loadPublicMatches(30);
    matchList.replaceChildren();
    if (!matches.length) {
      const empty = document.createElement("li");
      empty.className = "empty-log";
      empty.textContent = "目前還沒有已結束的公開棋局。";
      matchList.append(empty);
      return;
    }
    for (const match of matches) {
      const item = document.createElement("li");
      const button = document.createElement("button");
      button.className = "match-entry";
      const winner = match.winnerFaction ? `${FACTIONS[match.winnerFaction]?.name ?? "玩家"}獲勝` : match.status === "interrupted" ? "對局中斷" : "和棋";
      const date = match.endedAt?.toDate ? match.endedAt.toDate().toLocaleString("zh-TW") : "時間未知";
      button.textContent = `${date} · ${winner} · ${match.eventCount ?? 0} 事件`;
      button.addEventListener("click", () => openReplay(match));
      item.append(button);
      matchList.append(item);
    }
  } catch (error) {
    const item = document.createElement("li");
    item.className = "empty-log";
    item.textContent = `公開棋譜載入失敗：${error.message}`;
    matchList.replaceChildren(item);
  } finally {
    loadMatchesButton.disabled = false;
  }
}

function selectPiece(piece) {
  selectedPieceId = piece.id;
  selectedMoves = engine.generatePseudoLegalMoves(piece, state.pieces);
  state.statusMessage = selectedMoves.length
    ? `可走 ${selectedMoves.length} 個位置。馬腿、象眼與棋子阻擋會即時判定。`
    : "這枚棋子目前沒有合法走法。";
  render();
}

function clearSelection() {
  selectedPieceId = null;
  selectedMoves = [];
  state.statusMessage = "";
  render();
}

function eliminateFaction(faction, reason) {
  if (state.eliminated.includes(faction)) return;
  state.eliminated.push(faction);
  state.pieces = state.pieces.map((piece) => piece.faction === faction ? { ...piece, alive: false, nodeId: null } : piece);
  state.history.push(`${FACTIONS[faction].name}淘汰：${reason}`);
}

function hasAnyMove(faction) {
  return alivePieces().filter((piece) => piece.faction === faction)
    .some((piece) => engine.generatePseudoLegalMoves(piece, state.pieces).length > 0);
}

function livingFactions() {
  return FACTION_ORDER.filter((faction) => !state.eliminated.includes(faction));
}

function advanceTurn() {
  const survivors = livingFactions();
  if (survivors.length <= 1) {
    state.gameOver = true;
    state.winner = survivors[0] ?? null;
    state.currentFaction = null;
    selectedPieceId = null;
    selectedMoves = [];
    return;
  }

  let next = nextLivingFaction(state.currentFaction, state.eliminated, FACTION_ORDER);
  let guard = 0;
  while (next && guard < FACTION_ORDER.length) {
    if (hasAnyMove(next)) break;
    eliminateFaction(next, "沒有合法走法");
    if (livingFactions().length <= 1) {
      state.gameOver = true;
      state.winner = livingFactions()[0] ?? null;
      state.currentFaction = null;
      return;
    }
    next = nextLivingFaction(next, state.eliminated, FACTION_ORDER);
    guard += 1;
  }
  state.currentFaction = next;
}

function commitMove(move) {
  if (onlineRoomId) {
    submitOnlineMove(move);
    return;
  }
  const movingPiece = state.pieces.find((piece) => piece.id === move.pieceId);
  const targetPiece = move.captureId ? state.pieces.find((piece) => piece.id === move.captureId) : null;
  const result = applyMoveToPieces(state.pieces, move);
  state.pieces = result.pieces;
  for (const faction of result.eliminatedFactions) {
    if (!state.eliminated.includes(faction)) state.eliminated.push(faction);
  }

  const phrase = `${FACTIONS[movingPiece.faction].short}${PIECE_NAMES[movingPiece.type]} ${move.from} → ${move.to}${targetPiece ? `，吃 ${FACTIONS[targetPiece.faction].short}${PIECE_NAMES[targetPiece.type]}` : ""}`;
  state.history.push(phrase);
  state.turnNumber = (state.turnNumber ?? 1) + 1;
  state.drawDeclinedTurn = null;
  state.statusMessage = targetPiece?.type === "general"
    ? `${FACTIONS[targetPiece.faction].name}主帥被吃，該方淘汰。`
    : "走棋完成。";
  selectedPieceId = null;
  selectedMoves = [];
  advanceTurn();
  render();
  scheduleComputerTurn();
}

function nearestSelectedMove(event) {
  if (!selectedMoves.length) return null;
  const point = svg.createSVGPoint();
  point.x = event.clientX;
  point.y = event.clientY;
  const localPoint = point.matrixTransform(svg.getScreenCTM().inverse());
  let nearest = null;
  let nearestDistance = Infinity;
  for (const move of selectedMoves) {
    const node = topology.nodesById.get(move.to);
    if (!node) continue;
    const distance = Math.hypot(localPoint.x - node.x, localPoint.y - node.y);
    if (distance < nearestDistance) {
      nearest = move;
      nearestDistance = distance;
    }
  }
  return nearestDistance <= 21 ? nearest : null;
}

function handleBoardClick(event) {
  if (stateBeforeReplay || state.gameOver || state.drawOffer || !isHumanFaction(state.currentFaction)) return;
  if (onlineRoomId && onlineRoom?.meta?.status !== "playing") return;
  const nearestMove = nearestSelectedMove(event);
  if (nearestMove) {
    commitMove(nearestMove);
    return;
  }
  const target = event.target.closest("[data-node-id]");
  if (!target || state.gameOver) return;
  const nodeId = target.dataset.nodeId;
  const selectedMove = selectedMoves.find((move) => move.to === nodeId);
  if (selectedMove) {
    commitMove(selectedMove);
    return;
  }
  const piece = alivePieces().find((item) => item.nodeId === nodeId);
  if (piece?.faction === state.currentFaction) {
    if (piece.id === selectedPieceId) clearSelection();
    else selectPiece(piece);
    return;
  }
  if (selectedPieceId) clearSelection();
}

function initialState() {
  const mode = gameModeSelect.value;
  return {
    pieces: startingPosition.pieces.map((piece) => ({ ...piece })),
    currentFaction: "SH",
    eliminated: [],
    history: [],
    gameOver: false,
    draw: false,
    drawOffer: null,
    drawDeclinedTurn: null,
    turnNumber: 1,
    winner: null,
    statusMessage: "",
    mode,
    humanFactions: humanFactionsForMode(mode),
  };
}

function livingFactionsForState() {
  return FACTION_ORDER.filter((faction) => !state.eliminated.includes(faction));
}

function applyLocalDrawVote(faction, accepted) {
  const offer = state.drawOffer;
  if (!offer || faction in offer.votes || !offer.requiredFactions.includes(faction)) return;
  offer.votes[faction] = accepted;
  if (!accepted) {
    state.drawOffer = null;
    state.drawDeclinedTurn = offer.turnNumber;
    state.history.push(`${FACTIONS[faction].name}拒絕和棋；提議者可繼續走棋`);
    state.statusMessage = "和棋提議遭拒絕；提議者可繼續走棋，本回合不能再次提議。";
  } else if (offer.requiredFactions.every((side) => offer.votes[side] === true)) {
    state.drawOffer = null;
    state.draw = true;
    state.gameOver = true;
    state.winner = null;
    state.currentFaction = null;
    state.history.push("全體存活玩家同意和棋");
    state.statusMessage = "全體同意和棋。";
  } else {
    state.history.push(`${FACTIONS[faction].name}同意和棋`);
    state.statusMessage = "已記錄表決，等待其他存活玩家。";
  }
  render();
}

async function proposeDraw() {
  if (drawActionPending) return;
  const proposer = state.currentFaction;
  if (!proposer || state.gameOver || state.drawOffer || state.drawDeclinedTurn === state.turnNumber) return;
  if (onlineRoomId) {
    drawActionPending = true;
    render();
    try {
      await callServer("proposeDraw", { roomCode: onlineRoomId });
    } catch (error) {
      roomMessage.textContent = `和棋提議失敗：${error.message}`;
    } finally {
      drawActionPending = false;
      render();
    }
    return;
  }

  const survivors = livingFactionsForState();
  const votes = { [proposer]: true };
  const aiVotes = [];
  for (const faction of survivors) {
    if (faction === proposer || state.humanFactions.includes(faction)) continue;
    const accepted = shouldComputerAcceptDraw(engine, state.pieces, faction, survivors);
    votes[faction] = accepted;
    aiVotes.push({ faction, accepted });
  }
  const offer = { proposer, turnNumber: state.turnNumber, votes, requiredFactions: survivors };
  state.history.push(`${FACTIONS[proposer].name}提議和棋`);
  for (const vote of aiVotes) {
    state.history.push(`${FACTIONS[vote.faction].name}電腦${vote.accepted ? "同意" : "拒絕"}和棋`);
  }
  if (aiVotes.some((vote) => !vote.accepted)) {
    state.drawDeclinedTurn = state.turnNumber;
    state.history.push("電腦拒絕和棋；提議者可繼續走棋");
    state.statusMessage = "電腦拒絕和棋；提議者可繼續走棋，本回合不能再次提議。";
  } else if (survivors.every((faction) => votes[faction] === true)) {
    state.draw = true;
    state.gameOver = true;
    state.winner = null;
    state.currentFaction = null;
    state.history.push("全體存活玩家同意和棋");
    state.statusMessage = "全體同意和棋。";
  } else {
    state.drawOffer = offer;
    state.statusMessage = "和棋提議已送出，等待其他玩家表決。";
  }
  render();
}

async function voteDraw(accepted) {
  if (!state.drawOffer || drawActionPending) return;
  if (onlineRoomId) {
    drawActionPending = true;
    render();
    try {
      await callServer("voteDraw", { roomCode: onlineRoomId, accepted });
    } catch (error) {
      roomMessage.textContent = `和棋表決失敗：${error.message}`;
    } finally {
      drawActionPending = false;
      render();
    }
    return;
  }
  const voter = state.drawOffer.requiredFactions.find((side) => state.humanFactions.includes(side)
    && side !== state.drawOffer.proposer && !(side in state.drawOffer.votes));
  if (voter) applyLocalDrawVote(voter, accepted);
}

function showRecoveryCode(roomCode, recoveryCode) {
  roomCredentials.replaceChildren();
  roomCredentials.hidden = false;
  const roomLine = document.createElement("div");
  roomLine.textContent = `房間代碼：${roomCode}`;
  roomCredentials.append(roomLine);
  if (recoveryCode) {
    const recoveryLine = document.createElement("div");
    recoveryLine.textContent = `席位恢復碼（請自行保存）：${recoveryCode}`;
    roomCredentials.append(recoveryLine);
  }
}

function applyOnlineRoom(publicRoom) {
  if (!publicRoom) {
    roomMessage.textContent = "房間已關閉或已逾時。";
    void exitOnlineRoom(false);
    return;
  }
  onlineRoom = publicRoom;
  const meta = publicRoom.meta ?? {};
  const factionNames = { SH: "蜀", WU: "吳", WE: "魏" };
  const modeNames = { "one-human": "一人對兩台電腦", "two-humans": "兩人對一台電腦", "three-humans": "三位真人" };
  const seatName = onlineSeat?.role === "spectator" ? "觀戰者" : `${factionNames[onlineSeat?.faction] ?? "玩家"}方`;
  connectionLabel.textContent = `線上房間 ${onlineRoomId}`;
  if (meta.status === "waiting") {
    const onlineHumans = Object.values(publicRoom.seats ?? {}).filter((seat) => seat.controller === "human" && seat.connectionState === "online").length;
    roomMessage.textContent = `房間等待玩家：${modeNames[meta.mode] ?? meta.mode}，目前 ${onlineHumans}/${meta.humanCount} 位真人。你是${seatName}。`;
    state = {
      ...initialState(),
      mode: meta.mode,
      humanFactions: onlineSeat?.role === "player" ? [onlineSeat.faction] : [],
      statusMessage: "等待遊戲開始。",
    };
  } else if (meta.status === "playing" && publicRoom.game) {
    const game = normalizeOnlineGame(publicRoom.game);
    state = {
      ...game,
      mode: meta.mode,
      humanFactions: onlineSeat?.role === "player" ? [onlineSeat.faction] : [],
      statusMessage: onlineSeat?.role === "spectator" ? "你正在觀戰；房間開始後不能加入玩家席位。" : "",
    };
    roomMessage.textContent = `房間 ${onlineRoomId} · ${seatName}${onlineSeat?.faction ? `（${factionNames[onlineSeat.faction]}）` : ""}。${onlineSeat?.role === "spectator" ? "目前為觀戰模式。" : "棋局已即時同步。"}`;
  } else {
    const game = normalizeOnlineGame(publicRoom.game ?? initialState());
    state = {
      ...game,
      mode: meta.mode,
      humanFactions: [],
      statusMessage: "對局已結束。",
    };
    roomMessage.textContent = `房間 ${onlineRoomId} 的對局已結束。`;
  }
  createRoomButton.disabled = true;
  joinRoomButton.disabled = true;
  leaveRoomButton.disabled = false;
  render();
}

function normalizeOnlineGame(game) {
  return {
    ...game,
    pieces: Array.isArray(game.pieces) ? game.pieces : [],
    eliminated: Array.isArray(game.eliminated) ? game.eliminated : [],
    history: Array.isArray(game.history) ? game.history : [],
  };
}

async function enterOnlineRoom(roomCode, seat, recoveryCode = null) {
  window.clearTimeout(computerTimer);
  onlineRoomId = roomCode;
  onlineSeat = seat;
  roomCodeInput.value = roomCode;
  showRecoveryCode(roomCode, recoveryCode);
  if (stopRoomPresence) await stopRoomPresence();
  if (unsubscribeRoom) unsubscribeRoom();
  try {
    stopRoomPresence = await monitorRoomPresence(roomCode, firebaseReady.uid, (error) => {
      roomMessage.textContent = `連線狀態更新失敗：${error.message}`;
    });
    unsubscribeRoom = await subscribeRoom(roomCode, applyOnlineRoom, (error) => {
      roomMessage.textContent = `房間同步失敗：${error.message}`;
    });
  } catch (error) {
    roomMessage.textContent = `無法連線房間：${error.message}`;
  }
}

async function exitOnlineRoom(notifyServer = true) {
  const roomCode = onlineRoomId;
  if (!roomCode) return;
  if (notifyServer) {
    try { await callServer("leaveRoom", { roomCode }); } catch { /* The room may have expired. */ }
  }
  if (unsubscribeRoom) unsubscribeRoom();
  unsubscribeRoom = null;
  if (stopRoomPresence) await stopRoomPresence();
  stopRoomPresence = null;
  onlineRoomId = null;
  onlineSeat = null;
  onlineRoom = null;
  createRoomButton.disabled = !firebaseReady?.configured;
  joinRoomButton.disabled = !firebaseReady?.configured;
  leaveRoomButton.disabled = true;
  connectionLabel.textContent = "本機遊玩";
  roomCredentials.hidden = true;
  roomMessage.textContent = "已離開線上房間；本機模式仍可遊玩。";
  state = initialState();
  selectedPieceId = null;
  selectedMoves = [];
  render();
  scheduleComputerTurn();
}

async function submitOnlineMove(move) {
  if (onlineMovePending || !onlineRoomId) return;
  onlineMovePending = true;
  roomMessage.textContent = "正在送出棋步…";
  try {
    await callServer("submitMove", {
      roomCode: onlineRoomId,
      pieceId: move.pieceId,
      from: move.from,
      to: move.to,
    });
  } catch (error) {
    roomMessage.textContent = `棋步未送出：${error.message}`;
  } finally {
    onlineMovePending = false;
  }
}

async function createOnlineRoom() {
  const pin = roomPinInput.value.trim();
  if (!/^\d{6}$/.test(pin)) {
    roomMessage.textContent = "請輸入 6 位數字密碼。";
    roomPinInput.focus();
    return;
  }
  createRoomButton.disabled = true;
  roomMessage.textContent = "正在建立線上房間…";
  try {
    firebaseReady = await initializeFirebaseClient();
    const result = await callServer("createRoom", {
      mode: gameModeSelect.value,
      pin,
      displayName: displayNameInput.value,
    });
    await enterOnlineRoom(result.roomCode, { role: result.role, faction: result.faction }, result.recoveryCode);
  } catch (error) {
    roomMessage.textContent = `建立房間失敗：${error.message}`;
    createRoomButton.disabled = false;
  }
}

async function joinOnlineRoom() {
  const pin = roomPinInput.value.trim();
  const roomCode = roomCodeInput.value.trim().toUpperCase();
  if (!roomCode || !/^\d{6}$/.test(pin)) {
    roomMessage.textContent = "請輸入房間代碼與 6 位數字密碼。";
    return;
  }
  joinRoomButton.disabled = true;
  roomMessage.textContent = "正在加入房間…";
  try {
    firebaseReady = await initializeFirebaseClient();
    const result = await callServer("joinRoom", {
      roomCode,
      pin,
      displayName: displayNameInput.value,
    });
    await enterOnlineRoom(result.roomCode, { role: result.role, faction: result.faction }, result.recoveryCode);
  } catch (error) {
    roomMessage.textContent = `加入房間失敗：${error.message}`;
    joinRoomButton.disabled = false;
  }
}

function restart() {
  if (onlineRoomId) return;
  window.clearTimeout(computerTimer);
  state = initialState();
  selectedPieceId = null;
  selectedMoves = [];
  render();
  scheduleComputerTurn();
}

function setBoardCamera() {
  svg.style.setProperty("--board-rotation", `${boardRotation}deg`);
  svg.style.setProperty("--board-zoom", boardZoom.toFixed(2));
}

function handleCameraControl(event) {
  const button = event.target.closest("[data-camera]");
  if (!button) return;
  switch (button.dataset.camera) {
    case "rotate-left": boardRotation -= 15; break;
    case "rotate-right": boardRotation += 15; break;
    case "zoom-out": boardZoom = Math.max(0.84, boardZoom - 0.08); break;
    case "zoom-in": boardZoom = Math.min(1.2, boardZoom + 0.08); break;
    case "reset": boardRotation = 0; boardZoom = 1; break;
    default: return;
  }
  setBoardCamera();
}

function computerMove() {
  const pieces = alivePieces();
  const moves = pieces
    .filter((piece) => piece.faction === state.currentFaction)
    .flatMap((piece) => engine.generatePseudoLegalMoves(piece, state.pieces));
  if (!moves.length) {
    eliminateFaction(state.currentFaction, "沒有合法走法");
    const eliminated = state.currentFaction;
    state.currentFaction = eliminated;
    advanceTurn();
    render();
    scheduleComputerTurn();
    return;
  }
  const faction = state.currentFaction;
  const choice = chooseComputerMove(engine, topology, state.pieces, faction);
  commitMove(choice);
}

function scheduleComputerTurn() {
  window.clearTimeout(computerTimer);
  if (!state || state.gameOver || state.drawOffer) return;
  if (onlineRoom) {
    if (state.statusMessage === "電腦正在思考。") {
      state.statusMessage = "";
      render();
    }
    return;
  }
  if (isHumanFaction(state.currentFaction)) {
    if (state.statusMessage === "電腦正在思考。") {
      state.statusMessage = "";
      render();
    }
    return;
  }
  state.statusMessage = "電腦正在思考。";
  render();
  computerTimer = window.setTimeout(computerMove, COMPUTER_DELAY_MS);
}

async function boot() {
  try {
    const [topologyResponse, startResponse] = await Promise.all([
      fetch("./board-topology.json"),
      fetch("./starting-position.json"),
    ]);
    if (!topologyResponse.ok || !startResponse.ok) throw new Error("無法讀取棋盤資料。");
    topology = await topologyResponse.json();
    startingPosition = await startResponse.json();
    topology.nodesById = new Map(topology.nodes.map((node) => [node.id, node]));
    engine = createMoveEngine(topology);
    drawBoard();
    setBoardCamera();
    state = initialState();
    svg.addEventListener("click", handleBoardClick);
    document.querySelector(".camera-toolbar").addEventListener("click", handleCameraControl);
    document.querySelector("#restart-button").addEventListener("click", restart);
    gameModeSelect.addEventListener("change", () => {
      state.statusMessage = "模式已變更，按「重新開始」套用新的席位安排。";
      render();
    });
    createRoomButton.addEventListener("click", createOnlineRoom);
    joinRoomButton.addEventListener("click", joinOnlineRoom);
    leaveRoomButton.addEventListener("click", () => exitOnlineRoom(true));
    proposeDrawButton.addEventListener("click", proposeDraw);
    acceptDrawButton.addEventListener("click", () => voteDraw(true));
    rejectDrawButton.addEventListener("click", () => voteDraw(false));
    loadMatchesButton.addEventListener("click", refreshPublicMatches);
    document.querySelector("#replay-previous").addEventListener("click", () => {
      replayIndex = Math.max(0, replayIndex - 1);
      renderReplayFrame();
    });
    document.querySelector("#replay-next").addEventListener("click", () => {
      replayIndex = Math.min(replayFrames.length - 1, replayIndex + 1);
      renderReplayFrame();
    });
    document.querySelector("#replay-exit").addEventListener("click", exitReplay);
    roomCodeInput.addEventListener("input", () => {
      roomCodeInput.value = roomCodeInput.value.toUpperCase().replace(/[^A-F0-9]/g, "");
    });
    try {
      firebaseReady = await initializeFirebaseClient();
      if (firebaseReady.configured) {
        firebaseStatus.textContent = "Firebase 已連線";
        roomMessage.textContent = "輸入 6 位數密碼建立或加入房間；遊戲開始後加入者可觀戰。";
        createRoomButton.disabled = false;
        joinRoomButton.disabled = false;
        loadMatchesButton.disabled = false;
      } else {
        firebaseStatus.textContent = "尚未設定";
        roomMessage.textContent = "本機模式可直接遊玩；完成 FIREBASE_SETUP.md 設定後可使用線上房間。";
      }
    } catch (error) {
      firebaseStatus.textContent = "Firebase 無法連線";
      roomMessage.textContent = `Firebase 初始化失敗：${error.message}`;
    }
    render();
  } catch (error) {
    actionMessage.textContent = `棋局載入失敗：${error.message} 請以本機伺服器或 GitHub Pages 開啟。`;
    console.error(error);
  }
}

boot();
