import React from 'react';

const PIECES = {
  wk:'♔', wq:'♕', wr:'♖', wb:'♗', wn:'♘', wp:'♙',
  bk:'♚', bq:'♛', br:'♜', bb:'♝', bn:'♞', bp:'♟',
};
function ChessPiece({ piece, isSelected, isDragging }) {
  const char = getPieceChar(piece);
  const isWhite = piece?.color === 'w';
  return (
    <span
      className={`select-none text-center leading-none transition-transform duration-150 ${isSelected ? 'scale-110' : 'scale-100'} ${isDragging ? 'scale-125 opacity-80' : ''}`}
      style={{
        fontSize: 'clamp(22px, 4.5vw, 46px)',
        userSelect: 'none',
        color: isWhite ? '#ffffff' : '#1a1a1a',
        WebkitTextStroke: isWhite ? '1.5px #333333' : '1.5px #ffffff',
        filter: isWhite
          ? 'drop-shadow(0 1px 3px rgba(0,0,0,0.9))'
          : 'drop-shadow(0 1px 3px rgba(255,255,255,0.3))',
      }}
    >
      {char}
    </span>
  );
}

const FILES = ['a','b','c','d','e','f','g','h'];
const RANKS = [8,7,6,5,4,3,2,1];

export default function ChessBoard({
  game, selectedSquare, legalMoves, lastMove,
  onSquareClick, checkSquare,
  phoenixSquares, phoenixMoves, phoenixSelected, activePhoenixColor
}) {
  const board = game.board();

  return (
    <div className="relative">
      <div className="grid grid-cols-8 border-2 border-border rounded-lg overflow-hidden"
        style={{ width: 'min(80vw, 400px)', height: 'min(80vw, 400px)' }}>
        {RANKS.map((rank, ri) =>
          FILES.map((file, fi) => {
            const square = file + rank;
            const piece = board[ri][fi];
            const isLight = (ri + fi) % 2 === 0;
            const isSelected = selectedSquare === square;
            const isLegal = legalMoves.includes(square);
            const isLastMove = lastMove && (lastMove.from === square || lastMove.to === square);
            const isCheck = checkSquare === square;
            const isPhoenixW = phoenixSquares?.w === square;
            const isPhoenixB = phoenixSquares?.b === square;
            const isPhoenixMove = phoenixMoves?.includes(square);

            let bg = isLight ? 'bg-amber-100' : 'bg-amber-800';
            if (isLastMove) bg = isLight ? 'bg-yellow-200' : 'bg-yellow-600';
            if (isSelected) bg = 'bg-blue-400';
            if (isCheck) bg = 'bg-red-500';

            return (
              <div
                key={square}
                className={`relative flex items-center justify-center cursor-pointer hover:opacity-90 transition-opacity ${bg}`}
                onClick={() => onSquareClick(square)}
              >
                {isLegal && !piece && (
                  <div className="absolute w-3 h-3 rounded-full bg-black/20 z-10" />
                )}
                {isLegal && piece && (
                  <div className="absolute inset-0 border-4 border-black/30 rounded-sm z-10" />
                )}
                {isPhoenixMove && (
                  <div className="absolute inset-0 bg-orange-400/40 border-2 border-orange-400 z-10" />
                )}
                {isPhoenixW && (
                  <div className="absolute top-0 right-0 text-xs z-20">🔵</div>
                )}
                {isPhoenixB && (
                  <div className="absolute top-0 left-0 text-xs z-20">🔴</div>
                )}
                {piece && (
                  <span className={`text-2xl z-10 select-none leading-none ${
                    piece.color === 'w' ? 'drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)]' : ''
                  }`}
                    style={{ fontSize: 'min(6vw, 30px)' }}>
                    {PIECES[piece.color + piece.type]}
                  </span>
                )}
                {fi === 0 && (
                  <span className="absolute top-0.5 left-0.5 text-xs opacity-50 leading-none"
                    style={{ fontSize: '8px' }}>{rank}</span>
                )}
                {ri === 7 && (
                  <span className="absolute bottom-0.5 right-0.5 text-xs opacity-50 leading-none"
                    style={{ fontSize: '8px' }}>{file}</span>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
