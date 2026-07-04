// src/engine/stockfishBot.js
// Phoenix Stockfish Bot
// - Uses local /public/stockfish.js
// - Waits for proper UCI readiness
// - Supports MultiPV
// - Keeps the same public API used by engineManager.js
//
// FIX (search/timeout pairing): search() always pairs `go depth N` with a
// `movetime` cap (UCI stops at whichever limit hits first).
//
// FIX (eval-aware move pool): topMoves[] now stores {move, eval, depth,
// seldepth} instead of just {move, depth, seldepth}. `eval` is the raw
// `score cp` (or mate-converted) value reported by the engine for that PV
// line, from the side-to-move's perspective (UCI convention — NOT
// normalized to White-positive here; callers that need White-positive
// should convert using the position's side-to-move, same as
// stockfishEngine.js does for its own eval channel).
//
// This lets callers implement an eval-gap check before downgrading to a
// "weaker" move for bot personality (e.g. don't play move #2 over move #1
// unless the eval difference is small) instead of blindly discarding the
// engine's actual best move at a fixed rate.

let engine = null;
let initPromise = null;
let initialized = false;
let failed = false;

let searchId = 0;
let currentSearch = null;

// Resolve this when a fresh "ucinewgame" finishes its ready handshake
let newGameWaiters = [];

const MAX_PV = 7;
const INIT_TIMEOUT = 15000;

// Mate scores are converted to a large centipawn-equivalent so eval-gap
// comparisons still behave sanely (a mate line should never lose a gap
// check against a non-mate line).
const MATE_SCORE_CP = 100000;

function getStockfishUrl() {
  const base = import.meta?.env?.BASE_URL || "/";
  return `${base}stockfish.js`;
}

function normalizeLine(payload) {
  if (typeof payload === "string") return payload.trim();
  if (payload && typeof payload.data === "string") return payload.data.trim();
  if (payload && typeof payload.line === "string") return payload.line.trim();
  return "";
}

