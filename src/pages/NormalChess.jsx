import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
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

// ============================================
// CONSTANTS & UTILITIES
// ============================================
const PIECE_VALUES = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 };

const BOTS = [
  { id: 'astra', name: 'Astra', emoji: '🌱', label: 'Beginner', depth: 8, searchTime: 300, topMovePool: 25, personality: 'Greedy but clumsy.' },
  { id: 'orion', name: 'Orion', emoji: '⭐', label: 'Easy', depth: 14, searchTime: 800, topMovePool: 20, personality: "Human-like tactical misses." },
  { id: 'titanx', name: 'TitanX', emoji: '⚔️', label: 'Intermediate', depth: 20, searchTime: 1500, topMovePool: 15, personality: 'Strong but prone to inaccuracies.' },
  { id: 'vortex', name: 'Vortex', emoji: '🌪️', label: 'Advanced', depth: 26, searchTime: 3000, topMovePool: 10, personality: 'High precision, top-4 variance.' },
  { id: 'zenith', name: 'Zenith', emoji: '👑', label: 'Master', depth: 32, searchTime: 6000, topMovePool: 6, personality: 'GM-weighted distribution.' },
  { id: 'phoenix', name: 'Phoenix Prime', emoji: '🔥', label: 'Maximum', depth: 35, searchTime: 12000, topMovePool: 3, personality: 'The Human Super-GM.' },
  { id: 'beast', name: 'The Beast of Baku', emoji: '🐉', label: 'Impossible', depth: 38, searchTime: 10000, topMovePool: 1, personality: 'Absolute engine perfection.' }
];

const getSmartFallback = (fen) => {
  const tempGame = new Chess(fen);
  const moves = tempGame.moves({ verbose: true });
  if (!moves.length) return null;
  return [...moves].sort((a, b) => {
    if (a.san.includes('#')) return -1;
    if (b.san.includes('#')) return 1;
    const aVal = a.captured ? PIECE_VALUES[a.captured] : 0;
    const bVal = b.captured ? PIECE_VALUES[b.captured] : 0;
    if (aVal !== bVal) return bVal - aVal;
    return (a.san.includes('+') ? -1 : 1) - (b.san.includes('+') ? -1 : 1);
  })[0];
};

const throttledSound = (fn) => {
  let lastSoundTime = 0;
  return (...args) => {
    const now = Date.now();
    if (now - lastSoundTime > 100) {
      lastSoundTime = now;
      Promise.resolve(fn(...args)).catch(() => {});
    }
  };
};

const playSfx = {
  move: throttledSound(playMoveSound),
  capture: throttledSound(playCaptureSound),
  check: throttledSound(playCheckSound),
  checkmate: throttledSound(playCheckmateSound),
  start: throttledSound(playGameStartSound)
};

