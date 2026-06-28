// =====================================
// Phoenix Stockfish Bot (v19 STABLE)
// Fixed MultiPV ordering
// Fixed stale searches
// Fixed timeout handling
// Fixed ucinewgame misuse
// =====================================

let sf = null;
let isReady = false;
let failed = false;

let searchId = 0;
let currentSearch = null;
let initPromise = null;

const MAX_PV = 7;
const TIMEOUT = 90000;

function loadStockfish() {
  if (initPromise) return initPromise;

  initPromise = new Promise((resolve) => {
    const sources = [
      "https://cdn.jsdelivr.net/npm/stockfish@18.0.0/src/stockfish-nnue-16-single.js",
      "https://unpkg.com/stockfish@18.0.0/src/stockfish-nnue-16-single.js",
      "https://cdn.jsdelivr.net/npm/stockfish@17.1.0/src/stockfish-nnue-16-single.js",
      "https://unpkg.com/stockfish@17.1.0/src/stockfish-nnue-16-single.js",
      "https://cdn.jsdelivr.net/npm/stockfish@16.0.0/src/stockfish-nnue-16-single.js",
    ];

    const tryNext = (i = 0) => {
      if (i >= sources.length) {
        failed = true;
        console.error("❌ Failed to load Stockfish");
        resolve(false);
        return;
      }

      try {
        console.log(`🔄 Loading Stockfish from ${sources[i]}`);

        importScripts(sources[i]);

        sf =
          typeof STOCKFISH !== "undefined"
            ? STOCKFISH()
            : typeof Stockfish !== "undefined"
            ? Stockfish()
            : null;

        if (!sf) {
          return tryNext(i + 1);
        }

        sf.onmessage = (e) => {
          const line = typeof e === "string" ? e : e.data;
          handleMessage(line);
        };

        sf.postMessage("uci");
        sf.postMessage("isready");

        setTimeout(() => {
          isReady = true;
          console.log("✅ Stockfish ready");
          resolve(true);
        }, 3000);

      } catch (err) {
        console.log(`⚠️ Failed source ${i}`, err);
        tryNext(i + 1);
      }
    };

    tryNext();
  });

  return initPromise;
}

function handleMessage(line) {
  if (!line || failed || !currentSearch) return;

  if (line === "uciok" || line === "readyok") {
    isReady = true;
    return;
  }

  const search = currentSearch;

  // =====================================
  // MultiPV parsing
  // =====================================
  if (line.startsWith("info") && line.includes(" pv ")) {

    const mpvMatch = line.match(/multipv (\d+)/);
    const depthMatch = line.match(/ depth (\d+)/);
    const seldepthMatch = line.match(/ seldepth (\d+)/);

    const pvIndex = mpvMatch ? parseInt(mpvMatch[1]) - 1 : 0;

    const depth = depthMatch ? parseInt(depthMatch[1]) : 0;
    const seldepth = seldepthMatch
      ? parseInt(seldepthMatch[1])
      : depth;

    const pvStart = line.indexOf(" pv ");

    if (pvStart === -1) return;

    const pv = line
      .slice(pvStart + 4)
      .trim()
      .split(/\s+/);

    const move = pv[0];

    if (!move) return;

    const previous = search.topMoves[pvIndex];

    // keep deepest line for each multipv slot
    if (
      !previous ||
      depth > previous.depth ||
      (
        depth === previous.depth &&
        seldepth > previous.seldepth
      )
    ) {
      search.topMoves[pvIndex] = {
        move,
        depth,
        seldepth
      };
    }
  }

  // =====================================
  // Search complete
  // =====================================
  if (line.startsWith("bestmove")) {

    const bestMove = line.split(" ")[1];

    if (!currentSearch) return;

    const moves = currentSearch.topMoves
      .filter(Boolean)
      .map(m => m.move);

    currentSearch.resolve(
      moves.length ? moves : [bestMove]
    );

    currentSearch = null;
  }
}

