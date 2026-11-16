import { randomBytes, randomUUID, scryptSync, timingSafeEqual, createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getDatabase } from "firebase-admin/database";
import { FieldValue, Timestamp, getFirestore } from "firebase-admin/firestore";
import { HttpsError, onCall } from "firebase-functions/v2/https";
import { onValueDeleted, onValueWritten } from "firebase-functions/v2/database";
import { onSchedule } from "firebase-functions/v2/scheduler";
import { setGlobalOptions } from "firebase-functions/v2";
import { applyMoveToPieces, createMoveEngine, nextLivingFaction } from "./shared/game/move-engine.js";
import { chooseComputerMove } from "./shared/game/computer-player.js";
import { shouldComputerAcceptDraw } from "./shared/game/draw-vote.js";

initializeApp({ databaseURL: "https://three-kingdoms-ot-exam-review.asia-southeast1.firebasedatabase.app" });
setGlobalOptions({ region: "asia-southeast1", maxInstances: 10 });

const database = getDatabase();
const firestore = getFirestore();
const topology = JSON.parse(readFileSync(new URL("./shared/board-topology.json", import.meta.url), "utf8"));
topology.nodesById = new Map(topology.nodes.map((node) => [node.id, node]));
const startingPosition = JSON.parse(readFileSync(new URL("./shared/starting-position.json", import.meta.url), "utf8"));
const engine = createMoveEngine(topology);
const factions = ["SH", "WU", "WE"];
const factionNames = { SH: "蜀", WU: "吳", WE: "魏" };
const pieceNames = { general: "主帥", rook: "車", horse: "馬", elephant: "象", advisor: "士", cannon: "炮", pawn: "兵" };
const roomIdleMs = 3 * 60 * 1000;
const roomCodePattern = /^[A-F0-9]{8}$/;
const modes = {
  "one-human": { humans: 1, controllers: { SH: "human", WU: "ai", WE: "ai" } },
  "two-humans": { humans: 2, controllers: { SH: "human", WU: "open", WE: "ai" } },
  "three-humans": { humans: 3, controllers: { SH: "human", WU: "open", WE: "open" } },
};

function requireAuth(request) {
  if (!request.auth?.uid || request.auth.token.threeKingdomsClient !== true) {
    throw new HttpsError("unauthenticated", "請先連線至三國棋房間。");
  }
  return request.auth.uid;
}

function cleanName(value) {
  const name = String(value ?? "").trim().replace(/[<>]/g, "").slice(0, 20);
  return name || "訪客";
}

function hashSecret(secret, salt) {
  return scryptSync(secret, salt, 64).toString("hex");
}

