const FILES = "ABCDEFGHI";
const FACTIONS = ["SH", "WU", "WE"];

const PIECE_ALIASES = new Map([
  ["將", "general"], ["帥", "general"], ["general", "general"], ["king", "general"],
  ["士", "advisor"], ["advisor", "advisor"],
  ["象", "elephant"], ["相", "elephant"], ["elephant", "elephant"],
  ["馬", "horse"], ["傌", "horse"], ["horse", "horse"],
  ["車", "rook"], ["rook", "rook"],
  ["炮", "cannon"], ["砲", "cannon"], ["cannon", "cannon"],
  ["兵", "pawn"], ["卒", "pawn"], ["pawn", "pawn"],
]);

function coordinate(nodeId) {
  const match = nodeId?.match(/^(SH|WE|WU)-([A-I])([0-4])$/);
  return match ? { faction: match[1], fileIndex: FILES.indexOf(match[2]), rank: Number(match[3]) } : null;
}

function normalizePieceType(type) { return PIECE_ALIASES.get(type) ?? type; }
function isActive(piece) { return piece && piece.alive !== false && piece.nodeId; }
function pairKey(a, b) { return [a, b].sort().join("|"); }

export function createMoveEngine(topology) {
  const nodes = new Map(topology.nodes.map((node) => [node.id, node]));
  const edgesByPair = new Map();
  const adjacent = new Map([...nodes.keys()].map((id) => [id, []]));
  for (const edge of topology.edges) {
    const key = pairKey(edge.from, edge.to);
    const list = edgesByPair.get(key) ?? [];
    list.push(edge);
    edgesByPair.set(key, list);
    adjacent.get(edge.from)?.push({ id: edge.to, edge });
    adjacent.get(edge.to)?.push({ id: edge.from, edge });
  }
  const hasEdgeKind = (a, b, ...kinds) => (edgesByPair.get(pairKey(a, b)) ?? []).some((edge) => kinds.includes(edge.kind));

  function makeMove(piece, to, options = {}) {
    if (!nodes.has(piece.nodeId) || !nodes.has(to) || piece.nodeId === to) return null;
    return {
      pieceId: piece.id,
      from: piece.nodeId,
      to,
      ...(options.legNode ? { legNode: options.legNode } : {}),
      ...(options.captureId ? { captureId: options.captureId } : {}),
      ...(options.nextDirectionFaction ? { nextDirectionFaction: options.nextDirectionFaction } : {}),
    };
  }

  function resolveDestination(piece, to, occupancy, options = {}) {
    const occupant = occupancy.get(to);
    if (occupant?.id === piece.id || (occupant && occupant.faction === piece.faction)) return null;
    return makeMove(piece, to, { ...options, captureId: occupant?.id });
  }

  function getSlidingMoves(piece, occupancy, cannon) {
    const allowed = new Set([
      "local-file", "local-rank", "outer-boundary", "river-shoreline",
      "river-continuation", "central-link", "outer-connector",
    ]);
    const found = new Map();
    for (const line of topology.lineRuns ?? []) {
      if (!allowed.has(line.kind)) continue;
      const originIndex = line.nodes.indexOf(piece.nodeId);
      if (originIndex < 0) continue;
      for (const direction of [-1, 1]) {
        let screens = 0;
        for (let index = originIndex + direction; index >= 0 && index < line.nodes.length; index += direction) {
          const to = line.nodes[index];
          const occupant = occupancy.get(to);
          if (!cannon) {
            if (!occupant) found.set(to, { to });
            else {
              if (occupant.faction !== piece.faction) found.set(to, { to, captureId: occupant.id });
              break;
            }
          } else if (screens === 0) {
            if (!occupant) found.set(to, { to });
            else screens = 1;
          } else if (occupant) {
            if (occupant.faction !== piece.faction) found.set(to, { to, captureId: occupant.id });
            break;
          }
        }
      }
    }
    return [...found.values()].map((candidate) => makeMove(piece, candidate.to, candidate)).filter(Boolean);
  }

  function getHorseMoves(piece, occupancy) {
    const longKinds = new Set(["local-file", "local-rank", "outer-boundary", "river-shoreline", "river-continuation", "central-link"]);
    const found = new Map();
    for (const line of topology.lineRuns ?? []) {
      if (!longKinds.has(line.kind)) continue;
      const originIndex = line.nodes.indexOf(piece.nodeId);
      if (originIndex < 0) continue;
      for (const direction of [-1, 1]) {
        const legIndex = originIndex + direction;
        const landingIndex = originIndex + 2 * direction;
        if (legIndex < 0 || landingIndex < 0 || landingIndex >= line.nodes.length) continue;
        const legNode = line.nodes[legIndex];
        const pivot = line.nodes[landingIndex];
        if (occupancy.has(legNode)) continue;
        for (const neighbor of adjacent.get(pivot) ?? []) {
          if (line.nodes.includes(neighbor.id)) continue;
          const move = resolveDestination(piece, neighbor.id, occupancy, { legNode });
          if (move) found.set(`${move.to}|${legNode}`, move);
        }
      }
    }
    return [...found.values()];
  }

  function getPawnMoves(piece, occupancy) {
    const origin = coordinate(piece.nodeId);
    if (!origin) return [];
    const candidates = [];
    const forward = origin.rank < 4 ? `${origin.faction}-${FILES[origin.fileIndex]}${origin.rank + 1}` : null;
    if (forward && hasEdgeKind(piece.nodeId, forward, "local-rank", "outer-boundary", "central-link")) {
      candidates.push({ to: forward, nextDirectionFaction: nodes.get(forward)?.faction });
    }
    for (const neighbor of adjacent.get(piece.nodeId) ?? []) {
      const targetFaction = nodes.get(neighbor.id)?.faction;
      const countryBridge = neighbor.edge.kind === "central-link" && targetFaction !== origin.faction;
      if (["river-crossing", "outer-connector"].includes(neighbor.edge.kind) || countryBridge) {
        candidates.push({ to: neighbor.id, nextDirectionFaction: targetFaction });
      } else if (["local-file", "river-shoreline", "outer-boundary", "central-link"].includes(neighbor.edge.kind)) {
        const target = coordinate(neighbor.id);
        if (target && target.faction === origin.faction && target.rank === origin.rank && Math.abs(target.fileIndex - origin.fileIndex) === 1) {
          candidates.push({ to: neighbor.id, nextDirectionFaction: target.faction });
        }
      }
    }
    const unique = new Map();
    for (const candidate of candidates) {
      const move = resolveDestination(piece, candidate.to, occupancy, candidate);
      if (move) unique.set(move.to, move);
    }
    return [...unique.values()];
  }

  function generatePseudoLegalMoves(piece, pieces) {
    if (!isActive(piece) || !nodes.has(piece.nodeId)) return [];
    const occupancy = new Map(pieces.filter(isActive).map((item) => [item.nodeId, item]));
    const type = normalizePieceType(piece.type);
    if (type === "rook") return getSlidingMoves(piece, occupancy, false);
    if (type === "cannon") return getSlidingMoves(piece, occupancy, true);
    if (type === "horse") return getHorseMoves(piece, occupancy);
    if (type === "pawn") return getPawnMoves(piece, occupancy);

    const origin = coordinate(piece.nodeId);
    if (!origin) return [];
    if (["general", "advisor", "elephant"].includes(type) && origin.faction !== piece.faction) return [];
    const deltas = type === "general"
      ? [[1, 0], [-1, 0], [0, 1], [0, -1]]
      : type === "advisor"
        ? [[1, 1], [1, -1], [-1, 1], [-1, -1]]
        : type === "elephant"
          ? [[2, 2], [2, -2], [-2, 2], [-2, -2]]
          : [];
    const candidates = [];
    for (const [fileDelta, rankDelta] of deltas) {
      const fileIndex = origin.fileIndex + fileDelta;
      const rank = origin.rank + rankDelta;
      if (fileIndex < 0 || fileIndex >= FILES.length || rank < 0 || rank > 4) continue;
      const to = `${origin.faction}-${FILES[fileIndex]}${rank}`;
      if (!nodes.has(to)) continue;
      if (type === "general" && !(fileIndex >= 3 && fileIndex <= 5 && rank <= 2)) continue;
      if (type === "advisor" && !hasEdgeKind(piece.nodeId, to, "palace-diagonal")) continue;
      if (type === "elephant") {
        const eye = `${origin.faction}-${FILES[origin.fileIndex + fileDelta / 2]}${origin.rank + rankDelta / 2}`;
        if (!nodes.has(eye) || occupancy.has(eye) || nodes.get(to).faction !== piece.faction || nodes.get(to).rank > 2) continue;
        candidates.push({ to, legNode: eye });
      } else candidates.push({ to });
    }
    return candidates.map((candidate) => {
      if (candidate.legNode && occupancy.has(candidate.legNode)) return null;
      return resolveDestination(piece, candidate.to, occupancy, candidate);
    }).filter(Boolean);
  }

  return { nodes, generatePseudoLegalMoves };
}