function clampNumber(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

// FIX: previously returned bare move strings, deduped but with no eval
// attached, so every caller had to treat all pool entries as equally good.
// Now returns {move, eval} pairs, still deduped by move and still in
// MultiPV-slot order (slot 0 = engine's best line).
function collectMoves(search) {
  const seen = new Set();
  const moves = [];

  for (const entry of search.topMoves) {
    if (!entry || !entry.move || seen.has(entry.move)) continue;
    seen.add(entry.move);
    moves.push({ move: entry.move, eval: entry.eval ?? null });
  }

  return moves;
}

function finishSearch(search, resolvedMoves) {
  if (!search || search.finished) return;

  search.finished = true;

  if (search.timeoutId) {
    clearTimeout(search.timeoutId);
    search.timeoutId = null;
  }

  try {
    search.resolve(resolvedMoves);
  } catch {}

  if (currentSearch && currentSearch.id === search.id) {
    currentSearch = null;
  }
}

function resolveNewGameWaiters() {
  if (!newGameWaiters.length) return;
  const waiters = newGameWaiters;
  newGameWaiters = [];
  for (const resolve of waiters) {
    try {
      resolve(true);
    } catch {}
  }
}

function handleSearchLine(line) {
  if (!currentSearch || !line) return;

  const search = currentSearch;

  // Parse MultiPV info lines
  // Example:
  // info depth 18 seldepth 24 multipv 2 score cp 12 pv e7e5 g1f3 ...
  // info depth 18 seldepth 24 multipv 1 score mate 3 pv ...
  if (line.startsWith("info") && line.includes(" pv ")) {
    const mpvMatch = line.match(/\bmultipv (\d+)\b/);
    const depthMatch = line.match(/\bdepth (\d+)\b/);
    const seldepthMatch = line.match(/\bseldepth (\d+)\b/);

    // FIX: capture the score for this PV line. Mate scores are converted
    // to a signed large-magnitude centipawn value so downstream eval-gap
    // math doesn't need to special-case mate vs cp everywhere.
    const cpMatch = line.match(/\bscore cp (-?\d+)\b/);
    const mateMatch = line.match(/\bscore mate (-?\d+)\b/);

    let evalCp = null;
    if (mateMatch) {
      const mateIn = parseInt(mateMatch[1], 10);
      evalCp = mateIn > 0 ? MATE_SCORE_CP - mateIn : -MATE_SCORE_CP - mateIn;
    } else if (cpMatch) {
      evalCp = parseInt(cpMatch[1], 10);
    }

    const pvIndex = mpvMatch ? Math.max(0, parseInt(mpvMatch[1], 10) - 1) : 0;
    const depth = depthMatch ? parseInt(depthMatch[1], 10) : 0;
    const seldepth = seldepthMatch ? parseInt(seldepthMatch[1], 10) : depth;

    const pvStart = line.indexOf(" pv ");
    if (pvStart === -1) return;

    const pv = line
      .slice(pvStart + 4)
      .trim()
      .split(/\s+/);

    const move = pv[0];
    if (!move) return;

    const previous = search.topMoves[pvIndex];

    // Keep the deepest line for each multipv slot (and its matching eval —
    // never mix a move from one depth with an eval captured at another).
    if (
      !previous ||
      depth > previous.depth ||
      (depth === previous.depth && seldepth > previous.seldepth)
    ) {
      search.topMoves[pvIndex] = {
        move,
        eval: evalCp,
        depth,
        seldepth,
      };
    }

    return;
  }

  // Search complete
  if (line.startsWith("bestmove")) {
    const bestMove = line.split(/\s+/)[1];
    const moves = collectMoves(search);

    if (moves.length) {
      finishSearch(search, moves);
    } else if (bestMove && bestMove !== "(none)") {
      // No parsed info lines at all (shouldn't normally happen) — fall
      // back to bestmove with no eval info rather than resolving empty.
      finishSearch(search, [{ move: bestMove, eval: null }]);
    } else {
      finishSearch(search, []);
    }
  }
}

function applyDefaultOptions() {
  if (!engine) return;

  try {
    // Safe defaults for browser play/analysis.
    engine.postMessage("setoption name Ponder value false");

    // Hash is useful, but keep it modest for browsers.
    engine.postMessage("setoption name Hash value 64");

    const threads =
      typeof navigator !== "undefined" &&
      typeof navigator.hardwareConcurrency === "number"
        ? Math.max(1, Math.min(4, navigator.hardwareConcurrency))
        : 1;

    engine.postMessage(`setoption name Threads value ${threads}`);
  } catch {}
}

function createEngine() {
  if (typeof Worker === "undefined") {
    throw new Error("Web Workers are not supported in this browser.");
  }

  const url = getStockfishUrl();
  const worker = new Worker(url);

  let sawUciOk = false;
  let sawReadyOk = false;
  let resolvedInit = false;
  let initPromiseResolve = null;
  let initPromiseReject = null;

  const clearInitTimeout = () => {
    if (worker.__phoenixInitTimeout) {
      clearTimeout(worker.__phoenixInitTimeout);
      worker.__phoenixInitTimeout = null;
    }
  };

  const maybeResolveInit = () => {
    if (resolvedInit) return;
    if (sawUciOk && sawReadyOk && initPromiseResolve) {
      resolvedInit = true;
      clearInitTimeout();
      initialized = true;
      failed = false;

      applyDefaultOptions();

      initPromiseResolve(true);
      initPromiseResolve = null;
      initPromiseReject = null;
    }
  };

  const handleMessage = (event) => {
    const line = normalizeLine(event?.data ?? event);
    if (!line) return;

    // UCI handshake
    if (line === "uciok") {
      sawUciOk = true;
      maybeResolveInit();
      return;
    }

    if (line === "readyok") {
      sawReadyOk = true;

      // If we are already initialized, this readyok may belong to ucinewgame.
      if (initialized && newGameWaiters.length) {
        resolveNewGameWaiters();
      } else {
        maybeResolveInit();
      }
      return;
    }

    // Normal search output
    if (currentSearch) {
      handleSearchLine(line);
    }
  };

  const handleError = (err) => {
    failed = true;
    initialized = false;

    const message =
      err?.message ||
      err?.error?.message ||
      "Failed to load Stockfish worker.";

    if (currentSearch) {
      const fallback = collectMoves(currentSearch);
      finishSearch(currentSearch, fallback);
    }

    clearInitTimeout();

    if (initPromiseReject) {
      initPromiseReject(new Error(message));
      initPromiseResolve = null;
      initPromiseReject = null;
    }

    try {
      worker.terminate();
    } catch {}
  };

  const initPromiseLocal = new Promise((resolve, reject) => {
    initPromiseResolve = resolve;
    initPromiseReject = reject;
  });

  worker.onmessage = handleMessage;
  worker.onerror = handleError;

  worker.__phoenixInitTimeout = setTimeout(() => {
    if (resolvedInit) return;

    failed = true;
    initialized = false;

    try {
      worker.terminate();
    } catch {}

    if (initPromiseReject) {
      initPromiseReject(new Error("Stockfish initialization timeout."));
      initPromiseResolve = null;
      initPromiseReject = null;
    }
  }, INIT_TIMEOUT);

  // Start UCI handshake
  worker.postMessage("uci");
  worker.postMessage("isready");

  return {
    worker,
    initPromiseLocal,
  };
}

async function loadStockfish() {
  if (initPromise) return initPromise;

  initPromise = new Promise(async (resolve, reject) => {
    if (failed) {
      reject(new Error("Stockfish previously failed to initialize."));
      return;
    }

    try {
      if (!engine) {
        const created = createEngine();
        engine = created.worker;

        // Wait until the worker has truly completed UCI init.
        await created.initPromiseLocal;
      }

      const start = Date.now();
      while (!initialized) {
        if (failed) {
          throw new Error("Stockfish failed to initialize.");
        }

        if (Date.now() - start > INIT_TIMEOUT + 1000) {
          throw new Error("Stockfish initialization timeout.");
        }

        await new Promise((r) => setTimeout(r, 50));
      }

      resolve(true);
    } catch (err) {
      failed = true;
      reject(err);
    } finally {
      initPromise = null;
    }
  });

  return initPromise;
}

function send(command) {
  if (!engine) return;
  try {
    engine.postMessage(command);
  } catch {}
}

// FIX: always bound the search by movetime, in addition to depth. UCI
// engines stop at whichever limit is hit first, so `go depth N movetime T`
// guarantees we never blow past our own timeout budget waiting on an
// unreachable depth in a slow browser worker.
//
// Returns an array of {move, eval} objects, best-line first (slot order),
// deduped, eval in raw engine cp units (side-to-move perspective).
async function search(fen, depth = 10, mpv = 1, moveTime = null) {
  const ready = await loadStockfish().catch(() => false);

  if (!ready || !engine || failed) {
    return [];
  }

  // Cancel any previous search so we never leave dangling promises.
  stop();

  searchId += 1;
  const mySearchId = searchId;

  const limitedMPV = clampNumber(Number(mpv) || 1, 1, MAX_PV);

  return new Promise((resolve) => {
    const searchState = {
      id: mySearchId,
      resolve,
      finished: false,
      topMoves: new Array(limitedMPV).fill(null),
      timeoutId: null,
    };

    currentSearch = searchState;

    // MultiPV must be set and acknowledged before position/go, otherwise
    // the engine may still be mid-search-cleanup from a previous setoption
    // and silently default to MultiPV=1.
    send(`setoption name MultiPV value ${limitedMPV}`);
    send(`position fen ${fen}`);

    const safeMoveTime =
      moveTime != null && Number(moveTime) > 0 ? Math.floor(Number(moveTime)) : 2000;
    const safeDepth = Math.max(1, Math.min(Math.floor(Number(depth) || 10), 24));

    send(`go depth ${safeDepth} movetime ${safeMoveTime}`);

    // Grace period beyond movetime (not a flat 90s window) — if the engine
    // hasn't reported bestmove shortly after its own movetime budget should
    // have elapsed, force-stop and salvage whatever multipv lines we have.
    searchState.timeoutId = setTimeout(() => {
      if (!currentSearch || currentSearch.id !== mySearchId) return;

      const fallback = collectMoves(searchState);

      try {
        send("stop");
      } catch {}

      finishSearch(searchState, fallback);
    }, safeMoveTime + 3000);
  });
}

function stop() {
  searchId += 1;

  if (engine) {
    try {
      engine.postMessage("stop");
    } catch {}
  }

  if (currentSearch) {
    const fallback = collectMoves(currentSearch);
    finishSearch(currentSearch, fallback);
  }
}

function newGame() {
  if (!engine) return Promise.resolve(true);

  return new Promise((resolve) => {
    newGameWaiters.push(resolve);

    try {
      engine.postMessage("ucinewgame");
      engine.postMessage("isready");
    } catch {
      resolve(false);
    }
  });
}

function waitUntilReady() {
  return loadStockfish();
}

function terminate() {
  stop();

  if (engine) {
    try {
      engine.postMessage("quit");
    } catch {}

    try {
      engine.terminate();
    } catch {}

    engine = null;
  }

  initialized = false;
  failed = false;
  initPromise = null;
  currentSearch = null;
  newGameWaiters = [];
  searchId += 1;
}

export function createStockfish() {
  loadStockfish().catch(() => {});

  return {
    // FIX: getBestMove now returns {move, eval} (was a bare move string).
    // Callers using only the move string can do `.move` on the result;
    // this is a breaking change for any caller destructuring the old
    // string return directly — see engineManager.js, which is unaffected
    // since it already treats getBestMove's result as opaque and only
    // forwards it.
    getBestMove: async (fen, depth = 10, mpv = 1, moveTime = null) => {
      const moves = await search(fen, depth, mpv, moveTime);
      return moves?.[0] || null;
    },

    // FIX: now resolves to an array of {move, eval} instead of bare move
    // strings. This is the pool NormalChess.jsx's bot logic consumes.
    getBestMoveFromPool: async (fen, depth = 10, mpv = 7, moveTime = null) => {
      const moves = await search(fen, depth, mpv, moveTime);
      return moves || [];
    },

    waitUntilReady,
    stop,
    newGame,
    terminate,
  };
}
