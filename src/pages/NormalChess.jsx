import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Chess } from 'chess.js';
import ChessBoard from '../components/chess/ChessBoard';
import MoveHistory from '../components/chess/MoveHistory';
import GameTimer from '../components/chess/GameTimer';
import GameHeader from '../components/chess/GameHeader';
import GameOverModal from '../components/chess/GameOverModal';
import { playMoveSound, playCaptureSound, playCheckSound, playCheckmateSound, playGameStartSound } from '../lib/chessSounds';

const BOTS = [
  { id: 'astra',   name: 'Astra',        emoji: '🌱', depth: 2,  label: 'Beginner',     personality: 'Still learning…' },
  { id: 'orion',   name: 'Orion',        emoji: '⭐', depth: 4,  label: 'Easy',         personality: "Let's play!" },
  { id: 'titanx',  name: 'TitanX',       emoji: '⚔️', depth: 6,  label: 'Intermediate', personality: 'Stay sharp.' },
  { id: 'vortex',  name: 'Vortex',       emoji: '🌪️', depth: 8,  label: 'Advanced',     personality: 'I see everything.' },
  { id: 'zenith',  name: 'Zenith',       emoji: '👑', depth: 10, label: 'Master',       personality: 'You must be precise.' },
  { id: 'phoenix', name: 'Phoenix Prime',emoji: '🔥', depth: 18, label: 'Maximum',      personality: 'This is your end.' },
];

export default function NormalChess({ timerMode, onBack }) {
  const [selectedBot, setSelectedBot] = useState(null);
  const [game, setGame] = useState(new Chess());
  const [selectedSquare, setSelectedSquare] = useState(null);
  const [legalMoves, setLegalMoves] = useState([]);
  const [lastMove, setLastMove] = useState(null);
  const [checkSquare, setCheckSquare] = useState(null);
  const [gameOver, setGameOver] = useState(null);
  const [history, setHistory] = useState([]);
  const [whiteTime, setWhiteTime] = useState(timerMode?.seconds || 600);
  const [blackTime, setBlackTime] = useState(timerMode?.seconds || 600);
  const [timerRunning, setTimerRunning] = useState(false);
  const [isThinking, setIsThinking] = useState(false);

  const timerRef = useRef(null);
  const gameRef = useRef(game);
  gameRef.current = game;

  // Init Stockfish
// Simple bot AI fallback
const getSimpleBotMove = useCallback((g, depth) => {
  const moves = g.moves({ verbose: true });
  if (!moves.length) return null;

  // Try captures first
  const captures = moves.filter(m => m.captured);
  if (captures.length && depth < 6) {
    return captures[Math.floor(Math.random() * captures.length)];
  }

  // Score moves simply
  const pieceValues = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 };
  let bestMove = moves[0];
  let bestScore = -Infinity;

  for (const move of moves) {
    let score = 0;
    if (move.captured) score += pieceValues[move.captured] * 10;
    if (move.piece === 'p' && (move.to[1] === '7' || move.to[1] === '2')) score += 5;
    if (['d4','d5','e4','e5','c4','c5'].includes(move.to)) score += 2;
    score += (Math.random() * depth);
    if (score > bestScore) { bestScore = score; bestMove = move; }
  }
  return bestMove;
}, []);

