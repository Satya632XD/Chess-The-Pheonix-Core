// Stockfish Web Worker wrapper

export function createStockfish() {
  const stockfish = new Worker(
    'https://cdn.jsdelivr.net/npm/stockfish@16/src/stockfish.js'
  );

  let callbacks = [];

  stockfish.onmessage = (e) => {
    const line = e.data;

    if (line.includes('bestmove')) {
      const parts = line.split(' ');
      const move = parts[1];
      callbacks.forEach(cb => cb(move));
      callbacks = [];
    }
  };

  const send = (cmd) => stockfish.postMessage(cmd);

  send('uci');

  return {
    getBestMove: (fen, depth = 15, multiPV = 3) => {
      return new Promise((resolve) => {
        callbacks.push((bestMove) => resolve(bestMove));

        send(`position fen ${fen}`);
        send(`setoption name MultiPV value ${multiPV}`);
        send(`go depth ${depth}`);
      });
    }
  };
                         
