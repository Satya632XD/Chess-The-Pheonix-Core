// src/lib/stockfishEngine.js

let engine = null;

export async function initEngine() {
  return new Promise((resolve, reject) => {
    if (engine) { resolve(); return; }

    // Try the actual file in /public first, then fallback paths
    const sources = [
      '/stockfish.js',
      '/stockfish.wasm.js',

    const trySource = (i) => {
      if (i >= sources.length) {
        reject(new Error('Failed to load Stockfish engine'));
        return;
      }
      try {
        engine = new Worker(sources[i]);
        engine.onerror = () => {
          engine = null;
          trySource(i + 1);
        };
        engine.postMessage('uci');
        engine.onmessage = (e) => {
          if (e.data === 'uciok') {
            engine.postMessage('isready');
          }
          if (e.data === 'readyok') {
            resolve();
          }
        };
        // Timeout after 8 seconds per source
        setTimeout(() => {
          if (engine) resolve(); // resolve anyway if engine exists
        }, 8000);
      } catch {
        trySource(i + 1);
      }
    };

    trySource(0);
  });
}

export async function evaluatePosition(
  fen,
  depth = 12
) {
  return new Promise((resolve) => {
    let latestEval = 0;

    let bestMove = null;

    let pv = '';

    let mate = null;

    engine.onmessage = (e) => {
      const line = e.data;

      // CENTIPAWN SCORE
      if (
        line.includes(
          'score cp'
        )
      ) {
        const match =
          line.match(
            /score cp (-?\d+)/
          );

        if (match) {
          latestEval =
            parseInt(
              match[1]
            );
        }
      }

      // MATE SCORE
      if (
        line.includes(
          'score mate'
        )
      ) {
        const mateMatch =
          line.match(
            /score mate (-?\d+)/
          );

        if (mateMatch) {
          mate =
            parseInt(
              mateMatch[1]
            );

          // HUGE VALUE FOR MATES
          latestEval =
            mate > 0
              ? 10000 -
                mate
              : -10000 -
                mate;
        }
      }

      // PV
      if (
        line.includes(
          ' pv '
        )
      ) {
        const pvMatch =
          line.match(
            / pv (.+)/
          );

        if (pvMatch) {
          pv =
            pvMatch[1];
        }
      }

      // BESTMOVE
      if (
        line.includes(
          'bestmove'
        )
      ) {
        const parts =
          line.split(
            ' '
          );

        bestMove =
          parts[1];

        // NORMALIZE EVAL
        // POSITIVE = WHITE BETTER
        // NEGATIVE = BLACK BETTER

        const sideToMove =
          fen.includes(
            ' w '
          )
            ? 'white'
            : 'black';

        let normalizedEval =
          latestEval;

        if (
          sideToMove ===
          'black'
        ) {
          normalizedEval =
            -normalizedEval;
        }

        resolve({
          eval:
            normalizedEval,
          bestMove,
          pv,
          mate,
          depth,
        });
      }
    };

    engine.postMessage(
      `position fen ${fen}`
    );

    engine.postMessage(
      `go depth ${depth}`
    );
  });
        }
