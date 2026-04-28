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

/* ---------------- BOTS ---------------- */
const BOTS = [
  { id: 'astra', name: 'Astra', emoji: '🌱', depth: 2 },
  { id: 'orion', name: 'Orion', emoji: '⭐', depth: 4 },
  { id: 'titanx', name: 'TitanX', emoji: '⚔️', depth: 6 },
  { id: 'vortex', name: 'Vortex', emoji: '🌪️', depth: 8 },
  { id: 'zenith', name: 'Zenith', emoji: '👑', depth: 10 },
  { id: 'phoenix', name: 'Phoenix Prime', emoji: '🔥', depth: 18 },
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
  const [promotionMove, setPromotionMove] = useState(null);

  const engineRef = useRef(null);
  const gameRef = useRef(game);
  const timerRef = useRef(null);

  gameRef.current = game;

  /* ---------------- INIT ENGINE ---------------- */
  useEffect(() => {
    engineRef.current = createStockfish();
  }, []);

  useEffect(() => {
    if (selectedBot) playGameStartSound();
  }, [selectedBot]);

  /* ---------------- TIMER ---------------- */
  useEffect(() => {
    if (!timerRunning || gameOver) return;

    timerRef.current = setInterval(() => {
      const turn = gameRef.current.turn();

      if (turn === 'w') {
        setWhiteTime(t => (t <= 1 ? 0 : t - 1));
      } else {
        setBlackTime(t => (t <= 1 ? 0 : t - 1));
      }
    }, 1000);

    return () => clearInterval(timerRef.current);
  }, [timerRunning, gameOver]);

  /* ---------------- CHECK DETECTION ---------------- */
  const updateCheckSquare = useCallback((g) => {
    if (!g.inCheck()) return setCheckSquare(null);

    const board = g.board();
    const turn = g.turn();

    for (let r = 0; r < 8; r++) {
      for (let f = 0; f < 8; f++) {
        const p = board[r][f];
        if (p?.type === 'k' && p.color === turn) {
          setCheckSquare(String.fromCharCode(97 + f) + (8 - r));
        }
      }
    }
  }, []);

  /* ---------------- APPLY MOVE ---------------- */
  const applyMove = useCallback((from, to, promotion) => {
    setGame(prev => {
      const g = new Chess(prev.fen());

      const move = g.move({ from, to, promotion });

      if (!move) return prev;

      if (move.captured) playCaptureSound();
      else playMoveSound();

      if (g.inCheck()) playCheckSound();

      setLastMove({ from: move.from, to: move.to });
      setHistory(g.history({ verbose: true }));
      updateCheckSquare(g);

      if (g.isCheckmate()) {
        playCheckmateSound();
        setGameOver({ result: g.turn() === 'w' ? 'Black wins' : 'White wins', reason: 'Checkmate' });
        setTimerRunning(false);
      }

      return g;
    });
  }, [updateCheckSquare]);

  /* ---------------- BOT (PHOENIX PRIME LOGIC) ---------------- */
  const triggerBot = useCallback(async (fen, depth) => {
    if (!engineRef.current) return;

    setIsThinking(true);

    try {
      const temp = new Chess(fen);
      const legal = temp.moves({ verbose: true });

      if (!legal.length) return setIsThinking(false);

      const best = await engineRef.current.getBestMove(fen, depth, 3);

      const candidates = [best];

      while (candidates.length < 3) {
        const r = legal[Math.floor(Math.random() * legal.length)];
        candidates.push(r.from + r.to + (r.promotion || ''));
      }

      const weights = [0.7, 0.2, 0.1];
      const rand = Math.random();

      let i = 0;
      if (rand > 0.7) i = 1;
      if (rand > 0.9) i = 2;

      const c = candidates[i] || candidates[0];

      applyMove(c.substring(0, 2), c.substring(2, 4), c[4]);

    } catch (e) {
      console.error(e);
    }

    setIsThinking(false);
  }, [applyMove]);

  /* ---------------- CLICK HANDLER ---------------- */
  const handleSquareClick = useCallback((square) => {
    if (gameOver || isThinking) return;

    const g = game;
    const turn = g.turn();
    if (turn !== 'w') return;

    if (selectedSquare) {
      if (!legalMoves.includes(square)) {
        setSelectedSquare(null);
        setLegalMoves([]);
        return;
      }

      const temp = new Chess(g.fen());
      const move = temp.move({
        from: selectedSquare,
        to: square,
        promotion: undefined
      });

      if (!move) return;

      // 🚨 PROMOTION FIX
      if (move.flags?.includes('p')) {
        setPromotionMove({
          from: selectedSquare,
          to: square,
          fen: g.fen()
        });
        return;
      }

      setGame(temp);
      setSelectedSquare(null);
      setLegalMoves([]);

      setTimeout(() => triggerBot(temp.fen(), selectedBot.depth), 400);

    } else {
      const piece = g.get(square);

      if (piece?.color === turn) {
        setSelectedSquare(square);
        setLegalMoves(g.moves({ square, verbose: true }).map(m => m.to));
      }
    }
  }, [game, selectedSquare, legalMoves, gameOver, isThinking, selectedBot, triggerBot]);

  /* ---------------- UI ---------------- */
  if (!selectedBot) {
    return (
      <div className="p-4">
        <h2>Choose Bot</h2>
        {BOTS.map(b => (
          <button key={b.id} onClick={() => setSelectedBot(b)}>
            {b.emoji} {b.name}
          </button>
        ))}
      </div>
    );
  }

  return (
    <div className="min-h-screen">

      <GameHeader
        mode="normal"
        onBack={onBack}
        botName={selectedBot.name}
        gameStatus={game.inCheck() ? "Check" : null}
      />

      <ChessBoard
        game={game}
        selectedSquare={selectedSquare}
        legalMoves={legalMoves}
        lastMove={lastMove}
        onSquareClick={handleSquareClick}
        checkSquare={checkSquare}
      />

      <GameTimer
        whiteTime={whiteTime}
        blackTime={blackTime}
        activeColor={game.turn()}
        isRunning={timerRunning}
      />

      <MoveHistory history={history} />

      {/* PROMOTION UI */}
      {promotionMove && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center">
          <div className="bg-white p-4 flex gap-2 rounded-xl">
            {['q', 'r', 'b', 'n'].map(p => (
              <button
                key={p}
                onClick={() => {
                  const g = new Chess(promotionMove.fen);
                  g.move({
                    from: promotionMove.from,
                    to: promotionMove.to,
                    promotion: p
                  });

                  setGame(g);
                  setPromotionMove(null);
                  setHistory(g.history({ verbose: true }));

                  setTimeout(() => triggerBot(g.fen(), selectedBot.depth), 300);
                }}
              >
                {p.toUpperCase()}
              </button>
            ))}
          </div>
        </div>
      )}

      <GameOverModal
        result={gameOver?.result}
        reason={gameOver?.reason}
        onRematch={() => setGame(new Chess())}
        onMenu={onBack}
      />
    </div>
  );
}
