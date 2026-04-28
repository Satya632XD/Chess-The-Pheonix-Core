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
import { updateGlicko } from '../lib/glicko2';

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
  const [pgn, setPgn] = useState('');

  const [whiteTime, setWhiteTime] = useState(timerMode?.seconds || 600);
  const [blackTime, setBlackTime] = useState(timerMode?.seconds || 600);
  const [timerRunning, setTimerRunning] = useState(false);

  const [isThinking, setIsThinking] = useState(false);
  const [promotionMove, setPromotionMove] = useState(null);

  const [evalScore, setEvalScore] = useState(0);

  const [player, setPlayer] = useState({
    rating: 400,
    rd: 350
  });

  const engineRef = useRef(null);
  const gameRef = useRef(game);
  const timerRef = useRef(null);
  const botLock = useRef(false);

  gameRef.current = game;

  /* ---------------- ENGINE ---------------- */
  useEffect(() => {
    engineRef.current = createStockfish();
    return () => {
      engineRef.current = null;
    };
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
        setWhiteTime(t => Math.max(0, t - 1));
      } else {
        setBlackTime(t => Math.max(0, t - 1));
      }
    }, 1000);

    return () => clearInterval(timerRef.current);
  }, [timerRunning, gameOver]);

  /* ---------------- STOCKFISH EVAL ---------------- */
  const requestEval = useCallback((fen) => {
    if (!engineRef.current) return;

    engineRef.current.evaluate?.(fen, (score) => {
      setEvalScore(score);
    });
  }, []);

  /* ---------------- MOVE ---------------- */
  const applyMove = useCallback((from, to, promotion) => {
    setGame(prev => {
      const g = new Chess(prev.fen());

      const move = g.move({ from, to, promotion });

      if (!move) return prev;

      if (move.captured) playCaptureSound();
      else playMoveSound();

      if (g.inCheck()) playCheckSound();

      setLastMove({ from: move.from, to: move.to });

      const h = g.history({ verbose: true });
      setHistory(h);
      setPgn(g.pgn());

      requestEval(g.fen());

      if (g.isCheckmate()) {
        playCheckmateSound();

        const updated = updateGlicko(
          player,
          { rating: 800, rd: 350 },
          g.turn() === 'b' ? 1 : 0
        );

        setPlayer(updated);

        setGameOver({
          result: g.turn() === 'b' ? 'White wins' : 'Black wins',
          reason: 'Checkmate'
        });

        setTimerRunning(false);
      }

      return g;
    });
  }, [player, requestEval]);

  /* ---------------- BOT ---------------- */
  const triggerBot = useCallback(async (fen, depth) => {
    if (!engineRef.current || botLock.current) return;

    botLock.current = true;
    setIsThinking(true);

    try {
      const temp = new Chess(fen);
      const legal = temp.moves({ verbose: true });

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

      const c = candidates[i];

      applyMove(c.substring(0, 2), c.substring(2, 4), c[4]);

    } catch (e) {
      console.error(e);
    }

    setIsThinking(false);
    botLock.current = false;
  }, [applyMove]);

  /* ---------------- CLICK ---------------- */
  const handleSquareClick = useCallback((square) => {
    if (gameOver || isThinking) return;

    const g = game;

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

      if (move.promotion) {
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

      if (piece?.color === 'w') {
        setSelectedSquare(square);
        setLegalMoves(g.moves({ square, verbose: true }).map(m => m.to));
      }
    }
  }, [game, selectedSquare, legalMoves, gameOver, isThinking, triggerBot, selectedBot]);

  /* ---------------- PGN IMPORT ---------------- */
  const importPGN = (text) => {
    const g = new Chess();
    g.loadPgn(text);
    setGame(new Chess(g.fen()));
    setPgn(text);
  };

  /* ---------------- UI ---------------- */
  if (!selectedBot) {
    return (
      <div className="p-4">
        <h2>Select Bot</h2>
        {BOTS.map(b => (
          <button key={b.id} onClick={() => setSelectedBot(b)}>
            {b.emoji} {b.name}
          </button>
        ))}

        <textarea
          placeholder="Paste PGN to load game"
          onBlur={(e) => importPGN(e.target.value)}
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen">

      <GameHeader mode="bot" onBack={onBack} botName={selectedBot.name} />

      {/* ♟️ BOARD */}
      <ChessBoard
        game={game}
        selectedSquare={selectedSquare}
        legalMoves={legalMoves}
        lastMove={lastMove}
        onSquareClick={handleSquareClick}
        checkSquare={checkSquare}
        evalScore={evalScore}
      />

      <GameTimer
        whiteTime={whiteTime}
        blackTime={blackTime}
        activeColor={game.turn()}
        isRunning={timerRunning}
      />

      {/* PGN EXPORT */}
      <div className="p-2 text-sm">
        <button onClick={() => navigator.clipboard.writeText(pgn)}>
          Copy PGN
        </button>
      </div>

      <MoveHistory history={history} />

      {/* PROMOTION */}
      {promotionMove && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center">
          <div className="bg-white p-4 flex gap-2 rounded-xl">
            {['q','r','b','n'].map(p => (
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
                  setPgn(g.pgn());

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
