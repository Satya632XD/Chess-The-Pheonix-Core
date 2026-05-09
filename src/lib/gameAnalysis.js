export const MOVE_CLASSIFICATIONS = {
  BEST: 'Best',
  EXCELLENT: 'Excellent',
  GREAT: 'Great',
  GOOD: 'Good',
  BOOK: 'Book',
  BRILLIANT: 'Brilliant',
  MISS: 'Miss',
  INACCURACY: 'Inaccuracy',
  MISTAKE: 'Mistake',
  BLUNDER: 'Blunder',
  FORCED: 'Forced',
};

export const CLASSIFICATION_COLOR = {
  Best: '#00C853',
  Excellent: '#00E676',
  Great: '#26A69A',
  Good: '#8BC34A',
  Book: '#795548',
  Brilliant: '#00B0FF',
  Miss: '#E91E63',
  Inaccuracy: '#FFC107',
  Mistake: '#FF9800',
  Blunder: '#F44336',
  Forced: '#9E9E9E',
};

export const CLASSIFICATION_EMOJI = {
  Best: '⭐',
  Excellent: '🔥',
  Great: '💡',
  Good: '👍',
  Book: '📖',
  Brilliant: '💎',
  Miss: '❗',
  Inaccuracy: '⚠️',
  Mistake: '❌',
  Blunder: '💥',
  Forced: '🔒',
};

export function detectBrilliant(move, prevEval, newEval, bestEval) {
  if (!move) return false;

  const isSacrifice =
    move.captured === undefined &&
    ['q', 'r', 'b', 'n'].includes(move.piece);

  const evalStayedGood = newEval >= prevEval - 30;

  const closeToBest = Math.abs(bestEval - newEval) < 20;

  return (
    isSacrifice &&
    evalStayedGood &&
    closeToBest
  );
}

export function classifyMove({
  move,
  loss,
  moveNumber,
  legalMoves,
  prevEval,
  newEval,
  bestEval,
}) {
  if (moveNumber <= 10) {
    return 'Book';
  }

  if (legalMoves === 1) {
    return 'Forced';
  }

  if (detectBrilliant(move, prevEval, newEval, bestEval)) {
    return 'Brilliant';
  }

  if (prevEval > 250 && newEval < 80) {
    return 'Miss';
  }

  if (loss <= 5) return 'Best';
  if (loss <= 15) return 'Excellent';
  if (loss <= 30) return 'Great';
  if (loss <= 60) return 'Good';
  if (loss <= 100) return 'Inaccuracy';
  if (loss <= 250) return 'Mistake';

  return 'Blunder';
}

function moveAccuracy(loss) {
  if (loss <= 5) return 100;
  if (loss <= 15) return 98;
  if (loss <= 30) return 95;
  if (loss <= 60) return 90;
  if (loss <= 100) return 75;
  if (loss <= 250) return 50;

  return 15;
}

export function analyzeGame(moves) {
  const analysis = {
    total_moves: moves.length,
    classifications: {},
    accuracy: 0,
    acpl: 0,
    blunders: [],
    brilliantMoves: [],
    turning_point: null,
    evalGraph: [],
  };

  Object.values(MOVE_CLASSIFICATIONS).forEach((cls) => {
    analysis.classifications[cls] = 0;
  });

  let accuracySum = 0;
  let totalEvalLoss = 0;

  moves.forEach((move, index) => {
    const loss = Math.abs(
      move.bestEval - move.playedEval
    );

    totalEvalLoss += loss;

    const classification = classifyMove({
      move,
      loss,
      moveNumber: index + 1,
      legalMoves: move.legalMoves || 20,
      prevEval: move.prevEval || 0,
      newEval: move.playedEval,
      bestEval: move.bestEval,
    });

    move.classification = classification;

    analysis.classifications[classification]++;

    accuracySum += moveAccuracy(loss);

    if (classification === 'Blunder') {
      analysis.blunders.push({
        turn: index + 1,
        move: move.san,
        evalLoss: loss,
      });
    }

    if (classification === 'Brilliant') {
      analysis.brilliantMoves.push({
        turn: index + 1,
        move: move.san,
      });
    }

    analysis.evalGraph.push(move.playedEval);
  });

  analysis.accuracy = Math.round(
    accuracySum / moves.length
  );

  analysis.acpl = Math.round(
    totalEvalLoss / moves.length
  );

  let biggestSwing = 0;

  for (let i = 1; i < moves.length; i++) {
    const swing = Math.abs(
      moves[i].playedEval -
      moves[i - 1].playedEval
    );

    if (swing > biggestSwing) {
      biggestSwing = swing;
      analysis.turning_point = i + 1;
    }
  }

  return analysis;
}

export const COACH_PERSONAS = {
  BRUTAL: {
    name: 'Brutal Coach',
    emoji: '🔥',
    getComment: (analysis) => {
      if (analysis.blunders.length > 5) {
        return 'Too many blunders. Tactical training needed immediately.';
      }

      if (analysis.accuracy < 60) {
        return 'Very inconsistent play.';
      }

      return 'Playable game but still many inaccuracies.';
    },
  },

  FRIENDLY: {
    name: 'Friendly Coach',
    emoji: '😊',
    getComment: (analysis) => {
      if (analysis.brilliantMoves.length > 0) {
        return `Amazing! You found ${analysis.brilliantMoves.length} brilliant move(s)!`;
      }

      if (analysis.accuracy > 80) {
        return 'Excellent game overall!';
      }

      return 'Good effort. Keep practicing.';
    },
  },

  MEME: {
    name: 'Meme Coach',
    emoji: '🤡',
    getComment: (analysis) => {
      if (analysis.blunders.length > 3) {
        return 'Stockfish wants to know your location 💀';
      }

      return 'This was definitely a chess game 😭';
    },
  },

  ANALYTICAL: {
    name: 'Analytical Coach',
    emoji: '🧠',
    getComment: (analysis) => {
      return `Accuracy ${analysis.accuracy}% | ACPL ${analysis.acpl} | Blunders ${analysis.blunders.length}`;
    },
  },
};
