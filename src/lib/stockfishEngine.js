let engine = null;

function normalizeEval(score, mate) {
  if (mate !== null) {
    if (mate > 0) {
      return 10000 - mate;
    }

    return -10000 - mate;
  }

  return score;
}

export async function initEngine() {
  return new Promise((resolve) => {
    if (engine) {
      resolve();
      return;
    }

    engine = new Worker('/stockfish.js');

    engine.postMessage('uci');

    engine.onmessage = (e) => {
      const line = e.data;

      if (line === 'uciok') {
        resolve();
      }
    };
  });
}

export async function evaluatePosition(
  fen,
  depth = 12
) {
  return new Promise((resolve) => {
    let latestEval = 0;
    let mate = null;
    let bestMove = '';
    let pv = '';

    engine.onmessage = (e) => {
      const line = e.data;

      // Centipawn score
      if (line.includes('score cp')) {
        const match =
          line.match(/score cp (-?\d+)/);

        if (match) {
          latestEval = parseInt(match[1]);
          mate = null;
        }
      }

      // Mate score
      if (line.includes('score mate')) {
        const mateMatch =
          line.match(/score mate (-?\d+)/);

        if (mateMatch) {
          mate = parseInt(mateMatch[1]);
        }
      }

      // Principal variation
      if (line.includes(' pv ')) {
        const pvMatch =
          line.match(/ pv (.+)/);

        if (pvMatch) {
          pv = pvMatch[1];
        }
      }

      // Final best move
      if (line.includes('bestmove')) {
        const parts = line.split(' ');
        bestMove = parts[1];

        const sideToMove =
          fen.split(' ')[1];

        let finalEval =
          normalizeEval(
            latestEval,
            mate
          );

        // Make positive always mean White advantage
        if (sideToMove === 'b') {
          finalEval = -finalEval;
        }

        resolve({
          eval: finalEval,
          rawEval: latestEval,
          mate,
          bestMove,
          pv,
          depth,
        });
      }
    };

    engine.postMessage('ucinewgame');

    engine.postMessage(
      `position fen ${fen}`
    );

    engine.postMessage(
      `go depth ${depth}`
    );
  });
}
