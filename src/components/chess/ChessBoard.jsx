import React from 'react';

const FILES = ['a','b','c','d','e','f','g','h'];

export default function ChessBoard({
  game,
  selectedSquare,
  legalMoves = [],
  lastMove,
  onSquareClick,

  // NEW annotation system
  arrows = [],
  highlights = [],
  onDrawStart,
  onDrawEnd,
  clearDrawings,
  flipped = false
}) {

  const board = game.board();

  const sqToXY = (sq) => {
    const file = FILES.indexOf(sq[0]);
    const rank = parseInt(sq[1]) - 1;

    return flipped
      ? { x: 7 - file, y: rank }
      : { x: file, y: 7 - rank };
  };

  return (
    <div
      className="relative inline-block"
      onClick={clearDrawings}   // click anywhere clears drawings
    >

      {/* 🔵 ARROWS LAYER */}
      <svg className="absolute top-0 left-0 w-full h-full pointer-events-none z-30">

        <defs>
          <marker
            id="arrowhead"
            markerWidth="0.3"
            markerHeight="0.3"
            refX="0.1"
            refY="0.15"
            orient="auto"
          >
            <polygon points="0 0, 0.3 0.15, 0 0.3" fill="rgba(0,150,255,0.8)" />
          </marker>
        </defs>

        {arrows.map((a, i) => {
          const from = sqToXY(a.from);
          const to = sqToXY(a.to);

          return (
            <line
              key={i}
              x1={from.x + 0.5}
              y1={from.y + 0.5}
              x2={to.x + 0.5}
              y2={to.y + 0.5}
              stroke={a.color || 'rgba(0,150,255,0.6)'}
              strokeWidth="0.18"
              markerEnd="url(#arrowhead)"
            />
          );
        })}

      </svg>

      {/* BOARD */}
      {board.map((row, ri) => (
        <div key={ri} className="flex">
          {row.map((piece, fi) => {
            const square = FILES[fi] + (8 - ri);

            const isLight = (ri + fi) % 2 === 0;
            const isSelected = selectedSquare === square;
            const isLegal = legalMoves.includes(square);
            const isLastMove =
              lastMove &&
              (lastMove.from === square || lastMove.to === square);

            const isHighlight = highlights.includes(square);

            let bg = isLight ? '#f0d9b5' : '#b58863';

            if (isHighlight) bg = 'rgba(255,255,0,0.4)';
            if (isSelected) bg = '#f6f669';
            if (isLastMove) bg = '#cdd16f';

            return (
              <div
                key={square}
                onClick={() => onSquareClick(square)}

                // 🎯 RIGHT CLICK DRAW START
                onContextMenu={(e) => {
                  e.preventDefault();
                  onDrawStart(square, e);
                }}

                // 🎯 DRAW END
                onMouseUp={() => onDrawEnd(square)}

                style={{
                  width: 44,
                  height: 44,
                  backgroundColor: bg,
                  position: 'relative',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer'
                }}
              >

                {/* LEGAL DOT */}
                {isLegal && !piece && (
                  <div style={{
                    width: 10,
                    height: 10,
                    borderRadius: '50%',
                    background: 'rgba(0,0,0,0.3)',
                    position: 'absolute'
                  }} />
                )}

                {/* PIECE */}
                {piece && (
                  <span style={{ fontSize: 28 }}>
                    {piece.type}
                  </span>
                )}

              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}
