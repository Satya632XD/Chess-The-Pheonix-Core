export const PIECE_DICE_VALUES = {
  p: 1, n: 2, b: 3, r: 4, q: 5, k: 6
};

export function createPhoenixState() {
  return {
    positions: { w: 'd4', b: 'd5' },
    active: { w: true, b: true },
    used: { w: false, b: false },
    turnsSinceMoved: { w: 0, b: 0 },
    mustMove: { w: false, b: false },
    lastDice: { w: null, b: null },
  };
}

export function rollDice(lastRoll) {
  let roll;
  do { roll = Math.floor(Math.random() * 6) + 1; } while (roll === lastRoll);
  return roll;
}

function coordsToSquare(file, rank) {
  if (file < 0 || file > 7 || rank < 0 || rank > 7) return null;
  return String.fromCharCode(97 + file) + (rank + 1);
}

function squareToCoords(square) {
  return {
    file: square.charCodeAt(0) - 97,
    rank: parseInt(square[1]) - 1,
  };
}

function getOccupied(board, color) {
  const squares = [];
  for (let r = 0; r < 8; r++) {
    for (let f = 0; f < 8; f++) {
      if (board[r][f] && board[r][f].color === color) {
        squares.push(String.fromCharCode(97 + f) + (8 - r));
      }
    }
  }
  return squares;
}

export function getPhoenixMoves(fromSquare, pieceType, board, color) {
  const { file, rank } = squareToCoords(fromSquare);
  const occupied = getOccupied(board, color);
  const moves = [];

  const addIfValid = (f, r) => {
    const sq = coordsToSquare(f, r);
    if (sq && !occupied.includes(sq)) moves.push(sq);
  };

  switch (pieceType) {
    case 'p': {
      const dir = color === 'w' ? 1 : -1;
      addIfValid(file, rank + dir);
      addIfValid(file, rank + dir * 2);
      break;
    }
    case 'n':
      [[-2,-1],[-2,1],[-1,-2],[-1,2],[1,-2],[1,2],[2,-1],[2,1]]
        .forEach(([df, dr]) => addIfValid(file+df, rank+dr));
      break;
    case 'b':
      for (const [df, dr] of [[-1,-1],[-1,1],[1,-1],[1,1]]) {
        for (let i = 1; i < 8; i++) {
          const sq = coordsToSquare(file+df*i, rank+dr*i);
          if (!sq) break;
          if (occupied.includes(sq)) break;
          moves.push(sq);
        }
      }
      break;
    case 'r':
      for (const [df, dr] of [[-1,0],[1,0],[0,-1],[0,1]]) {
        for (let i = 1; i < 8; i++) {
          const sq = coordsToSquare(file+df*i, rank+dr*i);
          if (!sq) break;
          if (occupied.includes(sq)) break;
          moves.push(sq);
        }
      }
      break;
    case 'q':
      for (const [df, dr] of [[-1,-1],[-1,1],[1,-1],[1,1],[-1,0],[1,0],[0,-1],[0,1]]) {
        for (let i = 1; i < 8; i++) {
          const sq = coordsToSquare(file+df*i, rank+dr*i);
          if (!sq) break;
          if (occupied.includes(sq)) break;
          moves.push(sq);
        }
      }
      break;
    case 'k':
      [[-1,-1],[-1,0],[-1,1],[0,-1],[0,1],[1,-1],[1,0],[1,1]]
        .forEach(([df, dr]) => addIfValid(file+df, rank+dr));
      break;
    default:
      addIfValid(file, rank+1);
      addIfValid(file, rank-1);
  }

  return moves;
    }
