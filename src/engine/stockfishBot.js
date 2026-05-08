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