export function generatePseudoLegalMoves(topology, piece, pieces) {
  return createMoveEngine(topology).generatePseudoLegalMoves(piece, pieces);
}

export function applyMoveToPieces(pieces, move) {
  const mover = pieces.find((piece) => piece.id === move.pieceId);
  if (!mover) throw new Error(`Unknown moving piece: ${move.pieceId}`);
  const captured = move.captureId ? pieces.find((piece) => piece.id === move.captureId) : null;
  const capturedGeneral = captured && normalizePieceType(captured.type) === "general";
  const eliminatedFactions = capturedGeneral ? [captured.faction] : [];
  const nextPieces = pieces.map((piece) => {
    if (piece.id === mover.id) {
      return { ...piece, nodeId: move.to, ...(move.nextDirectionFaction ? { directionFaction: move.nextDirectionFaction } : {}) };
    }
    if (capturedGeneral && piece.faction === captured.faction) return { ...piece, alive: false, nodeId: null };
    if (captured && piece.id === captured.id) return { ...piece, alive: false, nodeId: null };
    return piece;
  });
  return { pieces: nextPieces, eliminatedFactions };
}

export function nextLivingFaction(currentFaction, eliminatedFactions = [], turnOrder = FACTIONS) {
  const eliminated = new Set(eliminatedFactions);
  const currentIndex = turnOrder.indexOf(currentFaction);
  for (let offset = 1; offset <= turnOrder.length; offset += 1) {
    const candidate = turnOrder[(currentIndex + offset + turnOrder.length) % turnOrder.length];
    if (!eliminated.has(candidate)) return candidate;
  }
  return null;
}

export { FACTIONS };
