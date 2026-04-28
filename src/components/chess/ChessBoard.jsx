import React, { useMemo } from 'react';

const PIECE_IMAGES = {
  wk: 'https://www.chess.com/chess-themes/pieces/neo/150/wk.png',
  wq: 'https://www.chess.com/chess-themes/pieces/neo/150/wq.png',
  wr: 'https://www.chess.com/chess-themes/pieces/neo/150/wr.png',
  wb: 'https://www.chess.com/chess-themes/pieces/neo/150/wb.png',
  wn: 'https://www.chess.com/chess-themes/pieces/neo/150/wn.png',
  wp: 'https://www.chess.com/chess-themes/pieces/neo/150/wp.png',
  bk: 'https://www.chess.com/chess-themes/pieces/neo/150/bk.png',
  bq: 'https://www.chess.com/chess-themes/pieces/neo/150/bq.png',
  br: 'https://www.chess.com/chess-themes/pieces/neo/150/br.png',
  bb: 'https://www.chess.com/chess-themes/pieces/neo/150/bb.png',
  bn: 'https://www.chess.com/chess-themes/pieces/neo/150/bn.png',
  bp: 'https://www.chess.com/chess-themes/pieces/neo/150/bp.png',
};

const FILES = ['a','b','c','d','e','f','g','h'];
const RANKS = [8,7,6,5,4,3,2,1];

export default function ChessBoard({
  game,
  selectedSquare,
  legalMoves = [],
  lastMove,
  onSquareClick,
  checkSquare,

  // Phoenix / advanced props
  phoenixSquares,
  phoenixMoves = [],
  evalScore = 0
}) {

  const board = game.board();

  /* memo prevents unnecessary recalculation */
  const memoBoard = useMemo(() => board, [game]);

  return (
    <div className="relative inline-block select-none">

      {/* ♟️ Eval Bar */}
      <div className="absolute right-0 top-0 w-2 h-full bg-gray-900 z-10">
        <div
          className="w-full bg-white"
          style={{
            height: `${50 + Math.max(-50, Math.min(50, evalScore))}%`,
            transition: 'height 0.2s ease'
          }}
        />
      </div>

      {/* Board */}
      <div className="flex">

        {/* Rank labels */}
        <div className="flex flex-col" style={{ width: '18px' }}>
          {RANKS.map(rank => (
            <div
              key={rank}
              style={{ width: '18px', height: '44px' }}
              className="flex items-center justify-center text-xs font-bold opacity-70"
            >
              {rank}
            </div>
          ))}
        </div>

        {/* Chess grid */}
        <div>

          {RANKS.map((rank, ri) => (
            <div key={rank} className="flex">

              {FILES.map((file, fi) => {

                const square = file + rank;
                const piece = memoBoard[ri][fi];

                const isLight = (ri + fi) % 2 === 0;
                const isSelected = selectedSquare === square;
                const isLegal = legalMoves.includes(square);
                const isLastMove =
                  lastMove?.from === square || lastMove?.to === square;

                const isCheck = checkSquare === square;
                const isPhoenixMove = phoenixMoves.includes(square);

                const hasPhoenix =
                  phoenixSquares?.w === square ||
                  phoenixSquares?.b === square;

                /* base color */
                let bg = isLight ? '#f0d9b5' : '#b58863';

                if (isLastMove) bg = '#cdd16f';
                if (isSelected) bg = '#f6f669';
                if (isCheck) bg = '#ff6b6b';

                return (
                  <div
                    key={square}
                    onClick={() => onSquareClick(square)}
                    className="relative flex items-center justify-center"
                    style={{
                      width: '44px',
                      height: '44px',
                      backgroundColor: bg,
                      cursor: 'pointer',
                    }}
                  >

                    {/* legal move dot */}
                    {isLegal && !piece && (
                      <div className="absolute w-3 h-3 bg-black opacity-25 rounded-full" />
                    )}

                    {/* capture highlight */}
                    {isLegal && piece && (
                      <div className="absolute inset-0 border-4 border-black opacity-30" />
                    )}

                    {/* phoenix hint */}
                    {isPhoenixMove && (
                      <div className="absolute inset-0 bg-orange-400/30 border border-orange-500" />
                    )}

                    {/* PIECE */}
                    {piece && (
                      <div className="relative z-20">

                        {/* Phoenix aura */}
                        {hasPhoenix && (
                          <div className="absolute -inset-1 rounded-full border-2 border-blue-400 animate-pulse" />
                        )}

                        <img
                          src={PIECE_IMAGES[piece.color + piece.type]}
                          alt={piece.type}
                          className="w-9 h-9 pointer-events-none select-none"
                        />
                      </div>
                    )}

                    {/* file/rank labels */}
                    {fi === 0 && (
                      <span className="absolute top-0 left-1 text-[9px] opacity-60">
                        {rank}
                      </span>
                    )}

                    {ri === 7 && (
                      <span className="absolute bottom-0 right-1 text-[9px] opacity-60">
                        {file}
                      </span>
                    )}

                  </div>
                );
              })}
            </div>
          ))}

          {/* bottom files */}
          <div className="flex h-[18px]">
            {FILES.map(file => (
              <div
                key={file}
                className="w-[44px] text-center text-xs font-bold opacity-70"
              >
                {file}
              </div>
            ))}
          </div>

        </div>
      </div>
    </div>
  );
      }
