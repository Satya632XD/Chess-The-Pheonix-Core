// src/lib/stockfishEngine.js
//
// FIX SUMMARY:
// - initEngine() no longer resolves unconditionally on an 8s timeout; it now
//   rejects on true failure and only resolves once uciok -> isready -> readyok
//   has actually completed, so callers never search on a half-initialized engine.
// - All searches (evaluatePosition) are funneled through a single `queue`
//   promise chain. The old version overwrote engine.onmessage on every call
//   with no serialization, so back-to-back calls (like AnalysisMode's PGN
//   loop) could stomp each other's handler and leave a promise unresolved
//   forever. That was the root cause of Analysis Mode freezing.
// - Every search now pairs `go depth N` with a `movetime` cap, so a slow
//   position can't run away past our own timeout budget.

let engine = null;
let ready = false;
let initPromise = null;
let queue = Promise.resolve();

function getUrl() {
  const base = import.meta?.env?.BASE_URL || '/';
  return `${base}stockfish.js`;
}

export async function initEngine() {
  if (ready) return;
  if (initPromise) return initPromise;

  initPromise = new Promise((resolve, reject) => {
    try {
      engine = new Worker(getUrl());
    } catch (e) {
      initPromise = null;
      reject(e);
      return;
    }

    let uciOk = false;
    let readyOk = false;

    const timeout = setTimeout(() => {
      if (!ready) {
        initPromise = null;
        reject(new Error('Stockfish init timeout'));
      }
    }, 10000);

    engine.onerror = (e) => {
      clearTimeout(timeout);
      initPromise = null;
      reject(new Error('Stockfish worker error: ' + (e.message || 'unknown')));
    };

    engine.onmessage = (e) => {
      const line = typeof e.data === 'string' ? e.data : '';
      if (line === 'uciok') {
        uciOk = true;
        engine.postMessage('isready');
      }
      if (line === 'readyok' && uciOk && !readyOk) {
        readyOk = true;
        ready = true;
        clearTimeout(timeout);
        engine.postMessage(
          'setoption name Threads value ' +
            Math.max(1, Math.min(4, navigator.hardwareConcurrency || 1))
        );
        engine.postMessage('setoption name Hash value 128');
        resolve();
      }
    };

    engine.postMessage('uci');
  });

  return initPromise;
}

// Serialized single-search executor. Only one of these should ever be
// in flight against `engine` at a time (enforced by the `queue` chain
// in evaluatePosition below) — this prevents overlapping onmessage
// handlers from stomping each other and hanging promises.
function runSearch(commands, depth, moveTime = 4000) {
  return new Promise((resolve, reject) => {
    if (!engine || !ready) {
      reject(new Error('Engine not ready'));
      return;
    }

    let latestEval = 0;
    let bestMove = null;
    let pv = '';
    let mate = null;
    let settled = false;

    // FIX: was 8000ms against a `movetime 4000` engine instruction — nearly
    // double the intended wait on every single call. Now dynamic based on
    // moveTime: a 500ms buffer over the engine's own movetime budget, enough
    // for message round-trip without doubling worst-case latency across an 80-call loop.
    const timeout = setTimeout(() => {
      if (settled) return;
      settled = true;
      try { engine.postMessage('stop'); } catch {}
      resolve({ eval: latestEval, bestMove, pv, mate, depth });
    }, moveTime + 500);

    engine.onmessage = (e) => {
      const line = typeof e.data === 'string' ? e.data : '';
      if (!line) return;

      if (line.includes('score cp')) {
        const m = line.match(/score cp (-?\d+)/);
        if (m) latestEval = parseInt(m[1], 10);
      }
      if (line.includes('score mate')) {
        const m = line.match(/score mate (-?\d+)/);
        if (m) {
          mate = parseInt(m[1], 10);
          latestEval = mate > 0 ? 100000 - mate : -100000 - mate;
        }
      }
      if (line.includes(' pv ')) {
        const m = line.match(/ pv (.+)/);
        if (m) pv = m[1].trim();
      }
      if (line.startsWith('bestmove')) {
        if (settled) return;
        settled = true;
        clearTimeout(timeout);
        const parts = line.split(' ');
        bestMove = parts[1] !== '(none)' ? parts[1] : null;
        resolve({ eval: latestEval, bestMove, pv, mate, depth });
      }
    };

    for (const cmd of commands) engine.postMessage(cmd);
  });
}

// Public API — every call goes through `queue` so calls never overlap and
// never drop/hang on a stomped onmessage handler.
export function evaluatePosition(fen, depth = 12, moveTime = 4000) {
  const task = async () => {
    await initEngine();
    const sideToMove = fen.split(' ')[1] === 'b' ? 'black' : 'white';
    const result = await runSearch(
      [`position fen ${fen}`, `go depth ${depth} movetime ${moveTime}`],
      depth,
      moveTime
    );
    // Normalize to White-positive perspective.
    const normalizedEval = sideToMove === 'black' ? -result.eval : result.eval;
    return { ...result, eval: normalizedEval, sideToMove };
  };

  const result = queue.then(task);
  // Keep the chain alive even if this task rejects, so one bad position
  // doesn't permanently jam every future call.
  queue = result.then(() => {}, () => {});
  return result;
}

export function terminateEngine() {
  try {
    engine?.postMessage('quit');
    engine?.terminate();
  } catch {}
  engine = null;
  ready = false;
  initPromise = null;
  queue = Promise.resolve();
}
