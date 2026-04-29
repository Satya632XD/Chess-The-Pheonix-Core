import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Chess } from 'chess.js';
import { io } from 'socket.io-client';
import { useAuth } from '../context/AuthContext';
import ChessBoard from '../components/chess/ChessBoard';
import MoveHistory from '../components/chess/MoveHistory';
import GameTimer from '../components/chess/GameTimer';
import GameHeader from '../components/chess/GameHeader';
import GameOverModal from '../components/chess/GameOverModal';
import { playMoveSound, playCaptureSound, playCheckSound, playCheckmateSound, playGameStartSound } from '../lib/chessSounds';

const SERVER_URL = 'https://phoenix-chess-server.onrender.com';

export default function OnlineChess({ timerMode, onBack }) {
  // FIX: get token from auth context so server can identify the player for ELO
  const { token, user } = useAuth();

  const [status, setStatus] = useState('connecting');
  const [game, setGame] = useState(new Chess());
  const [playerColor, setPlayerColor] = useState(null);
  const [gameId, setGameId] = useState(null);
  const [selectedSquare, setSelectedSquare] = useState(null);
  const [legalMoves, setLegalMoves] = useState([]);
  const [lastMove, setLastMove] = useState(null);
  const [checkSquare, setCheckSquare] = useState(null);
  const [gameOver, setGameOver] = useState(null);
  const [history, setHistory] = useState([]);
  const [whiteTime, setWhiteTime] = useState(timerMode?.seconds || 600);
  const [blackTime, setBlackTime] = useState(timerMode?.seconds || 600);
  const [drawOffer, setDrawOffer] = useState(false);
  const [notification, setNotification] = useState(null);
  const [opponentInfo, setOpponentInfo] = useState(null);

  const socketRef = useRef(null);
  const gameRef = useRef(game);
  gameRef.current = game;
  const gameIdRef = useRef(gameId);
  gameIdRef.current = gameId;

  const showNotif = (msg, duration = 3000) => {
    setNotification(msg);
    setTimeout(() => setNotification(null), duration);
  };

  const updateCheckSquare = useCallback((g) => {
    if (g.inCheck()) {
      const board = g.board();
      const turn = g.turn();
      for (let r = 0; r < 8; r++)
        for (let f = 0; f < 8; f++) {
          const p = board[r][f];
          if (p && p.type === 'k' && p.color === turn) {
            setCheckSquare(String.fromCharCode(97 + f) + (8 - r));
            return;
          }
        }
    } else setCheckSquare(null);
  }, []);

  useEffect(() => {
    const socket = io(SERVER_URL, { transports: ['websocket', 'polling'] });
    socketRef.current = socket;

    socket.on('connect', () => {
      // FIX: authenticate socket with token so server knows who we are → ELO updates work
      if (token) {
        socket.emit('authenticate', { token });
      }
      setStatus('waiting');
      socket.emit('findGame', {
        mode: 'normal',
        timerSeconds: timerMode?.seconds || 600,
        increment: timerMode?.increment || 0,
        token: token || null, // FIX: send token with matchmaking request
      });
    });

    socket.on('waiting', () => setStatus('waiting'));

    socket.on('gameFound', ({ gameId, color, timers, opponent, category }) => {
      setGameId(gameId);
      setPlayerColor(color);
      setWhiteTime(timers.w);
      setBlackTime(timers.b);
      setOpponentInfo(opponent);
      setStatus('playing');
      playGameStartSound();
      showNotif(color === 'w' ? '⚪ You are White!' : '⚫ You are Black!');
    });

    socket.on('moveMade', ({ from, to, fen, isCheck, isCheckmate, isDraw, captured, history: h, timers }) => {
      const newGame = new Chess(fen);
      setGame(newGame);
      setLastMove({ from, to });
      setHistory(h || []);
      if (timers) { setWhiteTime(timers.w); setBlackTime(timers.b); }
      if (captured) playCaptureSound(); else playMoveSound();
      if (isCheck && !isCheckmate) playCheckSound();
      updateCheckSquare(newGame);
      setSelectedSquare(null);
      setLegalMoves([]);
    });

    socket.on('timerUpdate', ({ w, b }) => { setWhiteTime(w); setBlackTime(b); });

    socket.on('gameOver', ({ result, reason }) => {
      playCheckmateSound();
      setGameOver({ result, reason });
    });

    socket.on('drawOffered', () => { setDrawOffer(true); showNotif('Opponent offered a draw!', 8000); });
    socket.on('drawDeclined', () => showNotif('Draw declined!'));
    socket.on('disconnect', () => { if (!gameOver) showNotif('Connection lost...'); });

    return () => socket.disconnect();
  }, [token]);

  const handleSquareClick = useCallback((square) => {
    if (!gameId || gameOver || status !== 'playing') return;
    const turn = game.turn();
    if (turn !== playerColor) return;

    if (selectedSquare) {
      if (legalMoves.includes(square)) {
        const moves = game.moves({ square: selectedSquare, verbose: true });
        const move = moves.find(m => m.to === square);
        socketRef.current?.emit('makeMove', {
          gameId,
          from: selectedSquare,
          to: square,
          promotion: move?.flags?.includes('p') ? 'q' : undefined,
        });
        setSelectedSquare(null);
        setLegalMoves([]);
      } else {
        const piece = game.get(square);
        if (piece && piece.color === turn) {
          setSelectedSquare(square);
          setLegalMoves(game.moves({ square, verbose: true }).map(m => m.to));
        } else {
          setSelectedSquare(null);
          setLegalMoves([]);
        }
      }
    } else {
      const piece = game.get(square);
      if (piece && piece.color === turn) {
        setSelectedSquare(square);
        setLegalMoves(game.moves({ square, verbose: true }).map(m => m.to));
      }
    }
  }, [game, selectedSquare, legalMoves, gameId, gameOver, status, playerColor]);

  const handleResign = () => socketRef.current?.emit('resign', { gameId: gameIdRef.current });
  const handleOfferDraw = () => { socketRef.current?.emit('offerDraw', { gameId: gameIdRef.current }); showNotif('Draw offered!'); };
  const handleRespondDraw = (accept) => { socketRef.current?.emit('respondDraw', { gameId: gameIdRef.current, accept }); setDrawOffer(false); };

  if (status === 'connecting') {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center font-inter">
        <div className="text-4xl mb-4 animate-pulse">♟</div>
        <p className="text-foreground font-bold text-lg">Connecting to server...</p>
        <p className="text-muted-foreground text-sm mt-2">This may take up to 50 seconds on first load</p>
        <button onClick={onBack} className="mt-8 text-sm text-muted-foreground hover:text-foreground">← Back</button>
      </div>
    );
  }

  if (status === 'waiting') {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center font-inter">
        <div className="text-4xl mb-4 animate-bounce">♟</div>
        <p className="text-foreground font-bold text-lg">Finding opponent...</p>
        <p className="text-muted-foreground text-sm mt-2">Looking for a match</p>
        <div className="flex gap-1 mt-4">
          <div className="w-2 h-2 rounded-full bg-primary animate-bounce" style={{ animationDelay:'0ms' }} />
          <div className="w-2 h-2 rounded-full bg-primary animate-bounce" style={{ animationDelay:'150ms' }} />
          <div className="w-2 h-2 rounded-full bg-primary animate-bounce" style={{ animationDelay:'300ms' }} />
        </div>
        <button onClick={onBack} className="mt-8 text-sm text-muted-foreground hover:text-foreground">← Cancel</button>
      </div>
    );
  }

  const isMyTurn = game.turn() === playerColor;
  // FIX: flipped=true when player is Black so board shows from Black's perspective
  const flipped = playerColor === 'b';

  const myLabel = playerColor === 'w' ? '⚪ White' : '⚫ Black';
  const oppLabel = playerColor === 'w' ? '⚫ Black' : '⚪ White';

  return (
    <div className="min-h-screen bg-background flex flex-col font-inter">
      <GameHeader mode="normal" onBack={onBack} botName="Online" gameStatus={game.inCheck() && !game.isGameOver() ? '⚠ Check!' : null} />

      {notification && (
        <div className="fixed top-16 left-1/2 -translate-x-1/2 z-40 bg-primary text-primary-foreground px-6 py-3 rounded-xl font-bold text-sm shadow-xl">
          {notification}
        </div>
      )}

      {drawOffer && (
        <div className="fixed top-16 left-1/2 -translate-x-1/2 z-40 bg-card border border-border px-6 py-4 rounded-xl shadow-xl w-72">
          <p className="text-foreground font-bold text-sm mb-3 text-center">Opponent offers a draw!</p>
          <div className="flex gap-2">
            <button onClick={() => handleRespondDraw(false)} className="flex-1 py-2 rounded-lg bg-secondary text-foreground text-sm font-medium">Decline</button>
            <button onClick={() => handleRespondDraw(true)} className="flex-1 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-bold">Accept</button>
          </div>
        </div>
      )}

      <div className="flex-1 flex flex-col lg:flex-row items-center lg:items-start justify-center gap-4 p-4">
        <div className="flex flex-col items-center gap-3">
          {/* Opponent info — shown at top of board (their side) */}
          <div className="flex items-center justify-between w-full px-1">
            <span className={`text-sm font-bold ${!isMyTurn ? 'text-primary' : 'text-muted-foreground'}`}>
              {opponentInfo ? opponentInfo.displayName || opponentInfo.username : 'Opponent'}
              {!isMyTurn && ' ← Turn'}
            </span>
            <span className="text-xs text-muted-foreground">
              {oppLabel}{opponentInfo?.rating ? ` · ${opponentInfo.rating}` : ''}
            </span>
          </div>

          <ChessBoard
            game={game}
            selectedSquare={selectedSquare}
            legalMoves={legalMoves}
            lastMove={lastMove}
            onSquareClick={handleSquareClick}
            checkSquare={checkSquare}
            flipped={flipped}
          />

          {/* My info — shown at bottom of board */}
          <div className="flex items-center justify-between w-full px-1">
            <span className={`text-sm font-bold ${isMyTurn ? 'text-primary' : 'text-muted-foreground'}`}>
              {user?.displayName || user?.username || 'You'}
              {isMyTurn && ' ← Turn'}
            </span>
            <span className="text-xs text-muted-foreground">{myLabel}</span>
          </div>
        </div>

        <div className="flex flex-col gap-3 w-full max-w-xs">
          <GameTimer whiteTime={whiteTime} blackTime={blackTime} activeColor={game.turn()} isRunning={status === 'playing' && !gameOver} />

          <div className="flex gap-2">
            <button onClick={handleResign} className="flex-1 py-2 text-xs rounded-lg bg-red-500/20 text-red-400 border border-red-500/30 hover:bg-red-500/30 transition-colors font-medium">
              🏳 Resign
            </button>
            <button onClick={handleOfferDraw} className="flex-1 py-2 text-xs rounded-lg bg-secondary text-foreground hover:bg-secondary/80 transition-colors font-medium">
              🤝 Draw
            </button>
          </div>

          <div style={{ height:'300px' }}>
            <MoveHistory history={history} />
          </div>
        </div>
      </div>

      <GameOverModal result={gameOver?.result} reason={gameOver?.reason} onRematch={onBack} onMenu={onBack} />
    </div>
  );
}
