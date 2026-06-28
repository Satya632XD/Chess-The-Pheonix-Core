export function formatCentipawns(value) {
  if (typeof value !== 'number') return '0.00';

  const pawns = value / 100;
  const sign = pawns > 0 ? '+' : '';

  return `${sign}${pawns.toFixed(2)}`;
}

export function explainMove(move) {
  const loss = move.evalLoss ?? Math.max(0, move.bestEval - move.playedEval);
  const bestMove = move.bestMove || 'the engine recommendation';
  const played = move.san || move.lan || 'the move';
  const evalText = `${formatCentipawns(move.playedEval)} from the mover's point of view`;

  if (move.classification === 'Best') {
    return `${played} matches the engine idea (${bestMove}) and keeps the evaluation at ${evalText}.`;
  }

  if (move.classification === 'Excellent' || move.classification === 'Great') {
    return `${played} is very close to best. It gives up only ${formatCentipawns(loss)} compared with ${bestMove}.`;
  }

  if (move.classification === 'Good') {
    return `${played} is playable, but ${bestMove} was more accurate. The practical loss is ${formatCentipawns(loss)}.`;
  }

  if (move.classification === 'Inaccuracy') {
    return `${played} slightly worsens the position. Look at ${bestMove} because it preserves more pressure or defensive resources.`;
  }

  if (move.classification === 'Mistake') {
    return `${played} is a mistake because it drops about ${formatCentipawns(loss)}. ${bestMove} was the safer engine line.`;
  }

  if (move.classification === 'Blunder') {
    return `${played} is a blunder: it changes the evaluation by about ${formatCentipawns(loss)}. The key improvement is to find ${bestMove}.`;
  }

  if (move.classification === 'Forced') {
    return `${played} was forced because there was only one legal move.`;
  }

  if (move.classification === 'Book') {
    return `${played} is treated as opening book in this early phase of the game.`;
  }

  if (move.classification === 'Brilliant') {
    return `${played} is a strong tactical idea that stays close to the best engine evaluation.`;
  }

  return `${played} was evaluated at ${evalText}. Engine preference: ${bestMove}.`;
}

export function buildAnalysisText(game, analysis, notes = {}) {
  const lines = [
    'Phoenix Chess Analysis Report',
    '==============================',
    '',
    `Accuracy: ${analysis.accuracy}%`,
    `ACPL: ${analysis.acpl}`,
    `Total moves: ${analysis.total_moves}`,
    `Blunders: ${analysis.blunders.length}`,
    `Brilliant moves: ${analysis.brilliantMoves.length}`,
    '',
    'Move-by-move analysis:',
  ];

  game.moveHistory.forEach((move, index) => {
    const prefix = move.side === 'b' ? `${move.moveNumber}...` : `${move.moveNumber}.`;

    lines.push(
      '',
      `${prefix} ${move.san} — ${move.classification}`,
      `Evaluation: ${formatCentipawns(move.playedEval)}`,
      `Best move: ${move.bestMove || 'n/a'}`,
      `Principal variation: ${move.pv || 'n/a'}`,
      `Explanation: ${move.explanation || explainMove(move)}`
    );

    if (notes[index]) {
      lines.push(`Player note: ${notes[index]}`);
    }
  });

  return `${lines.join('\n')}\n`;
}

export function downloadTextFile(filename, contents) {
  const blob = new Blob([contents], {
    type: 'text/plain;charset=utf-8',
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');

  link.href = url;
  link.download = filename;
  link.click();

  URL.revokeObjectURL(url);
}
