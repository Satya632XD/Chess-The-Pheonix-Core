import React, { useState } from 'react';
import { Chess } from 'chess.js';
import ChessBoard from './ChessBoard';

export default function ReplayViewer({ pgn }) {
  const [index, setIndex] = useState(0);

  const game = new Chess();

  const moves = pgn || [];

  for (let i = 0; i < index; i++) {
    game.move(moves[i]);
  }

  return (
    <div className="flex flex-col gap-3">
      
      <ChessBoard game={game} />

      <div className="flex gap-2">
        <button onClick={() => setIndex(i => Math.max(0, i - 1))}>
          ⬅ Prev
        </button>

        <button onClick={() => setIndex(i => Math.min(moves.length, i + 1))}>
          Next ➡
        </button>

        <button onClick={() => setIndex(0)}>
          ⏮ Start
        </button>

        <button onClick={() => setIndex(moves.length)}>
          End ⏭
        </button>
      </div>

      <div className="text-sm">
        Move: {index} / {moves.length}
      </div>

    </div>
  );
        }