export default function NormalChess({ timerMode, onBack }) {
  // --- Core State ---
  const initialGame = useMemo(() => new Chess(), []);
  const [game, setGame] = useState(initialGame);
  const [selectedBot, setSelectedBot] = useState(null);
  const [playerColor, setPlayerColor] = useState('w');
  const [positionHistory, setPositionHistory] = useState([]);
  const [selectedSquare, setSelectedSquare] = useState(null);
  const [legalMoves, setLegalMoves] = useState([]);
  const [lastMove, setLastMove] = useState(null);
  const [checkSquare, setCheckSquare] = useState(null);
  const [gameOver, setGameOver] = useState(null);
  const [history, setHistory] = useState([]);
  const [isThinking, setIsThinking] = useState(false);
  const [thinkTime, setThinkTime] = useState("0.0");
  const [promotionMove, setPromotionMove] = useState(null);
  const [autoQueen, setAutoQueen] = useState(false);
  const [premoveMove, setPremoveMove] = useState(null);
  const [whiteTime, setWhiteTime] = useState(timerMode?.seconds || 600);
  const [blackTime, setBlackTime] = useState(timerMode?.seconds || 600);
  const [timerRunning, setTimerRunning] = useState(false);

  // --- Refs ---
  const mountedRef = useRef(true);
  const gameRef = useRef(initialGame);
  const engineRef = useRef(null);
  const engineBusyRef = useRef(false);
  const botLock = useRef(false);
  const timerRef = useRef(null);
  const thinkRef = useRef(null);
  const botTimeoutRef = useRef(null);
  const premoveTimeoutRef = useRef(null);
  const selectedBotRef = useRef(null);
  const gameOverRef = useRef(false);
  const premoveRef = useRef(null);
  const analysisIdRef = useRef(0);
  const lastTickRef = useRef(Date.now());
  const whiteTimeRef = useRef(0);
  const blackTimeRef = useRef(0);
  const applySideEffectsRef = useRef(null);

  const actionQueue = useRef(Promise.resolve());
  const enqueue = (fn) => {
    actionQueue.current = actionQueue.current.then(fn).catch(() => {});
  };

  const increment = timerMode?.increment || 0;

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  useEffect(() => { gameRef.current = game; }, [game]);
  useEffect(() => { whiteTimeRef.current = whiteTime; }, [whiteTime]);
  useEffect(() => { blackTimeRef.current = blackTime; }, [blackTime]);
  useEffect(() => { selectedBotRef.current = selectedBot; }, [selectedBot]);

  useEffect(() => {
    gameOverRef.current = !!gameOver;
  }, [gameOver]);

  useEffect(() => {
    engineRef.current = createStockfish();
    return () => {
      engineRef.current?.stop?.();
      engineRef.current?.terminate?.();
      clearAllAsync();
    };
  }, []);

  const clearAllAsync = useCallback(() => {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
    if (thinkRef.current) { clearInterval(thinkRef.current); thinkRef.current = null; }
    if (botTimeoutRef.current) { clearTimeout(botTimeoutRef.current); botTimeoutRef.current = null; }
    if (premoveTimeoutRef.current) { clearTimeout(premoveTimeoutRef.current); premoveTimeoutRef.current = null; }
    botLock.current = false;
    engineBusyRef.current = false;
    if (mountedRef.current) {
      setIsThinking(false);
      setThinkTime("0.0");
    }
  }, []);

  const updateCheckSquare = useCallback((g) => {
    if (!g.inCheck()) { setCheckSquare(null); return; }
    const board = g.board();
    for (let r = 0; r < 8; r++) {
      for (let f = 0; f < 8; f++) {
        const p = board[r][f];
        if (p && p.type === 'k' && p.color === g.turn()) {
          setCheckSquare(String.fromCharCode(97 + f) + (8 - r));
          return;
        }
      }
    }
  }, []);

  const applySideEffectsAndState = useCallback((newGame, moveResult, isPremove = false, callId) => {
    if (gameOverRef.current || (callId !== undefined && callId !== analysisIdRef.current)) return;

    const isGameOver = newGame.isGameOver();
    const movedColor = newGame.turn() === 'w' ? 'b' : 'w';
    const finalWhite = (!isGameOver && movedColor === 'w') ? whiteTimeRef.current + increment : whiteTimeRef.current;
    const finalBlack = (!isGameOver && movedColor === 'b') ? blackTimeRef.current + increment : blackTimeRef.current;

    setWhiteTime(finalWhite); setBlackTime(finalBlack);
    whiteTimeRef.current = finalWhite; blackTimeRef.current = finalBlack;

    setPositionHistory(prev => {
      const next = [...prev, { fen: newGame.fen(), whiteTime: finalWhite, blackTime: finalBlack }];
      return next.length > 500 ? next.slice(-500) : next;
    });

    if (isGameOver) {
      gameOverRef.current = true;
      setTimerRunning(false);
      if (newGame.isCheckmate()) {
        playSfx.checkmate();
        setGameOver({ result: newGame.turn() === 'w' ? 'Black wins' : 'White wins', reason: 'Checkmate' });
      } else {
        playSfx.move();
        let reason = 'Draw';
        if (newGame.isStalemate()) reason = 'Stalemate';
        else if (newGame.isThreefoldRepetition()) reason = 'Threefold Repetition';
        else if (newGame.isInsufficientMaterial()) reason = 'Insufficient Material';
        else if (newGame.isDrawByFiftyMoves()) reason = '50-Move Rule';
        setGameOver({ result: 'Draw', reason });
      }
    } else {
      newGame.inCheck() ? playSfx.check() : (moveResult.captured ? playSfx.capture() : playSfx.move());
    }

    setGame(newGame);
    setLastMove({ from: moveResult.from, to: moveResult.to });
    setHistory(newGame.history({ verbose: true }).slice(-300));
    setSelectedSquare(null); setLegalMoves([]);
    updateCheckSquare(newGame);

    if (!isPremove && !isGameOver) {
      const queuedPremove = premoveRef.current;
      if (queuedPremove && newGame.turn() === playerColor) {
        const pGame = new Chess(newGame.fen());
        try {
          const pResult = pGame.move(queuedPremove);
          if (pResult) {
            const premoveAnalysisId = analysisIdRef.current;
            setPremoveMove(null);
            if (premoveTimeoutRef.current) clearTimeout(premoveTimeoutRef.current);
            premoveTimeoutRef.current = setTimeout(() => {
              if (!mountedRef.current || premoveAnalysisId !== analysisIdRef.current) return;
              enqueue(() => applySideEffectsRef.current?.(pGame, pResult, true, premoveAnalysisId));
              premoveTimeoutRef.current = null;
            }, 50);
            return;
          }
        } catch { }
        setPremoveMove(null);
      }
    }

    if (!isGameOver && newGame.turn() !== playerColor) {
      scheduleBotMove(newGame.fen(), 250);
    }
  }, [increment, playerColor, updateCheckSquare]);

  useEffect(() => { applySideEffectsRef.current = applySideEffectsAndState; }, [applySideEffectsAndState]);

  const triggerBot = useCallback(async (fen, bot) => {
    const currentEngine = engineRef.current;
    if (
      botLock.current ||
      engineBusyRef.current ||
      gameOverRef.current ||
      !currentEngine
    ) return;

    const myId = ++analysisIdRef.current;
    botLock.current = true;
    if (mountedRef.current) setIsThinking(true);

    if (thinkRef.current) { clearInterval(thinkRef.current); thinkRef.current = null; }
    const start = Date.now();
    thinkRef.current = setInterval(() => {
      if (mountedRef.current) setThinkTime(((Date.now() - start) / 1000).toFixed(1));
    }, 500);

    try {
      currentEngine.stop?.();
      await currentEngine.waitUntilReady?.();
      if (currentEngine !== engineRef.current || myId !== analysisIdRef.current || gameOverRef.current) return;

      const g = new Chess(fen);
      const allMoves = g.moves({ verbose: true });
      if (!allMoves.length) return;

      engineBusyRef.current = true;
      const rawPool = await Promise.race([
        currentEngine.getBestMoveFromPool(fen, bot.depth, bot.topMovePool, bot.searchTime),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Engine timeout')), 15000))
      ]);

      if (currentEngine !== engineRef.current || myId !== analysisIdRef.current || gameOverRef.current) return;

      const engineMoves = Array.isArray(rawPool)
        ? rawPool.map(s => allMoves.find(m => (m.from + m.to + (m.promotion || '')) === s)).filter(Boolean)
        : [];

      const safeMove = (idx) => engineMoves[Math.min(idx, engineMoves.length - 1)] || engineMoves[0];
      let finalMove = engineMoves[0] || getSmartFallback(fen);

      if (!finalMove || gameRef.current.fen() !== fen) return;

      if (engineMoves.length > 0) {
        const r = Math.random();
        const totalMoves = allMoves.length;

        if (bot.id === 'astra') {
          if (r < 0.60) finalMove = allMoves[Math.floor(Math.random() * totalMoves)];
          else if (r < 0.90) finalMove = safeMove(Math.floor(engineMoves.length * 0.7 + Math.random() * engineMoves.length * 0.3));
          else finalMove = safeMove(Math.floor(Math.random() * Math.min(5, engineMoves.length)));

        } else if (bot.id === 'orion') {
          if (r < 0.25) finalMove = allMoves[Math.floor(Math.random() * totalMoves)];
          else if (r < 0.65) finalMove = safeMove(Math.floor(engineMoves.length * 0.5 + Math.random() * engineMoves.length * 0.5));
          else finalMove = safeMove(Math.floor(Math.random() * Math.min(6, engineMoves.length)));

        } else if (bot.id === 'titanx') {
          if (r < 0.08) finalMove = allMoves[Math.floor(Math.random() * totalMoves)];
          else if (r < 0.33) finalMove = safeMove(Math.floor(Math.random() * Math.min(5, engineMoves.length)));
          else finalMove = safeMove(r < 0.75 ? 1 : 0);

        } else if (bot.id === 'vortex') {
          finalMove = r < 0.05 ? safeMove(Math.floor(Math.random() * Math.min(4, engineMoves.length)))
                                : safeMove(r < 0.60 ? 1 : 0);

        } else if (bot.id === 'zenith') {
          finalMove = r < 0.90 ? engineMoves[0] : safeMove(1);

        } else if (bot.id === 'phoenix') {
          finalMove = r < 0.97 ? engineMoves[0] : safeMove(1);

        } else {
          finalMove = engineMoves[0];
        }
      }

      const nextG = new Chess(fen);
      const res = nextG.move(finalMove);
      if (res) enqueue(() => applySideEffectsRef.current(nextG, res, false, myId));

    } catch (e) {
      if (currentEngine !== engineRef.current || myId !== analysisIdRef.current || gameOverRef.current) return;
      const oldEngine = engineRef.current;
      try { oldEngine?.stop?.(); oldEngine?.terminate?.(); } catch {}
      engineRef.current = createStockfish();

      const fb = getSmartFallback(fen);
      if (fb && gameRef.current.fen() === fen) {
        const n = new Chess(fen);
        const r = n.move(fb);
        if (r) enqueue(() => applySideEffectsRef.current(n, r, false, myId));
      }
    } finally {
      engineBusyRef.current = false;
      if (myId === analysisIdRef.current && mountedRef.current) {
        if (thinkRef.current) { clearInterval(thinkRef.current); thinkRef.current = null; }
        setIsThinking(false); setThinkTime("0.0"); botLock.current = false;
      }
    }
  }, []);

  const scheduleBotMove = useCallback((scheduledFen, delay = 250) => {
    const scheduleId = analysisIdRef.current;
    if (botTimeoutRef.current) clearTimeout(botTimeoutRef.current);
    botTimeoutRef.current = setTimeout(() => {
      if (scheduleId !== analysisIdRef.current || gameRef.current.fen() !== scheduledFen || !selectedBotRef.current || gameOverRef.current) return;
      triggerBot(scheduledFen, selectedBotRef.current);
      botTimeoutRef.current = null;
    }, delay);
  }, [triggerBot]);

  const initializeGame = useCallback((color, botToPlay) => {
    analysisIdRef.current++;
    const oldEngine = engineRef.current;
    try { oldEngine?.terminate?.(); } catch {}
    engineRef.current = createStockfish();

    clearAllAsync();
    gameOverRef.current = false;
    const freshGame = new Chess();
    const baseTime = timerMode?.seconds || 600;
    setGame(freshGame);
    setPositionHistory([{ fen: freshGame.fen(), whiteTime: baseTime, blackTime: baseTime }]);
    setSelectedSquare(null); setLegalMoves([]); setLastMove(null); setCheckSquare(null);
    setGameOver(null); setHistory([]); setThinkTime("0.0");
    setWhiteTime(baseTime); setBlackTime(baseTime);
    whiteTimeRef.current = baseTime; blackTimeRef.current = baseTime;
    setTimerRunning(false);
    playSfx.start();
    if (color === 'b') { setTimerRunning(true); scheduleBotMove(freshGame.fen(), 600); }
  }, [clearAllAsync, timerMode, scheduleBotMove]);

  const handleUndo = () => {
    if (isThinking || positionHistory.length < 2) return;
    analysisIdRef.current++;
    engineRef.current?.stop?.();
    clearAllAsync();
    let newHist = positionHistory.slice(0, Math.max(1, positionHistory.length - (gameRef.current.turn() === playerColor ? 2 : 1)));
    const prev = newHist[newHist.length - 1];
    if (!prev) return;
    const restored = new Chess(prev.fen);
    setGame(restored);
    setWhiteTime(prev.whiteTime); setBlackTime(prev.blackTime);
    whiteTimeRef.current = prev.whiteTime; blackTimeRef.current = prev.blackTime;
    setPositionHistory(newHist);
    setHistory(restored.history({ verbose: true }));
    setSelectedSquare(null); setLegalMoves([]); setLastMove(null); setGameOver(null); setPremoveMove(null);
    gameOverRef.current = false;
    updateCheckSquare(restored);
  };

  const handleSquareClick = useCallback((square) => {
    if (gameOverRef.current || promotionMove) return;
    const curr = gameRef.current;
    if (curr.turn() !== playerColor) {
      if (selectedSquare) {
        const piece = curr.get(selectedSquare);
        if (piece && piece.color === playerColor) {
          setPremoveMove({ from: selectedSquare, to: square, promotion: 'q' });
        }
        setSelectedSquare(null);
      } else if (curr.get(square)?.color === playerColor) {
        setSelectedSquare(square);
      }
      return;
    }
    if (!timerRunning) setTimerRunning(true);
    if (selectedSquare && legalMoves.includes(square)) {
      const move = curr.moves({ square: selectedSquare, verbose: true }).find(m => m.to === square);
      if (move?.flags?.includes('p') || (curr.get(selectedSquare)?.type === 'p' && (square[1] === '8' || square[1] === '1'))) {
        if (autoQueen) {
          const n = new Chess(curr.fen());
          const r = n.move({ from: selectedSquare, to: square, promotion: 'q' });
          if (r) enqueue(() => applySideEffectsRef.current(n, r));
        } else {
          engineRef.current?.stop?.();
          if (botTimeoutRef.current) clearTimeout(botTimeoutRef.current);
          setPromotionMove({ from: selectedSquare, to: square });
        }
        setSelectedSquare(null); setLegalMoves([]); return;
      }
      const n = new Chess(curr.fen());
      const r = n.move({ from: selectedSquare, to: square });
      if (r) enqueue(() => applySideEffectsRef.current(n, r));
    } else {
      const p = curr.get(square);
      if (p?.color === playerColor) {
        setSelectedSquare(square);
        setLegalMoves(curr.moves({ square, verbose: true }).map(m => m.to));
      } else {
        setSelectedSquare(null); setLegalMoves([]);
      }
    }
  }, [playerColor, timerRunning, promotionMove, selectedSquare, legalMoves, autoQueen]);

  const boardProps = useMemo(() => ({
    game, selectedSquare, legalMoves, lastMove, checkSquare, premoveMove, boardOrientation: playerColor
  }), [game, selectedSquare, legalMoves, lastMove, checkSquare, premoveMove, playerColor]);

  useEffect(() => {
    if (!timerRunning || gameOver) return;
    lastTickRef.current = Date.now();
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      const elapsed = Date.now() - lastTickRef.current;
      if (elapsed >= 1000) {
        const delta = Math.floor(elapsed / 1000);
        lastTickRef.current += delta * 1000;
        const turn = gameRef.current.turn();
        if (turn === 'w') {
          setWhiteTime(t => {
            const n = Math.max(0, t - delta);
            if (n <= 0 && !gameOverRef.current) {
              gameOverRef.current = true;
              setGameOver({ result: 'Black wins', reason: 'Timeout' });
              setTimerRunning(false);
            }
            return n;
          });
        } else {
          setBlackTime(t => {
            const n = Math.max(0, t - delta);
            if (n <= 0 && !gameOverRef.current) {
              gameOverRef.current = true;
              setGameOver({ result: 'White wins', reason: 'Timeout' });
              setTimerRunning(false);
            }
            return n;
          });
        }
      }
    }, 200);
    return () => { if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; } };
  }, [timerRunning, gameOver]);

  if (!selectedBot) {
    return (
      <div className="min-h-screen bg-background flex flex-col p-4 max-w-md mx-auto">
        <button onClick={onBack} className="mb-4 text-sm opacity-60">← Main Menu</button>
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold">Battle the Engine</h2>
          <select value={playerColor} onChange={(e) => setPlayerColor(e.target.value)} className="bg-secondary p-2 rounded-lg text-sm">
            <option value="w">Play White</option>
            <option value="b">Play Black</option>
          </select>
        </div>
        <div className="grid gap-3">
          {BOTS.map(bot => (
            <button key={bot.id} onClick={() => { setSelectedBot(bot); initializeGame(playerColor, bot); }} className="flex items-center gap-4 p-4 rounded-2xl border bg-card hover:bg-secondary/50 transition">
              <span className="text-3xl">{bot.emoji}</span>
              <div className="text-left flex-1">
                <div className="font-bold">{bot.name} <span className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded bg-secondary">{bot.label}</span></div>
                <div className="text-xs italic opacity-70">"{bot.personality}"</div>
              </div>
            </button>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
       <GameHeader mode="normal" onBack={() => { engineRef.current?.stop?.(); clearAllAsync(); onBack(); }} botName={selectedBot.name} />
       <div className="flex-1 flex flex-col lg:flex-row items-center justify-center gap-8 p-4">
          <div className="relative flex flex-col items-center gap-4">
            <div className="flex items-center gap-3 w-full px-2">
              <span className="text-2xl">{selectedBot.emoji}</span>
              <span className="font-bold text-xl flex-1">{selectedBot.name}</span>
              {isThinking && <span className="text-xs font-mono px-3 py-1 rounded-full border text-primary animate-pulse">THINKING {thinkTime}s</span>}
            </div>
            <ChessBoard {...boardProps} onSquareClick={handleSquareClick} />
            {promotionMove && (
              <div className="absolute inset-0 z-50 flex items-center justify-center bg-background/60 backdrop-blur-sm">
                <div className="flex gap-4 p-6 bg-card rounded-2xl border shadow-2xl">
                  {['q', 'r', 'b', 'n'].map(p => (
                    <button key={p} onClick={() => {
                        const n = new Chess(gameRef.current.fen());
                        const r = n.move({ ...promotionMove, promotion: p });
                        if (r) enqueue(() => applySideEffectsRef.current(n, r));
                        if (mountedRef.current) setPromotionMove(null);
                    }} className="text-4xl hover:scale-125 transition">
                      {p === 'q' ? '♛' : p === 'r' ? '♜' : p === 'b' ? '♝' : '♞'}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
          <div className="flex flex-col gap-4 w-full max-w-xs">
            <GameTimer whiteTime={whiteTime} blackTime={blackTime} activeColor={game.turn()} isRunning={timerRunning} />
            <div className="grid grid-cols-2 gap-2">
              <button onClick={handleUndo} disabled={isThinking || positionHistory.length < 2} className="py-3 rounded-xl bg-secondary font-bold">Undo</button>
              <button onClick={() => initializeGame(playerColor, selectedBot)} className="py-3 rounded-xl bg-secondary font-bold">Restart</button>
            </div>
            <div className="h-64 border rounded-xl overflow-hidden bg-card"><MoveHistory history={history} /></div>
          </div>
       </div>
       <GameOverModal result={gameOver?.result} reason={gameOver?.reason} onRematch={() => initializeGame(playerColor, selectedBot)} onMenu={onBack} />
    </div>
  );
}
