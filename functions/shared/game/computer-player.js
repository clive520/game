import { applyMoveToPieces } from "./move-engine.js";

const PIECE_VALUE = { general: 10000, rook: 9, cannon: 5, horse: 4, elephant: 2, advisor: 2, pawn: 1 };
const BOARD_CENTER = { x: 478.5, y: 390 };

function threatMap(engine, pieces, { attackerFaction = null, victimFaction = null } = {}) {
  const activePieces = pieces.filter((piece) => piece.alive !== false && piece.nodeId);
  const byId = new Map(activePieces.map((piece) => [piece.id, piece]));
  const threatened = new Map();
  for (const attacker of activePieces) {
    if (attackerFaction && attacker.faction !== attackerFaction) continue;
    for (const move of engine.generatePseudoLegalMoves(attacker, pieces)) {
      if (!move.captureId) continue;
      const target = byId.get(move.captureId);
      if (!target || target.faction === attacker.faction || (victimFaction && target.faction !== victimFaction)) continue;
      const attackers = threatened.get(target.id) ?? new Set();
      attackers.add(attacker.id);
      threatened.set(target.id, attackers);
    }
  }
  return { byId, threatened };
}

function vulnerabilityScore(engine, pieces, faction) {
  const { byId, threatened } = threatMap(engine, pieces, { victimFaction: faction });
  let score = 0;
  for (const [pieceId, attackers] of threatened) {
    const piece = byId.get(pieceId);
    if (!piece) continue;
    if (piece.type === "general") score += 100000 + Math.max(0, attackers.size - 1) * 15000;
    else score += (PIECE_VALUE[piece.type] ?? 1) * (8 + Math.max(0, attackers.size - 1) * 3);
  }
  return score;
}

function attackPressureScore(engine, pieces, faction) {
  const { byId, threatened } = threatMap(engine, pieces, { attackerFaction: faction });
  let score = 0;
  for (const [pieceId, attackers] of threatened) {
    const target = byId.get(pieceId);
    if (!target || target.faction === faction) continue;
    if (target.type === "general") score += 30000;
    else score += (PIECE_VALUE[target.type] ?? 1) * (1.5 + Math.max(0, attackers.size - 1) * 0.4);
  }
  return score;
}

function scoreMove(engine, topology, move, pieces, faction, baseline) {
  const target = move.captureId ? pieces.find((piece) => piece.id === move.captureId) : null;
  const mover = pieces.find((piece) => piece.id === move.pieceId);
  const resultingPieces = applyMoveToPieces(pieces, move).pieces;
  let score = target ? (PIECE_VALUE[target.type] ?? 1) * 10 : 0;
  if (target?.type === "general") score += 100000;

  score += (baseline.safety - vulnerabilityScore(engine, resultingPieces, faction)) * 0.9;
  score += (attackPressureScore(engine, resultingPieces, faction) - baseline.pressure) * 0.8;

  const destination = topology.nodesById.get(move.to);
  const origin = topology.nodesById.get(move.from);
  if (destination && origin) {
    const fromDistance = Math.hypot(origin.x - BOARD_CENTER.x, origin.y - BOARD_CENTER.y);
    const toDistance = Math.hypot(destination.x - BOARD_CENTER.x, destination.y - BOARD_CENTER.y);
    score += (fromDistance - toDistance) * 0.035;
  }
  if (mover?.type === "pawn" && destination?.faction !== origin?.faction) score += 1.5;
  return score;
}

export function chooseComputerMove(engine, topology, pieces, faction) {
  const moves = pieces
    .filter((piece) => piece.alive !== false && piece.nodeId && piece.faction === faction)
    .flatMap((piece) => engine.generatePseudoLegalMoves(piece, pieces));
  if (!moves.length) return null;

  const baseline = {
    safety: vulnerabilityScore(engine, pieces, faction),
    pressure: attackPressureScore(engine, pieces, faction),
  };
  return moves
    .map((move) => ({ move, score: scoreMove(engine, topology, move, pieces, faction, baseline) + Math.random() * 1.5 }))
    .sort((a, b) => b.score - a.score)[0].move;
}