function secretMatches(secret, salt, expectedHash) {
  if (!secret || !salt || !expectedHash) return false;
  const actual = Buffer.from(hashSecret(secret, salt), "hex");
  const expected = Buffer.from(expectedHash, "hex");
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

function makeRecoverySecret() {
  return randomBytes(9).toString("base64url").slice(0, 12).toUpperCase();
}

function newRecoveryRecord(secret) {
  const salt = randomBytes(16).toString("hex");
  return { salt, hash: hashSecret(secret, salt) };
}

function initialGame() {
  return {
    pieces: startingPosition.pieces.map((piece) => ({ ...piece })),
    currentFaction: "SH",
    eliminated: [],
    history: [],
    gameOver: false,
    winner: null,
    turnNumber: 1,
    eventSequence: 0,
    lastEvent: null,
    drawOffer: null,
    drawDeclinedTurn: null,
    draw: false,
  };
}

function livingFactions(game) {
  return factions.filter((faction) => !game.eliminated.includes(faction));
}

function eliminateFaction(room, faction, reason) {
  const game = room.public.game;
  if (game.eliminated.includes(faction)) return;
  game.eliminated.push(faction);
  game.pieces = game.pieces.map((piece) => piece.faction === faction ? { ...piece, alive: false, nodeId: null } : piece);
  room.public.seats[faction].connectionState = "offline";
  game.history.push(`${factionNames[faction]}方淘汰：${reason}`);
}

function recordControlEvent(room, type, faction) {
  const game = room.public.game;
  if (!game || room.public.meta.status !== "playing") return;
  game.eventSequence = (game.eventSequence ?? 0) + 1;
  game.lastEvent = {
    sequence: game.eventSequence,
    type,
    faction,
    payload: { faction },
  };
}

function recordDrawEvent(room, type, faction, payload) {
  const game = room.public.game;
  game.eventSequence = (game.eventSequence ?? 0) + 1;
  game.lastEvent = { sequence: game.eventSequence, type, faction, payload };
  room.public.meta.lastActivityAt = Date.now();
}

function finishAsDraw(room) {
  const game = room.public.game;
  game.draw = true;
  game.gameOver = true;
  game.winner = null;
  game.currentFaction = null;
  game.drawOffer = null;
  room.public.meta.status = "draw";
  room.public.meta.endedAt = Date.now();
}

function hasAnyMove(game, faction) {
  return game.pieces
    .filter((piece) => piece.alive !== false && piece.nodeId && piece.faction === faction)
    .some((piece) => engine.generatePseudoLegalMoves(piece, game.pieces).length > 0);
}

function advanceGame(room) {
  const game = room.public.game;
  let survivors = livingFactions(game);
  if (survivors.length <= 1) {
    game.gameOver = true;
    game.winner = survivors[0] ?? null;
    room.public.meta.status = "completed";
    return;
  }

  let next = nextLivingFaction(game.currentFaction, game.eliminated, factions);
  let guard = 0;
  while (next && guard < factions.length) {
    if (hasAnyMove(game, next)) break;
    eliminateFaction(room, next, "沒有合法走法");
    survivors = livingFactions(game);
    if (survivors.length <= 1) {
      game.gameOver = true;
      game.winner = survivors[0] ?? null;
      room.public.meta.status = "completed";
      room.public.meta.endedAt = Date.now();
      return;
    }
    next = nextLivingFaction(next, game.eliminated, factions);
    guard += 1;
  }
  game.currentFaction = next;
  if (!next) {
    game.gameOver = true;
    game.winner = livingFactions(game)[0] ?? null;
    room.public.meta.status = "completed";
    room.public.meta.endedAt = Date.now();
  }
}

function openMatch(room, matchId, startedAt) {
  room.public.meta.status = "playing";
  room.public.meta.matchId = matchId;
  room.public.meta.startedAt = startedAt;
  room.public.meta.matchSeats = factions.map((faction) => ({
    faction,
    displayName: room.public.seats[faction]?.displayName ?? "電腦",
    controller: room.public.seats[faction]?.controller === "human" ? "human" : "ai",
  }));
  room.public.game = initialGame();
}

async function ensureMatchRecord(roomId, room) {
  const meta = room.public.meta;
  if (!meta.matchId) return;
  const matchRef = firestore.collection("threeKingdomsMatches").doc(meta.matchId);
  await matchRef.set({
    roomCode: roomId,
    status: ["completed", "draw"].includes(meta.status) ? meta.status : "playing",
    mode: meta.mode,
    startedAt: Timestamp.fromMillis(meta.startedAt ?? meta.createdAt),
    endedAt: meta.endedAt ? Timestamp.fromMillis(meta.endedAt) : null,
    durationMs: meta.endedAt ? meta.endedAt - (meta.startedAt ?? meta.createdAt) : null,
    resultType: meta.status === "completed" ? "victory" : meta.status === "draw" ? "unanimous_draw" : null,
    winnerFaction: room.public.game?.winner ?? null,
    eliminationOrder: room.public.game?.eliminated ?? [],
    seats: meta.matchSeats ?? factions.map((faction) => ({
      faction,
      displayName: room.public.seats[faction]?.displayName ?? "電腦",
      controller: room.public.seats[faction]?.controller === "human" ? "human" : "ai",
    })),
    finalBoardState: room.public.game?.pieces ?? [],
  }, { merge: true });
}

function createMatchId() {
  return randomUUID();
}

async function findRoomByCode(roomCode) {
  if (typeof roomCode !== "string" || !roomCodePattern.test(roomCode)) return null;
  const snapshot = await database.ref(`threeKingdoms/rooms/${roomCode}`).get();
  return snapshot.exists() ? snapshot.val() : null;
}

async function recordFailedPinAttempt(request) {
  const ip = request.rawRequest?.ip ?? "unknown";
  const key = createHash("sha256").update(ip).digest("hex");
  const attemptRef = database.ref(`threeKingdoms/security/pinAttempts/${key}`);
  const now = Date.now();
  let limited = false;
  await attemptRef.transaction((value) => {
    const recent = (Array.isArray(value) ? value : []).filter((time) => time > now - 15 * 60 * 1000);
    if (recent.length >= 10) {
      limited = true;
      return;
    }
    recent.push(now);
    return recent;
  }, undefined, false);
  if (limited) throw new HttpsError("resource-exhausted", "嘗試次數過多，請稍後再試。");
}

async function verifyRoomPin(request, roomCode, pin) {
  if (!/^\d{6}$/.test(String(pin ?? ""))) throw new HttpsError("invalid-argument", "房間密碼需為 6 位數字。");
  const room = await findRoomByCode(roomCode);
  if (!room) {
    await recordFailedPinAttempt(request);
    throw new HttpsError("not-found", "房間代碼或密碼錯誤。");
  }
  const access = room.private?.access;
  if (!secretMatches(String(pin), access?.salt, access?.pinHash)) {
    await recordFailedPinAttempt(request);
    throw new HttpsError("permission-denied", "房間代碼或密碼錯誤。");
  }
  return room;
}

function publicSeat(faction, controller, name) {
  return {
    controller,
    displayName: controller === "ai" ? "電腦" : name ?? "等待玩家",
    connectionState: controller === "human" ? "online" : "offline",
  };
}

function completeGameMove(room, mover, move) {
  const game = room.public.game;
  const eliminatedBeforeMove = new Set(game.eliminated);
  const captured = move.captureId ? game.pieces.find((piece) => piece.id === move.captureId) : null;
  const result = applyMoveToPieces(game.pieces, move);
  game.pieces = result.pieces;
  for (const faction of result.eliminatedFactions) eliminateFaction(room, faction, "主帥被吃");
  const historyLengthBeforeMove = game.history.length;
  const historyText = `${factionNames[mover.faction]}${pieceNames[mover.type]} ${move.from} → ${move.to}${captured ? `，吃 ${factionNames[captured.faction]}${pieceNames[captured.type]}` : ""}`;
  game.history.push(historyText);
  game.turnNumber += 1;
  game.drawDeclinedTurn = null;
  advanceGame(room);
  game.eventSequence += 1;
  game.lastEvent = {
    sequence: game.eventSequence,
    type: "move",
    faction: mover.faction,
    payload: {
      pieceId: mover.id,
      from: move.from,
      to: move.to,
      captureId: captured?.id ?? null,
      eliminatedFactions: game.eliminated.filter((faction) => !eliminatedBeforeMove.has(faction)),
      nextFaction: game.currentFaction,
      winner: game.winner,
      historyText,
      additionalHistory: game.history.slice(historyLengthBeforeMove + 1),
    },
  };
  if (game.gameOver) room.public.meta.endedAt = Date.now();
  room.public.meta.lastActivityAt = Date.now();
}

async function transactComputerTurn(roomCode) {
  const roomRef = database.ref(`threeKingdoms/rooms/${roomCode}`);
  let noOp = false;
  const result = await roomRef.transaction((room) => {
    if (!room?.public?.game || room.public.meta.status !== "playing" || room.public.game.drawOffer) return;
    const faction = room.public.game.currentFaction;
    if (room.public.seats[faction]?.controller !== "ai") {
      noOp = true;
      return;
    }
    const pieces = room.public.game.pieces;
    const move = chooseComputerMove(engine, topology, pieces, faction);
    if (!move) {
      eliminateFaction(room, faction, "沒有合法走法");
      room.public.game.eventSequence += 1;
      room.public.game.lastEvent = {
        sequence: room.public.game.eventSequence,
        type: "elimination",
        faction,
        payload: { reason: "no_legal_moves" },
      };
      advanceGame(room);
      room.public.game.lastEvent.payload.nextFaction = room.public.game.currentFaction;
      room.public.game.lastEvent.payload.winner = room.public.game.winner;
      return room;
    }
    const mover = pieces.find((piece) => piece.id === move.pieceId);
    completeGameMove(room, mover, move);
    return room;
  }, undefined, false);
  if (result.committed && result.snapshot.exists()) {
    const room = result.snapshot.val();
    await ensureMatchRecord(roomCode, room);
  }
  return !noOp && result.committed;
}

async function transactComputerDrawVote(roomCode, faction) {
  const roomRef = database.ref(`threeKingdoms/rooms/${roomCode}`);
  return roomRef.transaction((room) => {
    const game = room?.public?.game;
    const offer = game?.drawOffer;
    if (!game || room.public.meta.status !== "playing" || !offer
      || room.public.seats[faction]?.controller !== "ai"
      || faction === offer.proposer || faction in offer.votes || !offer.requiredFactions.includes(faction)) return;
    const accepted = shouldComputerAcceptDraw(engine, game.pieces, faction, offer.requiredFactions);
    offer.votes[faction] = accepted;
    const votes = { ...offer.votes };
    if (!accepted) {
      game.drawOffer = null;
      game.drawDeclinedTurn = offer.turnNumber;
      game.history.push(`${factionNames[faction]}電腦拒絕和棋；提議者可繼續走棋`);
    } else if (offer.requiredFactions.every((side) => votes[side] === true)) {
      game.history.push("全體存活玩家同意和棋");
      finishAsDraw(room);
    } else {
      game.history.push(`${factionNames[faction]}電腦同意和棋`);
    }
    recordDrawEvent(room, "draw_vote", faction, {
      proposer: offer.proposer,
      voter: faction,
      accepted,
      votes,
      result: !accepted ? "rejected" : game.draw ? "accepted" : "pending",
      byComputer: true,
    });
    if (game.draw) room.public.meta.endedAt = Date.now();
    return room;
  }, undefined, false);
}

async function persistEventAndMatch(roomCode, game) {
  if (!game?.lastEvent || !game.lastEvent.sequence) return;
  const room = await findRoomByCode(roomCode);
  if (!room?.public?.meta?.matchId) return;
  await ensureMatchRecord(roomCode, room);
  const matchRef = firestore.collection("threeKingdomsMatches").doc(room.public.meta.matchId);
  const eventRef = matchRef.collection("events").doc(String(game.lastEvent.sequence).padStart(8, "0"));
  await firestore.runTransaction(async (transaction) => {
    const existing = await transaction.get(eventRef);
    if (existing.exists) return;
    transaction.create(eventRef, {
      sequence: game.lastEvent.sequence,
      type: game.lastEvent.type,
      faction: game.lastEvent.faction,
      payload: game.lastEvent.payload ?? {},
      serverTime: FieldValue.serverTimestamp(),
    });
    transaction.set(matchRef, { eventCount: FieldValue.increment(1) }, { merge: true });
  });

  if (["completed", "draw", "abandoned"].includes(room.public.meta.status)) {
    const endedAt = room.public.meta.endedAt ?? Date.now();
    await matchRef.set({
      status: room.public.meta.status === "abandoned" ? "interrupted" : room.public.meta.status === "draw" ? "draw" : "completed",
      resultType: room.public.meta.status === "abandoned" ? "interrupted" : room.public.meta.status === "draw" ? "unanimous_draw" : "victory",
      endedAt: Timestamp.fromMillis(endedAt),
      durationMs: endedAt - (room.public.meta.startedAt ?? room.public.meta.createdAt),
      winnerFaction: room.public.game?.winner ?? null,
      eliminationOrder: room.public.game?.eliminated ?? [],
      finalBoardState: room.public.game?.pieces ?? [],
    }, { merge: true });
    await pruneMatchArchive();
  }
}

async function pruneMatchArchive() {
  const archived = await firestore.collection("threeKingdomsMatches")
    .where("status", "in", ["completed", "draw", "interrupted"])
    .orderBy("endedAt", "asc")
    .limit(301)
    .get();
  if (archived.size <= 300) return;
  const oldMatches = archived.docs.slice(0, archived.size - 300);
  await Promise.all(oldMatches.map((document) => firestore.recursiveDelete(document.ref)));
}

export const threeKingdomsAuthenticate = onCall({ enforceAppCheck: true }, async (request) => {
  if (request.auth?.token?.threeKingdomsClient === true) return { uid: request.auth.uid };
  const uid = `tk-${randomUUID()}`;
  const customToken = await getAuth().createCustomToken(uid, { threeKingdomsClient: true });
  return { customToken, uid };
});

export const threeKingdomsCreateRoom = onCall({ enforceAppCheck: true }, async (request) => {
  const uid = requireAuth(request);
  const { mode, pin } = request.data ?? {};
  if (!modes[mode]) throw new HttpsError("invalid-argument", "遊玩模式無效。");
  if (!/^\d{6}$/.test(String(pin ?? ""))) throw new HttpsError("invalid-argument", "房間密碼需為 6 位數字。");
  const name = cleanName(request.data?.displayName);
  const roomCode = randomBytes(4).toString("hex").toUpperCase();
  const matchId = createMatchId();
  const now = Date.now();
  const recoveryCode = makeRecoverySecret();
  const pinSalt = randomBytes(16).toString("hex");
  const recovery = newRecoveryRecord(recoveryCode);
  const config = modes[mode];
  const autoStart = config.humans === 1;
  const room = {
    public: {
      meta: {
        roomCode,
        mode,
        status: autoStart ? "playing" : "waiting",
        createdAt: now,
        lastActivityAt: now,
        startedAt: autoStart ? now : null,
        endedAt: null,
        matchId: autoStart ? matchId : null,
        humanCount: config.humans,
      },
      seats: {
        SH: publicSeat("SH", "human", name),
        WU: publicSeat("WU", config.controllers.WU, config.controllers.WU === "open" ? null : "電腦"),
        WE: publicSeat("WE", config.controllers.WE, config.controllers.WE === "open" ? null : "電腦"),
      },
      game: autoStart ? initialGame() : null,
    },
    private: {
      access: { salt: pinSalt, pinHash: hashSecret(String(pin), pinSalt) },
      members: { [uid]: { role: "player", faction: "SH", joinedAt: now } },
      seats: { SH: { uid, recoverySalt: recovery.salt, recoveryHash: recovery.hash } },
    },
  };
  if (autoStart) {
    room.public.meta.matchSeats = factions.map((faction) => ({
      faction,
      displayName: room.public.seats[faction]?.displayName ?? "電腦",
      controller: room.public.seats[faction]?.controller === "human" ? "human" : "ai",
    }));
  }
  const roomRef = database.ref(`threeKingdoms/rooms/${roomCode}`);
  const result = await roomRef.transaction((current) => current === null ? room : undefined, undefined, false);
  if (!result.committed) throw new HttpsError("aborted", "房間代碼產生衝突，請再試一次。");
  if (autoStart) await ensureMatchRecord(roomCode, result.snapshot.val());
  return { roomCode, role: "player", faction: "SH", recoveryCode, status: room.public.meta.status };
});

export const threeKingdomsJoinRoom = onCall({ enforceAppCheck: true }, async (request) => {
  const uid = requireAuth(request);
  const { roomCode, pin } = request.data ?? {};
  const roomBefore = await verifyRoomPin(request, String(roomCode ?? "").toUpperCase(), pin);
  const name = cleanName(request.data?.displayName);
  const recoveryInput = String(request.data?.recoveryCode ?? "").trim().toUpperCase();
  const candidateMatchId = createMatchId();
  const now = Date.now();
  let assigned = { role: "spectator", faction: null, recoveryCode: null, started: false };
  let firstTransactionAttempt = true;
  const roomRef = database.ref(`threeKingdoms/rooms/${String(roomCode).toUpperCase()}`);
  const result = await roomRef.transaction((room) => {
    if (firstTransactionAttempt && !room) room = structuredClone(roomBefore);
    firstTransactionAttempt = false;
    if (!room?.public || !room?.private) return;
    assigned = { role: "spectator", faction: null, recoveryCode: null, started: false };
    const member = room.private.members?.[uid];
    let faction = member?.role === "player" ? member.faction : null;
    let recoveryCode = null;
    if (!faction && recoveryInput && ["waiting", "playing"].includes(room.public.meta.status)) {
      for (const seatFaction of factions) {
        const seat = room.private.seats?.[seatFaction];
        if (seat && secretMatches(recoveryInput, seat.recoverySalt, seat.recoveryHash)) {
          faction = seatFaction;
          recoveryCode = makeRecoverySecret();
          const recovery = newRecoveryRecord(recoveryCode);
          if (seat.uid && seat.uid !== uid) delete room.private.members[seat.uid];
          seat.uid = uid;
          seat.recoverySalt = recovery.salt;
          seat.recoveryHash = recovery.hash;
          break;
        }
      }
    }

    if (faction && room.private.seats?.[faction]?.uid === uid && ["waiting", "playing"].includes(room.public.meta.status)) {
      const wasComputer = room.public.seats[faction].controller === "ai";
      room.public.seats[faction].controller = "human";
      room.public.seats[faction].connectionState = "online";
      room.public.seats[faction].displayName = name;
      room.private.members[uid] = { role: "player", faction, joinedAt: member?.joinedAt ?? now };
      if (wasComputer) recordControlEvent(room, "player_reconnected", faction);
      assigned = { role: "player", faction, recoveryCode, started: false };
    } else if (room.public.meta.status === "waiting") {
      faction = factions.find((candidate) => room.public.seats[candidate]?.controller === "open" && !room.private.seats?.[candidate]?.uid) ?? null;
      if (faction) {
        recoveryCode = makeRecoverySecret();
        const recovery = newRecoveryRecord(recoveryCode);
        room.private.seats ??= {};
        room.private.seats[faction] = { uid, recoverySalt: recovery.salt, recoveryHash: recovery.hash };
        room.private.members[uid] = { role: "player", faction, joinedAt: now };
        room.public.seats[faction] = publicSeat(faction, "human", name);
        assigned = { role: "player", faction, recoveryCode, started: false };
      }
    }

    if (assigned.role !== "player") {
      room.private.members[uid] = { role: "spectator", joinedAt: now };
      assigned = { role: "spectator", faction: null, recoveryCode: null, started: false };
    }
    room.public.meta.lastActivityAt = now;
    const occupiedHumanSeats = factions.filter((candidate) => room.private.seats?.[candidate]?.uid).length;
    if (room.public.meta.status === "waiting" && occupiedHumanSeats >= room.public.meta.humanCount) {
      openMatch(room, candidateMatchId, now);
      assigned.started = true;
    }
    return room;
  }, undefined, false);
  if (!result.committed || !result.snapshot.exists()) throw new HttpsError("not-found", "房間已關閉。");
  const room = result.snapshot.val();
  if (room.public.meta.status === "playing" && room.public.meta.matchId) await ensureMatchRecord(String(roomCode).toUpperCase(), room);
  if (!roomBefore.public) throw new HttpsError("not-found", "房間已關閉。");
  return {
    roomCode: String(roomCode).toUpperCase(),
    role: room.private.members?.[uid]?.role ?? "spectator",
    faction: room.private.members?.[uid]?.faction ?? null,
    recoveryCode: assigned.recoveryCode,
    status: room.public.meta.status,
  };
});

export const threeKingdomsSubmitMove = onCall({ enforceAppCheck: true }, async (request) => {
  const uid = requireAuth(request);
  const roomCode = String(request.data?.roomCode ?? "").toUpperCase();
  const { from, to } = request.data ?? {};
  if (!roomCodePattern.test(roomCode) || typeof from !== "string" || typeof to !== "string") {
    throw new HttpsError("invalid-argument", "棋步資料無效。");
  }
  let failure = null;
  const result = await database.ref(`threeKingdoms/rooms/${roomCode}`).transaction((room) => {
    const member = room?.private?.members?.[uid];
    if (!room?.public?.game || room.public.meta.status !== "playing" || member?.role !== "player") {
      failure = "你目前沒有此房間的行棋席位。";
      return;
    }
    const faction = member.faction;
    const game = room.public.game;
    if (game.drawOffer) {
      failure = "和棋表決尚未完成，暫時不能走棋。";
      return;
    }
    if (game.currentFaction !== faction || room.public.seats[faction]?.controller !== "human") {
      failure = "目前不是你的回合。";
      return;
    }
    const piece = game.pieces.find((candidate) => candidate.id === request.data?.pieceId && candidate.faction === faction && candidate.nodeId === from && candidate.alive !== false);
    if (!piece) {
      failure = "找不到你指定的棋子。";
      return;
    }
    const move = engine.generatePseudoLegalMoves(piece, game.pieces).find((candidate) => candidate.to === to);
    if (!move) {
      failure = "這步棋不符合走法規則。";
      return;
    }
    completeGameMove(room, piece, move);
    return room;
  }, undefined, false);
  if (!result.committed) throw new HttpsError("failed-precondition", failure ?? "棋局狀態已更新，請重新選棋。");
  const room = result.snapshot.val();
  return { accepted: true, currentFaction: room.public.game.currentFaction, turnNumber: room.public.game.turnNumber };
});

export const threeKingdomsProposeDraw = onCall({ enforceAppCheck: true }, async (request) => {
  const uid = requireAuth(request);
  const roomCode = String(request.data?.roomCode ?? "").toUpperCase();
  if (!roomCodePattern.test(roomCode)) throw new HttpsError("invalid-argument", "房間代碼無效。");
  let failure = null;
  const result = await database.ref(`threeKingdoms/rooms/${roomCode}`).transaction((room) => {
    const member = room?.private?.members?.[uid];
    const game = room?.public?.game;
    if (!game || room.public.meta.status !== "playing" || member?.role !== "player") {
      failure = "你目前不能在此房間提出和棋。";
      return;
    }
    const proposer = member.faction;
    if (game.currentFaction !== proposer || game.drawOffer) {
      failure = "只能在自己的回合提出和棋，且目前不能已有待決提議。";
      return;
    }
    if (game.drawDeclinedTurn === game.turnNumber) {
      failure = "本回合已提議過和棋，請直接完成走棋。";
      return;
    }
    const survivors = livingFactions(game);
    const votes = { [proposer]: true };
    const aiVotes = [];
    for (const faction of survivors) {
      if (faction === proposer || room.public.seats[faction]?.controller !== "ai") continue;
      const accepted = shouldComputerAcceptDraw(engine, game.pieces, faction, survivors);
      votes[faction] = accepted;
      aiVotes.push({ faction, accepted });
    }
    const rejected = aiVotes.some((vote) => !vote.accepted);
    const allAccepted = survivors.every((faction) => votes[faction] === true);
    if (rejected) {
      game.drawDeclinedTurn = game.turnNumber;
      game.history.push(`${factionNames[proposer]}提議和棋，電腦拒絕；提議者可繼續走棋`);
    } else if (allAccepted) {
      game.history.push(`${factionNames[proposer]}提議和棋，全體同意`);
      finishAsDraw(room);
    } else {
      game.drawOffer = { proposer, turnNumber: game.turnNumber, votes, requiredFactions: survivors };
      game.history.push(`${factionNames[proposer]}提議和棋，等待其他玩家表決`);
    }
    recordDrawEvent(room, "draw_offer", proposer, {
      proposer,
      votes,
      aiVotes,
      result: rejected ? "rejected" : allAccepted ? "accepted" : "pending",
    });
    if (game.draw) room.public.meta.endedAt = Date.now();
    return room;
  }, undefined, false);
  if (!result.committed || !result.snapshot.exists()) throw new HttpsError("failed-precondition", failure ?? "房間狀態已更新，請再試一次。");
  return { accepted: true, status: result.snapshot.val().public.meta.status };
});

export const threeKingdomsVoteDraw = onCall({ enforceAppCheck: true }, async (request) => {
  const uid = requireAuth(request);
  const roomCode = String(request.data?.roomCode ?? "").toUpperCase();
  const accepted = request.data?.accepted;
  if (!roomCodePattern.test(roomCode) || typeof accepted !== "boolean") throw new HttpsError("invalid-argument", "和棋表決資料無效。");
  let failure = null;
  const result = await database.ref(`threeKingdoms/rooms/${roomCode}`).transaction((room) => {
    const member = room?.private?.members?.[uid];
    const game = room?.public?.game;
    const offer = game?.drawOffer;
    if (!game || room.public.meta.status !== "playing" || member?.role !== "player" || !offer) {
      failure = "目前沒有待表決的和棋提議。";
      return;
    }
    const voter = member.faction;
    if (!offer.requiredFactions.includes(voter) || voter === offer.proposer || game.eliminated.includes(voter) || voter in offer.votes) {
      failure = "你不需要或已經完成這次表決。";
      return;
    }
    offer.votes[voter] = accepted;
    const currentVotes = { ...offer.votes };
    if (!accepted) {
      game.drawOffer = null;
      game.drawDeclinedTurn = offer.turnNumber;
      game.history.push(`${factionNames[voter]}拒絕和棋；提議者可繼續走棋`);
    } else if (offer.requiredFactions.every((faction) => currentVotes[faction] === true)) {
      game.history.push("全體存活玩家同意和棋");
      finishAsDraw(room);
    } else {
      game.history.push(`${factionNames[voter]}同意和棋`);
    }
    recordDrawEvent(room, "draw_vote", voter, {
      proposer: offer.proposer,
      voter,
      accepted,
      votes: currentVotes,
      result: !accepted ? "rejected" : game.draw ? "accepted" : "pending",
    });
    if (game.draw) room.public.meta.endedAt = Date.now();
    return room;
  }, undefined, false);
  if (!result.committed || !result.snapshot.exists()) throw new HttpsError("failed-precondition", failure ?? "表決狀態已更新，請再試一次。");
  return { accepted: true, status: result.snapshot.val().public.meta.status };
});

export const threeKingdomsLeaveRoom = onCall({ enforceAppCheck: true }, async (request) => {
  const uid = requireAuth(request);
  const roomCode = String(request.data?.roomCode ?? "").toUpperCase();
  if (!roomCodePattern.test(roomCode)) throw new HttpsError("invalid-argument", "房間代碼無效。");
  let faction = null;
  const result = await database.ref(`threeKingdoms/rooms/${roomCode}`).transaction((room) => {
    const member = room?.private?.members?.[uid];
    if (!member) return;
    faction = member.role === "player" ? member.faction : null;
    if (faction && room.private.seats?.[faction]?.uid === uid && room.public.seats[faction]?.controller === "human") {
      room.public.seats[faction].controller = "ai";
      room.public.seats[faction].connectionState = "offline";
      recordControlEvent(room, "ai_takeover", faction);
    }
    member.offlineAt = Date.now();
    room.public.meta.lastActivityAt = Date.now();
    return room;
  }, undefined, false);
  if (result.committed && faction) {
    await transactComputerDrawVote(roomCode, faction);
    const room = await findRoomByCode(roomCode);
    if (room?.public?.meta?.status === "playing" && !room.public.game.drawOffer
      && room.public.game.currentFaction === faction && room.public.seats[faction]?.controller === "ai") {
      await transactComputerTurn(roomCode);
    }
  }
  return { left: true };
});

export const threeKingdomsOnRoomGameWritten = onValueWritten({ instance: "three-kingdoms-ot-exam-review", ref: "/threeKingdoms/rooms/{roomCode}/public/game" }, async (event) => {
  const game = event.data.after.val();
  if (!game?.lastEvent || game.lastEvent.sequence === event.data.before.val()?.lastEvent?.sequence) return;
  await persistEventAndMatch(event.params.roomCode, game);
  const room = await findRoomByCode(event.params.roomCode);
  const currentFaction = room?.public?.game?.currentFaction;
  if (room?.public?.meta?.status === "playing" && room.public.seats[currentFaction]?.controller === "ai") {
    await transactComputerTurn(event.params.roomCode);
  }
});

export const threeKingdomsOnPlayerPresenceDeleted = onValueDeleted({ instance: "three-kingdoms-ot-exam-review", ref: "/threeKingdoms/presence/{roomCode}/{uid}/{connectionId}" }, async (event) => {
  const { roomCode, uid } = event.params;
  const remainingConnections = await database.ref(`threeKingdoms/presence/${roomCode}/${uid}`).get();
  if (remainingConnections.exists()) return;
  let lostFaction = null;
  const result = await database.ref(`threeKingdoms/rooms/${roomCode}`).transaction((room) => {
    const member = room?.private?.members?.[uid];
    const faction = member?.role === "player" ? member.faction : null;
    if (!faction || room.private.seats?.[faction]?.uid !== uid || room.public.seats[faction]?.controller !== "human") return;
    lostFaction = faction;
    room.public.seats[faction].controller = "ai";
    room.public.seats[faction].connectionState = "offline";
    recordControlEvent(room, "ai_takeover", faction);
    room.public.meta.lastActivityAt = Date.now();
    return room;
  }, undefined, false);
  if (result.committed && lostFaction) {
    await transactComputerDrawVote(roomCode, lostFaction);
    const room = await findRoomByCode(roomCode);
    if (room?.public?.meta?.status === "playing" && !room.public.game.drawOffer
      && room.public.game.currentFaction === lostFaction && room.public.seats[lostFaction]?.controller === "ai") {
      await transactComputerTurn(roomCode);
    }
  }
});

export const threeKingdomsCleanupIdleRooms = onSchedule("every 1 minutes", async () => {
  const roomsSnapshot = await database.ref("threeKingdoms/rooms").get();
  if (!roomsSnapshot.exists()) return;
  const now = Date.now();
  const rooms = roomsSnapshot.val();
  for (const [roomCode, room] of Object.entries(rooms)) {
    const presence = await database.ref(`threeKingdoms/presence/${roomCode}`).get();
    if (presence.exists() || now - Number(room.public?.meta?.lastActivityAt ?? now) < roomIdleMs) continue;
    if (room.public?.game && room.public.meta.status === "playing") {
      const endedAt = now;
      room.public.meta.status = "abandoned";
      room.public.meta.endedAt = endedAt;
      room.public.game.eventSequence = (room.public.game.eventSequence ?? 0) + 1;
      room.public.game.lastEvent = {
        sequence: room.public.game.eventSequence,
        type: "match_end",
        faction: room.public.game.currentFaction,
        payload: { resultType: "interrupted", reason: "room_idle_timeout" },
      };
      await database.ref(`threeKingdoms/rooms/${roomCode}`).set(room);
      await ensureMatchRecord(roomCode, room);
      await persistEventAndMatch(roomCode, room.public.game);
    }
    await Promise.all([
      database.ref(`threeKingdoms/rooms/${roomCode}`).remove(),
      database.ref(`threeKingdoms/presence/${roomCode}`).remove(),
    ]);
  }
});

