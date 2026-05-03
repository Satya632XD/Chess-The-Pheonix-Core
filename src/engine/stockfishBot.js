// =====================================
// Phoenix Stockfish Bot (v11.2-lite FINAL)
// =====================================

let sf = null;
let isReady = false;
let failed = false;

let session = 0;
let pending = null;
let topMoves = [];
let initPromise = null;

const MAX_PV = 5;
const TIMEOUT = 9000;

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

  if (line.startsWith("info") && line.includes(" pv ")) {
    const idx = line.indexOf(" pv ");
    const pv = line.slice(idx + 4).trim().split(/\s+/);

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

  if (line.startsWith("bestmove")) {
    const best = line.split(" ")[1];

    if (pending?.session === session) {
      const moves = Object.values(topMoves)
        .filter(Boolean)
        .sort((a, b) => b.depth - a.depth)
        .map(m => m.move);

      pending.resolve(moves.length ? moves : [best]);
      pending = null;
    }

    topMoves = [];
  }
}

// ================= SEARCH =================
function search(fen, depth, mpv = 1) {
  return new Promise(async (resolve) => {
    const ready = await loadStockfish();
    if (!ready || !sf) return resolve([]);

    session++;
    const mySession = session;

    topMoves = [];

    pending = { session: mySession, resolve };

    sf.postMessage("stop");
    sf.postMessage("ucinewgame");
    sf.postMessage(`setoption name MultiPV value ${Math.min(mpv, MAX_PV)}`);
    sf.postMessage(`position fen ${fen}`);
    sf.postMessage(`go depth ${depth}`);

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
    getBestMove: async (fen, depth = 10, mpv = 1) => {
      const moves = await search(fen, depth, mpv);
      return moves.length ? moves[0] : null;
    },

    getBestMoveFromPool: async (fen, depth = 10, mpv = 3) => {
      const moves = await search(fen, depth, mpv);
      return moves.length
        ? moves[Math.floor(Math.random() * moves.length)]
        : null;
    },

    stop: () => {
      session++;
      pending = null;
      topMoves = [];
      sf?.postMessage("stop");
    }
  };
}
