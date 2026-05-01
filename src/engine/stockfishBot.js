// =====================================
// Phoenix Stockfish Bot (v11-lite)
// Cluster-grade stability • Single engine • Safe MultiPV
// =====================================

import { Chess } from "chess.js";

// ================= CONFIG =================
const MAX_PV = 5;
const LOAD_TIMEOUT = 12000;
const SEARCH_TIMEOUT = 9000;

// ================= STATE =================
let sf = null;
let isReady = false;
let failed = false;

let session = 0;
let pending = null;
let topMoves = [];
let multiPV = 1;
let initPromise = null;

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

    setTimeout(() => resolve(isReady), LOAD_TIMEOUT);  
  } catch {  
    tryNext(i + 1);  
  }  
};  

tryNext();

});

return initPromise;
}

// ================= MESSAGE HANDLER =================
function handleMessage(line) {
if (!line || failed) return;

// READY STATE
if (line === "uciok" || line === "readyok") {
isReady = true;
self.postMessage({ type: "ready" });
return;
}

// ================= PV PARSING (FIXED) =================
if (line.startsWith("info") && line.includes(" pv ")) {
const mpv = line.match(/multipv (\d+)/);
const depth = line.match(/ depth (\d+)/);
const cp = line.match(/score cp (-?\d+)/);
const mate = line.match(/score mate (-?\d+)/);

const idx = line.indexOf(" pv ");  
if (idx === -1) return;  

const pv = line.slice(idx + 4).trim().split(/\s+/);  

const id = mpv ? +mpv[1] : 1;  
const d = depth ? +depth[1] : 0;  

const prev = topMoves[id];  

// FIX: prefer deeper + avoid overwrite bug  
if (!prev || d > prev.depth) {  
  topMoves[id] = {  
    move: pv[0],  
    depth: d,  
    score: mate ? 999999 : cp ? +cp[1] : 0,  
    pv  
  };  
}

}

// ================= BESTMOVE =================
if (line.startsWith("bestmove")) {
const best = line.split(" ")[1];

if (pending?.session === session) {  
  const moves = Object.values(topMoves)  
    .filter(Boolean)  
    .sort((a, b) => b.depth - a.depth)  
    .map((m) => m.move);  

  const final =  
    moves.length > 0  
      ? moves  
      : best && best !== "(none)" && best !== "0000"  
      ? [best]  
      : [];  

  pending.resolve(final);  
  pending = null;  
}  

topMoves = [];

}
}

// ================= SEARCH (FIXED RACE SAFETY) =================
function search(fen, depth, mpv = 1) {
return new Promise(async (resolve) => {
const ready = await loadStockfish();
if (!ready || !sf) return resolve([]);

session++;  
const mySession = session;  

multiPV = Math.min(Math.max(mpv, 1), MAX_PV);  
topMoves = [];  

pending = { session: mySession, resolve };  

try {  
  sf.postMessage("stop");  
  sf.postMessage("ucinewgame");  
  sf.postMessage(`setoption name MultiPV value ${multiPV}`);  
  sf.postMessage(`position fen ${fen}`);  
  sf.postMessage(`go depth ${depth}`);  
} catch {}  

setTimeout(() => {  
  if (pending?.session === mySession) {  
    pending.resolve([]);  
    pending = null;  
    topMoves = [];  
  }  
}, SEARCH_TIMEOUT);

});
}

// ================= STOP =================
function stop() {
session++;
pending = null;
topMoves = [];

try {
sf?.postMessage("stop");
} catch {}
}

// ================= PUBLIC API =================
export function createStockfish() {
loadStockfish().then((ok) => {
console.log(ok ? "✅ Stockfish ready (v11-lite)" : "⚠️ Stockfish failed");
});

return {
getBestMove: async (fen, depth = 10, mpv = 1) => {
const moves = await search(fen, depth, mpv);
if (!moves.length) return null;
return moves[Math.floor(Math.random() * Math.min(mpv, moves.length))];
},

getBestMoveFromPool: async (fen, depth = 10, poolSize = 3) => {  
  const moves = await search(fen, depth, poolSize);  
  if (!moves.length) return null;  

  const pick = moves.slice(0, poolSize);  
  return pick[Math.floor(Math.random() * pick.length)];  
},  

stop,  

terminate: () => {  
  try {  
    sf?.terminate?.();  
  } catch {}  

  sf = null;  
  isReady = false;  
  failed = false;  
  pending = null;  
  topMoves = [];  
  initPromise = null;  
  session++;  
}

};
}
