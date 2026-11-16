const MATERIAL_VALUE = { rook: 9, cannon: 5, horse: 4, elephant: 2, advisor: 2, pawn: 1, general: 10 };

export function shouldComputerAcceptDraw(engine, pieces, faction, livingFactions) {
  const active = pieces.filter((piece) => piece.alive !== false && piece.nodeId && livingFactions.includes(piece.faction));
  const material = Object.fromEntries(livingFactions.map((side) => [
    side,
    active.filter((piece) => piece.faction === side).reduce((sum, piece) => sum + (MATERIAL_VALUE[piece.type] ?? 1), 0),
  ]));
  const own = material[faction] ?? 0;
  const average = Object.values(material).reduce((sum, value) => sum + value, 0) / Math.max(1, livingFactions.length);
  const general = active.find((piece) => piece.faction === faction && piece.type === "general");
  const generalThreatened = Boolean(general && active
    .filter((piece) => piece.faction !== faction)
    .some((piece) => engine.generatePseudoLegalMoves(piece, pieces).some((move) => move.captureId === general.id)));

  const roughlyEven = own >= average * 0.9 && own <= average * 1.1;
  const latePosition = average < 59 * 0.55;
  // The computer avoids early draws, but accepts when behind, threatened, or late and even.
  return generalThreatened || own < average * 0.82 || (latePosition && roughlyEven);
}
