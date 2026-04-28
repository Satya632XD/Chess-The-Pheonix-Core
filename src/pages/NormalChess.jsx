import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Chess } from 'chess.js';
import ChessBoard from '../components/chess/ChessBoard';
import MoveHistory from '../components/chess/MoveHistory';
import GameTimer from '../components/chess/GameTimer';
import GameHeader from '../components/chess/GameHeader';
import GameOverModal from '../components/chess/GameOverModal';
import {
  playMoveSound,
  playCaptureSound,
  playCheckSound,
  playCheckmateSound,
  playGameStartSound
} from '../lib/chessSounds';

import { createStockfish } from '../engine/stockfishBot';

const BOTS = [
  { id: 'astra', name: 'Astra', emoji: '🌱', depth: 2, label: 'Beginner', personality: 'Still learning…' },
  { id: 'orion', name: 'Orion', emoji: '⭐', depth: 4, label: 'Easy', personality: "Let's play!" },
  { id: 'titanx', name: 'TitanX', emoji: '⚔️', depth: 6, label: 'Intermediate', personality: 'Stay sharp.' },
  { id: 'vortex', name: 'Vortex', emoji: '🌪️', depth: 8, label: 'Advanced', personality: 'I see everything.' },
  { id: 'zenith', name: 'Zenith', emoji: '👑', depth: 12, label: 'Master', personality: 'You must be precise.' },
  { id: 'phoenix', name: 'Phoenix Prime', emoji: '🔥', depth: 18, label: 'Maximum', personality: 'This is your end.' },
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
  const engineRef = useRef(null);

  gameRef.current = game;

  useEffect(() => {
    if (selectedBot) playGameStartSound();
  }, [selectedBot]);

  useEffect(() => {
    engineRef.current = createStockfish();
  }, []);

  // TIMER
  useEffect(() => {
    if (!timerRunning || gameOver) return;

    timerRef.current = setInterval(() => {
      const turn = gameRef.current.turn();

      if (turn === 'w') {
        setWhiteTime(t => (t <= 1 ? endByTimeout('w') : t - 1));
      } else {
        setBlackTime(t => (t <= 1 ? endByTimeout('b') : t - 1));
      }
    }, 1000);

    return () => clearInterval(timerRef.current);
  }, [timerRunning, gameOver]);

  const endByTimeout = (color) => {
    clearInterval(timerRef.current);
    setTimerRunning(false);
    setGameOver({
      result: color === 'w' ? 'Black wins' : 'White wins',
      reason: 'Time out'
    });
  };

  const updateCheckSquare = useCallback((g) => {
    if (!g.inCheck()) return setCheckSquare(null);

    const board = g.board();
    const turn = g.turn();

    for (let r = 0; r < 8; r++) {
      for (let f = 0; f < 8; f++) {
        const p = board[r][f];
        if (p?.type === 'k' && p.color === turn) {
          setCheckSquare(String.fromCharCode(97 + f) + (8 - r));
          return;
        }
      }
    }
  }, []);

  const applyBotMove = useCallback((from, to, promotion) => {
    setGame(prev => {
      const newGame = new Chess(prev.fen());

      const result = newGame.move({
        from,
        to,
        promotion: promotion || 'q'
      });

      if (!result) return prev;

      result.captured ? playCaptureSound() : playMoveSound();

      if (newGame.inCheck() && !newGame.isCheckmate()) playCheckSound();

      setLastMove({ from: result.from, to: result.to });
      setHistory(newGame.history({ verbose: true }));
      updateCheckSquare(newGame);

      if (newGame.isCheckmate()) {
        playCheckmateSound();
        setTimerRunning(false);
        setGameOver({
          result: newGame.turn() === 'w' ? 'Black wins' : 'White wins',
          reason: 'Checkmate'
        });
      }

      return newGame;
    });
  }, [updateCheckSquare]);

  // 🔥 FIXED PHOENIX BOT (CLEAN + STABLE)
  const triggerBot = useCallback(async (fen, depth) => {
    if (!engineRef.current) return;

    setIsThinking(true);

    try {
      const tempGame = new Chess(fen);
      const legalMoves = tempGame.moves({ verbose: true });

      if (!legalMoves.length) {
        setIsThinking(false);
        return;
      }

      // 🧠 1 strong engine move
      const best = await engineRef.current.getBestMove(fen, depth, 3);

      const candidates = [];

      if (best) candidates.push(best);

      // ♟️ 2 human fallback moves
      while (candidates.length < 3) {
        const rand = legalMoves[Math.floor(Math.random() * legalMoves.length)];
        candidates.push(rand.from + rand.to + (rand.promotion || ''));
      }

      // 🎯 weighted randomness (Phoenix behavior)
      const r = Math.random();

      let index = 0;
      if (r > 0.70) index = 1;
      if (r > 0.90) index = 2;

      const chosen = candidates[index] || candidates[0];

      applyBotMove(
        chosen.substring(0, 2),
        chosen.substring(2, 4),
        chosen[4]
      );

    } catch (e) {
      console.error(e);
    }

    setIsThinking(false);
  }, [applyBotMove]);

  const handleSquareClick = useCallback((square) => {
    if (gameOver || isThinking) return;
    if (!timerRunning && history.length === 0) setTimerRunning(true);

    const turn = game.turn();
    if (turn !== 'w') return;

    if (selectedSquare) {
      if (legalMoves.includes(square)) {
        const moves = game.moves({ square: selectedSquare, verbose: true });
        const move = moves.find(m => m.to === square);

        const newGame = new Chess(game.fen());

        const result = newGame.move({
          from: selectedSquare,
          to: square,
          promotion: move?.flags?.includes('p') ? 'q' : undefined,
        });

        if (!result) return;

        result.captured ? playCaptureSound() : playMoveSound();

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
        } else {
          setTimeout(() => triggerBot(newGame.fen(), selectedBot.depth), 400);
        }

      } else {
        setSelectedSquare(null);
        setLegalMoves([]);
      }

    } else {
      const piece = game.get(square);
      if (piece?.color === turn) {
        setSelectedSquare(square);
        setLegalMoves(game.moves({ square, verbose: true }).map(m => m.to));
      }
    }
  }, [
    game,
    selectedSquare,
    legalMoves,
    gameOver,
    isThinking,
    timerRunning,
    history,
    selectedBot,
    triggerBot,
    updateCheckSquare
  ]);

  const handleRestart = () => {
    setGame(new Chess());
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

  if (!selectedBot) {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <div className="p-4 border-b">
          <button onClick={onBack}>← Menu</button>
          <h2 className="text-center font-bold">Choose Opponent</h2>
        </div>

        <div className="p-4 space-y-3">
          {BOTS.map(bot => (
            <button key={bot.id} onClick={() => setSelectedBot(bot)} className="w-full p-4 border rounded-xl">
              <div>{bot.emoji} {bot.name}</div>
              <div>{bot.label}</div>
            </button>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <GameHeader
        mode="normal"
        onBack={onBack}
        botName={selectedBot.name}
        gameStatus={game.inCheck() ? 'Check!' : null}
      />

      <div className="flex flex-col lg:flex-row gap-4 p-4">
        <ChessBoard
          game={game}
          selectedSquare={selectedSquare}
          legalMoves={legalMoves}
          lastMove={lastMove}
          onSquareClick={handleSquareClick}
          checkSquare={checkSquare}
        />

        <div className="w-full max-w-xs">
          <GameTimer
            whiteTime={whiteTime}
            blackTime={blackTime}
            activeColor={game.turn()}
            isRunning={timerRunning}
          />

          <button onClick={handleUndo}>Undo</button>
          <button onClick={handleRestart}>Restart</button>

          <MoveHistory history={history} />
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
