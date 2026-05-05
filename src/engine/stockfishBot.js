// =====================================
// Phoenix Stockfish Bot (v13 CLEAN FINAL)
// Single-engine • Stable • MultiPV pool
// =====================================

let sf = null;
let isReady = false;
let failed = false;

let session = 0;
let pending = null;
let topMoves = [];
let initPromise = null;

const MAX_PV = 7;
const TIMEOUT = 20000; // 🔥 increased thinking safety

// ================= INIT =================
function loadStockfish() {
  if (initPromise) return initPromise;

  initPromise = new Promise((resolve) => {
    const sources = [
      "https://cdn.jsdelivr.net/npm/stockfish@16.0.0/src/stockfish-nnue-16-single.js",
      "https://cdn.jsdelivr.net/npm/stockfish@16.0.0/src/stockfish-16-single.js",
      "https://unpkg.com/stockfish@16.0.0/src/stockfish-nnue-16-single.js"
    ];

    const tryNext = (i = 0) => {
      if (i >= sources.length) {
        failed = true;
        resolve(false);
        return;
      }

      try {
        importScripts(sources[i]);

        sf =
          typeof STOCKFISH !== "undefined"
            ? STOCKFISH()
            : typeof Stockfish !== "undefined"
            ? Stockfish()
            : null;

        if (!sf) return tryNext(i + 1);

        sf.onmessage = (e) =>
          handleMessage(typeof e === "string" ? e : e.data);

        sf.postMessage("uci");
        sf.postMessage("isready");

        setTimeout(() => resolve(true), 3000);
      } catch {
        tryNext(i + 1);
      }
    };

    tryNext();
  });

  return initPromise;
}

// ================= MESSAGE =================
function handleMessage(line) {
  if (!line || failed) return;

  if (line === "uciok" || line === "readyok") {
    isReady = true;
    return;
  }

  // 🔥 DEBUG: show engine thinking
  if (line.startsWith("info")) {
    console.log(line);
  }

  // ================= MultiPV parsing =================
  if (line.startsWith("info") && line.includes(" pv ")) {
    const pvIndex = line.indexOf(" pv ");
    const pv = line.slice(pvIndex + 4).trim().split(/\s+/);

    const mpv = line.match(/multipv (\d+)/);
    const depth = line.match(/ depth (\d+)/);

    const id = mpv ? +mpv[1] : 1;
    const d = depth ? +depth[1] : 0;

    const prev = topMoves[id];

    if (!prev || d > prev.depth) {
      topMoves[id] = {
        move: pv[0],
        depth: d
      };
    }
  }

  // ================= BEST MOVE =================
  if (line.startsWith("bestmove")) {
    const best = line.split(" ")[1];

    if (pending?.session === session) {
      const moves = Object.values(topMoves)
        .filter(Boolean)
        .sort((a, b) => b.depth - a.depth)
        .map(m => m.move);

      pending.resolve(
        moves.length
          ? moves
          : (best && best !== "(none)" ? [best] : [])
      );

      pending = null;
    }

    topMoves = [];
  }
}

// ================= SEARCH =================
function search(fen, depth = 10, mpv = 3) {
  return new Promise(async (resolve) => {
    const ready = await loadStockfish();
    if (!ready || !sf) return resolve([]);

    session++;
    const mySession = session;

    topMoves = [];

    pending = {
      session: mySession,
      resolve
    };

    try {
      sf.postMessage("stop");
      sf.postMessage("ucinewgame");

      const pv = Math.min(Math.max(1, mpv), MAX_PV);

      sf.postMessage(`setoption name MultiPV value ${pv}`);
      sf.postMessage(`position fen ${fen}`);

      // 🔥 FIX: REAL thinking time instead of unstable depth search
      sf.postMessage(`go movetime ${Math.max(1500, depth * 200)}`);

    } catch {
      resolve([]);
      return;
    }

    setTimeout(() => {
      if (pending?.session === mySession) {
        pending.resolve([]);
        pending = null;
      }
    }, TIMEOUT);
  });
}

// ================= API =================
export function createStockfish() {
  loadStockfish();

  return {
    getBestMove: async (fen, depth = 10) => {
      const moves = await search(fen, depth, 1);
      return moves.length ? moves[0] : null;
    },

    getBestMoveFromPool: async (fen, depth = 10, mpv = 7) => {
      const moves = await search(fen, depth, mpv);
      return moves; // 🔥 FULL PV POOL
    },

    stop: () => {
      session++;
      pending = null;
      topMoves = [];
      try {
        sf?.postMessage("stop");
      } catch {}
    }
  };
}