async function search(fen, depth = 10, mpv = 1, moveTime = null) {

  const ready = await loadStockfish();

  if (!ready || !sf) {
    console.error("❌ Stockfish unavailable");
    return [];
  }

  stop();

  searchId++;

  const mySearchId = searchId;

  return new Promise((resolve) => {

    currentSearch = {
      id: mySearchId,
      resolve,
      topMoves: []
    };

    const limitedMPV = Math.min(
      Math.max(1, mpv),
      MAX_PV
    );

    sf.postMessage(`setoption name MultiPV value ${limitedMPV}`);

    sf.postMessage(`position fen ${fen}`);

    console.log(
      `🔍 Search depth=${depth} mpv=${limitedMPV}`
    );

    if (moveTime) {
      sf.postMessage(`go movetime ${moveTime}`);
    } else {
      sf.postMessage(`go depth ${depth}`);
    }

    setTimeout(() => {

      if (
        currentSearch &&
        currentSearch.id === mySearchId
      ) {

        console.log("⏱️ Search timeout");

        sf.postMessage("stop");

        const fallbackMoves =
          currentSearch.topMoves
            .filter(Boolean)
            .map(m => m.move);

        currentSearch.resolve(fallbackMoves);

        currentSearch = null;
      }

    }, TIMEOUT);
  });
}

function stop() {

  searchId++;

  if (sf) {
    try {
      sf.postMessage("stop");
    } catch {}
  }

  currentSearch = null;
}

function newGame() {
  if (sf) {
    sf.postMessage("ucinewgame");
  }
}

function terminate() {

  stop();

  try {
    sf?.postMessage("quit");
  } catch {}

  sf = null;
  isReady = false;
}

export function createStockfish() {

  loadStockfish();

  return {

    getBestMove: async (
      fen,
      depth = 10,
      mpv = 1,
      moveTime = null
    ) => {

      const moves = await search(
        fen,
        depth,
        mpv,
        moveTime
      );

      return moves?.[0] || null;
    },

    getBestMoveFromPool: async (
      fen,
      depth = 10,
      mpv = 7,
      moveTime = null
    ) => {

      const moves = await search(
        fen,
        depth,
        mpv,
        moveTime
      );

      return moves || [];
    },

    stop,

    newGame,

    terminate
  };
    }


vs

// src/engine/stockfishBot.js
// Phoenix Stockfish Bot
// - Uses local /public/stockfish.js
// - Waits for proper UCI readiness
// - Supports MultiPV
// - Keeps the same public API used by engineManager.js

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
const SEARCH_TIMEOUT = 90000;

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

function collectMoves(search) {
  const seen = new Set();
  const moves = [];

  for (const entry of search.topMoves) {
    if (!entry || !entry.move || seen.has(entry.move)) continue;
    seen.add(entry.move);
    moves.push(entry.move);
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
  if (line.startsWith("info") && line.includes(" pv ")) {
    const mpvMatch = line.match(/\bmultipv (\d+)\b/);
    const depthMatch = line.match(/\bdepth (\d+)\b/);
    const seldepthMatch = line.match(/\bseldepth (\d+)\b/);

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

    // Keep the deepest line for each multipv slot
    if (
      !previous ||
      depth > previous.depth ||
      (depth === previous.depth && seldepth > previous.seldepth)
    ) {
      search.topMoves[pvIndex] = {
        move,
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
      finishSearch(search, [bestMove]);
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

    send(`setoption name MultiPV value ${limitedMPV}`);
    send(`position fen ${fen}`);

    if (moveTime != null && Number(moveTime) > 0) {
      send(`go movetime ${Math.floor(Number(moveTime))}`);
    } else {
      send(`go depth ${Math.max(1, Math.floor(Number(depth) || 10))}`);
    }

    searchState.timeoutId = setTimeout(() => {
      if (!currentSearch || currentSearch.id !== mySearchId) return;

      const fallback = collectMoves(searchState);

      try {
        send("stop");
      } catch {}

      finishSearch(searchState, fallback);
    }, SEARCH_TIMEOUT);
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
    getBestMove: async (fen, depth = 10, mpv = 1, moveTime = null) => {
      const moves = await search(fen, depth, mpv, moveTime);
      return moves?.[0] || null;
    },

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