useEffect(() => {
  if (!selectedBot) return;
  playGameStartSound();
}, [selectedBot]);
      sf.postMessage('uci');
      sf.postMessage('ucinewgame');
      sf.onmessage = (e) => {
        const msg = e.data;
        if (typeof msg === 'string' && msg.startsWith('bestmove')) {
          const parts = msg.split(' ');
          const bestMove = parts[1];
          if (bestMove && bestMove !== '(none)') {
            const from = bestMove.slice(0, 2);
            const to = bestMove.slice(2, 4);
            const promotion = bestMove[4] || undefined;
            applyBotMove(from, to, promotion);
          }
          setIsThinking(false);
        }
      };
      stockfishRef.current = sf;
      playGameStartSound();
    } catch {}
    return () => { stockfishRef.current?.terminate(); };
  }, [selectedBot]);

  // Timer
  useEffect(() => {
    if (!timerRunning || gameOver) return;
    timerRef.current = setInterval(() => {
      const turn = gameRef.current.turn();
      if (turn === 'w') {
        setWhiteTime(t => { if (t <= 1) { endByTimeout('w'); return 0; } return t - 1; });
      } else {
        setBlackTime(t => { if (t <= 1) { endByTimeout('b'); return 0; } return t - 1; });
      }
    }, 1000);
    return () => clearInterval(timerRef.current);
  }, [timerRunning, gameOver]);

  const endByTimeout = (color) => {
    clearInterval(timerRef.current);
    setTimerRunning(false);
    setGameOver({ result: color === 'w' ? 'Black wins' : 'White wins', reason: 'Time out' });
  };

  const updateCheckSquare = useCallback((g) => {
    if (g.inCheck()) {
      const board = g.board();
      const turn = g.turn();
      for (let r = 0; r < 8; r++) {
        for (let f = 0; f < 8; f++) {
          const p = board[r][f];
          if (p && p.type === 'k' && p.color === turn) {
            setCheckSquare(String.fromCharCode(97 + f) + (8 - r));
            return;
          }
        }
      }
    } else setCheckSquare(null);
  }, []);

  const applyBotMove = useCallback((from, to, promotion) => {
    setGame(prev => {
      const newGame = new Chess(prev.fen());
      try {
        const result = newGame.move({ from, to, promotion: promotion || 'q' });
        if (!result) return prev;
        if (result.captured) playCaptureSound(); else playMoveSound();
        if (newGame.inCheck() && !newGame.isCheckmate()) playCheckSound();
        setLastMove({ from: result.from, to: result.to });
        setHistory(newGame.history({ verbose: true }));
                updateCheckSquare(newGame);
        if (newGame.isCheckmate()) {
          playCheckmateSound();
          setTimerRunning(false);
          const winner = newGame.turn() === 'w' ? 'Black wins' : 'White wins';
          setGameOver({ result: winner, reason: 'Checkmate' });
        } else if (newGame.isDraw()) {
          setTimerRunning(false);
          setGameOver({ result: 'Draw', reason: 'Stalemate or draw rule' });
        }
        return newGame;
      } catch { return prev; }
    });
  }, [updateCheckSquare]);

  const triggerStockfish = useCallback((fen, depth) => {
  setIsThinking(true);
  setTimeout(() => {
    const tempGame = new Chess(fen);
    const move = getSimpleBotMove(tempGame, depth);
    if (move) {
      applyBotMove(move.from, move.to, move.promotion);
    }
    setIsThinking(false);
  }, 500 + Math.random() * 1000);
}, [getSimpleBotMove, applyBotMove]);
  const handleSquareClick = useCallback((square) => {
    if (gameOver || isThinking) return;
    if (!timerRunning && history.length === 0) setTimerRunning(true);

    const turn = game.turn();
    if (turn !== 'w') return; // Player is white

    if (selectedSquare) {
      if (legalMoves.includes(square)) {
        const moves = game.moves({ square: selectedSquare, verbose: true });
        const move = moves.find(m => m.to === square);
        const newGame = new Chess(game.fen());
        try {
          const result = newGame.move({
            from: selectedSquare, to: square,
            promotion: move?.flags?.includes('p') ? 'q' : undefined,
          });
          if (!result) return;
          if (result.captured) playCaptureSound(); else playMoveSound();
          if (newGame.inCheck() && !newGame.isCheckmate()) playCheckSound();
          setLastMove({ from: result.from, to: result.to });
          setHistory(newGame.history({ verbose: true }));
          setGame(newGame);
          updateCheckSquare(newGame);
          setSelectedSquare(null);
          setLegalMoves([]);

          if (newGame.isCheckmate()) {
            playCheckmateSound();
            setTimerRunning(false);
            setGameOver({ result: 'White wins', reason: 'Checkmate' });
          } else if (newGame.isDraw()) {
            setTimerRunning(false);
            setGameOver({ result: 'Draw', reason: 'Stalemate or draw rule' });
          } else {
            setTimeout(() => triggerStockfish(newGame.fen(), selectedBot.depth), 300);
          }
        } catch {}
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
  }, [game, selectedSquare, legalMoves, gameOver, isThinking, timerRunning, history, selectedBot, triggerStockfish, updateCheckSquare]);

  const handleRestart = () => {
    const newGame = new Chess();
    setGame(newGame);
    setSelectedSquare(null);
    setLegalMoves([]);
    setLastMove(null);
    setCheckSquare(null);
    setGameOver(null);
    setHistory([]);
    setWhiteTime(timerMode?.seconds || 600);
    setBlackTime(timerMode?.seconds || 600);
    setTimerRunning(false);
    setIsThinking(false);
    stockfishRef.current?.postMessage('ucinewgame');
    playGameStartSound();
  };

  const handleUndo = () => {
    const newGame = new Chess();
    const hist = game.history();
    hist.slice(0, -2).forEach(m => newGame.move(m));
    setGame(newGame);
    setSelectedSquare(null);
    setLegalMoves([]);
    setLastMove(null);
    updateCheckSquare(newGame);
    setHistory(newGame.history({ verbose: true }));
    setIsThinking(false);
  };

  // Bot selection screen
  if (!selectedBot) {
    return (
      <div className="min-h-screen bg-background flex flex-col font-inter">
        <div className="flex items-center px-4 py-3 border-b border-border">
          <button onClick={onBack} className="text-sm text-muted-foreground hover:text-foreground transition-colors">← Menu</button>
          <h2 className="flex-1 text-center font-bold text-foreground">Choose Your Opponent</h2>
          <div className="w-12" />
        </div>
        <div className="flex-1 flex flex-col gap-3 p-4 overflow-y-auto">
          {BOTS.map(bot => (
            <button
              key={bot.id}
              onClick={() => setSelectedBot(bot)}
              className="flex items-center gap-4 px-5 py-4 rounded-2xl border border-border bg-card hover:bg-secondary/50 hover:border-primary/50 transition-all duration-200 text-left active:scale-[0.98]"
            >
              <span className="text-3xl">{bot.emoji}</span>
              <div className="flex flex-col flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-foreground">{bot.name}</span>
                  <span className="text-xs px-2 py-0.5 rounded-full bg-secondary text-muted-foreground">{bot.label}</span>
                </div>
                <span className="text-xs text-muted-foreground italic">&ldquo;{bot.personality}&rdquo;</span>
              </div>
              <span className="text-muted-foreground">→</span>
            </button>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col font-inter">
      <GameHeader
        mode="normal"
        onBack={onBack}
        botName={selectedBot.name}
        gameStatus={game.inCheck() && !game.isGameOver() ? '⚠ Check!' : null}
      />

      <div className="flex-1 flex flex-col lg:flex-row items-center lg:items-start justify-center gap-4 p-4">
        <div className="flex flex-col items-center gap-3">
          {/* Bot info */}
          <div className="flex items-center justify-between w-full px-1">
            <div className="flex items-center gap-2">
              <span className="text-lg">{selectedBot.emoji}</span>
                            <div>
                <span className="text-sm font-bold text-foreground">{selectedBot.name}</span>
                {isThinking && <span className="text-xs text-primary ml-2 animate-pulse">thinking…</span>}
              </div>
            </div>
            <span className="text-xs italic text-muted-foreground">&ldquo;{selectedBot.personality}&rdquo;</span>
          </div>

          <ChessBoard
            game={game}
            selectedSquare={selectedSquare}
            legalMoves={legalMoves}
            lastMove={lastMove}
            onSquareClick={handleSquareClick}
            checkSquare={checkSquare}
          />

          <div className="flex items-center gap-2 w-full px-1">
            <div className="w-3 h-3 rounded-full bg-white" />
            <span className="text-sm font-bold text-foreground">You (White)</span>
          </div>
        </div>

        <div className="flex flex-col gap-3 w-full max-w-xs lg:max-w-[240px]">
          <GameTimer
            whiteTime={whiteTime}
            blackTime={blackTime}
            activeColor={game.turn()}
            isRunning={timerRunning}
          />

          <div className="flex gap-2">
            <button onClick={handleUndo} disabled={history.length < 2}
              className="flex-1 py-2 text-xs rounded-lg bg-secondary text-foreground hover:bg-secondary/80 disabled:opacity-40 transition-colors font-medium">
              ↩ Undo
            </button>
            <button onClick={handleRestart}
              className="flex-1 py-2 text-xs rounded-lg bg-secondary text-foreground hover:bg-secondary/80 transition-colors font-medium">
              ↺ Restart
            </button>
          </div>

          <div className="flex-1 min-h-0" style={{ height: '300px' }}>
            <MoveHistory history={history} />
          </div>
        </div>
      </div>

      <GameOverModal
        result={gameOver?.result}
        reason={gameOver?.reason}
        onRematch={handleRestart}
        onMenu={onBack}
      />
    </div>
  );
          }
