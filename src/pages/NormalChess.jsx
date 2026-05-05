import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Chess } from 'chess.js';
import ChessBoard from '../components/chess/ChessBoard';
import MoveHistory from '../components/chess/MoveHistory';
import GameTimer from '../components/chess/GameTimer';
import GameHeader from '../components/chess/GameHeader';
import GameOverModal from '../components/chess/GameOverModal';
import { playMoveSound, playCaptureSound, playCheckSound, playCheckmateSound, playGameStartSound } from '../lib/chessSounds';
import { createStockfish } from '../engine/stockfishBot';

const BOTS = [
  {
    id: 'astra',
    name: 'Astra',
    emoji: '🌱',
    label: 'Beginner',
    personality: 'Still learning…',
    useEngine: false,
    depth: 0,
    poolSize: 0,
    inaccuracyRate: 0.70,
    blunderRate: 0.25,
    topMovePool: 0
  },
  {
    id: 'orion',
    name: 'Orion',
    emoji: '⭐',
    label: 'Easy',
    personality: "Let's play!",
    useEngine: true,
    depth: 12,
    poolSize: 1,
    inaccuracyRate: 0.25,
    blunderRate: 0.15,
    topMovePool: 7
  },
  {
    id: 'titanx',
    name: 'TitanX',
    emoji: '⚔️',
    label: 'Intermediate',
    personality: 'Stay sharp.',
    useEngine: true,
    depth: 18,
    poolSize: 1,
    inaccuracyRate: 0.20,
    blunderRate: 0.05,
    topMovePool: 7
  },
  {
    id: 'vortex',
    name: 'Vortex',
    emoji: '🌪️',
    label: 'Advanced',
    personality: 'I see everything.',
    useEngine: true,
    depth: 22,
    poolSize: 1,
    inaccuracyRate: 0.15,
    blunderRate: 0.00,
    topMovePool: 7
  },
  {
    id: 'zenith',
    name: 'Zenith',
    emoji: '👑',
    label: 'Master',
    personality: 'You must be precise.',
    useEngine: true,
    depth: 26,
    poolSize: 6,
    inaccuracyRate: 0.00,
    blunderRate: 0.00,
    topMovePool: 6
  },
  {
    id: 'phoenix',
    name: 'Phoenix Prime',
    emoji: '🔥',
    label: 'Maximum',
    personality: 'This is your end.',
    useEngine: true,
    depth: 30,
    poolSize: 3,
    inaccuracyRate: 0.00,
    blunderRate: 0.00,
    topMovePool: 3
  }
];

const PROMOTION_PIECES = [
  { value: 'q', name: 'Queen'  },
  { value: 'r', name: 'Rook'   },
  { value: 'b', name: 'Bishop' },
  { value: 'n', name: 'Knight' },
];

const PIECE_IMAGES = {
  wq: 'https://www.chess.com/chess-themes/pieces/neo/150/wq.png',
  wr: 'https://www.chess.com/chess-themes/pieces/neo/150/wr.png',
  wb: 'https://www.chess.com/chess-themes/pieces/neo/150/wb.png',
  wn: 'https://www.chess.com/chess-themes/pieces/neo/150/wn.png',
  bq: 'https://www.chess.com/chess-themes/pieces/neo/150/bq.png',
  br: 'https://www.chess.com/chess-themes/pieces/neo/150/br.png',
  bb: 'https://www.chess.com/chess-themes/pieces/neo/150/bb.png',
  bn: 'https://www.chess.com/chess-themes/pieces/neo/150/bn.png',
};

function scoreMoves(moves) {
  const PV = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 100 };
  const scored = moves.map(m => ({
    move: m,
    score: (m.captured ? PV[m.captured] : 0) + Math.random() * 2
  }));
  scored.sort((a, b) => b.score - a.score);
  return scored.map(s => s.move);
}

function getBotMove(game, allMoves, engineMoves, bot) {
  if (!engineMoves || engineMoves.length === 0) {
    return allMoves[Math.floor(Math.random() * allMoves.length)];
  }

  const rand = Math.random();

  if (bot.id === 'astra') {
    if (rand < 0.25) {
      return allMoves[Math.floor(Math.random() * allMoves.length)];
    } else if (rand < 0.95) {
      const scored = scoreMoves(allMoves);
      const weakPool = scored.slice(Math.floor(scored.length * 0.5));
      return weakPool[Math.floor(Math.random() * weakPool.length)];
    } else {
      return engineMoves[0];
    }
  }

  else if (bot.id === 'orion') {
    if (rand < 0.15) {
      return allMoves[Math.floor(Math.random() * allMoves.length)];
    } else if (rand < 0.40) {
      const pool = engineMoves.slice(0, Math.min(7, engineMoves.length));
      return pool[Math.floor(Math.random() * pool.length)];
    } else {
      return engineMoves[0];
    }
  }

  else if (bot.id === 'titanx') {
    if (rand < 0.05) {
      return allMoves[Math.floor(Math.random() * allMoves.length)];
    } else if (rand < 0.25) {
      const pool = engineMoves.slice(0, Math.min(7, engineMoves.length));
      return pool[Math.floor(Math.random() * pool.length)];
    } else {
      return engineMoves[0];
    }
  }

  else if (bot.id === 'vortex') {
    if (rand < 0.15) {
      const pool = engineMoves.slice(0, Math.min(7, engineMoves.length));
      return pool[Math.floor(Math.random() * pool.length)];
    } else {
      return engineMoves[0];
    }
  }

  else if (bot.id === 'zenith') {
    const pool = engineMoves.slice(0, Math.min(6, engineMoves.length));
    if (pool.length === 0) return engineMoves[0];

    const weights = [0.50, 0.25, 0.15, 0.08, 0.01, 0.01];
    let cumulative = 0;

    for (let i = 0; i < pool.length; i++) {
      cumulative += weights[i];
      if (rand < cumulative) return pool[i];
    }

    return pool[0];
  }

  else if (bot.id === 'phoenix') {
    const pool = engineMoves.slice(0, Math.min(3, engineMoves.length));
    if (pool.length === 0) return engineMoves[0];

    if (rand < 0.80) return pool[0];
    if (rand < 0.95) return pool[1] || pool[0];
    return pool[2] || pool[0];
  }

  return engineMoves[0];
}

function getSimpleMove(fen) {
  const g = new Chess(fen);
  const moves = g.moves({ verbose: true });
  if (!moves.length) return null;
  const PV = { p:1, n:3, b:3, r:5, q:9, k:0 };
  const scored = moves.map(m => ({
    m,
    score: (m.captured ? PV[m.captured]*10 : 0) + Math.random() * 3
  }));
  scored.sort((a,b) => b.score - a.score);
  const weakPool = scored.slice(Math.floor(scored.length * 0.5));
  const chosen = weakPool[Math.floor(Math.random() * weakPool.length)];
  return chosen.m;
}

export default function NormalChess({ timerMode, onBack }) {
  const [selectedBot, setSelectedBot] = useState(null);
  const [game, setGame] = useState(new Chess());
  const [selectedSquare, setSelectedSquare] = useState(null);
  const [legalMoves, setLegalMoves] = useState([]);
  const [lastMove, setLastMove] = useState(null);
  const [checkSquare, setCheckSquare] = useState(null);
  const [gameOver, setGameOver] = useState(null);
  const [history, setHistory] = useState([]);
  const [isThinking, setIsThinking] = useState(false);
  const [thinkTime, setThinkTime] = useState(0);
  const [promotionMove, setPromotionMove] = useState(null);
  const [resignConfirm, setResignConfirm] = useState(false);
  const [drawOffer, setDrawOffer] = useState(false);

  const [whiteTime, setWhiteTime] = useState(timerMode?.seconds || 600);
  const [blackTime, setBlackTime] = useState(timerMode?.seconds || 600);
  const [increment] = useState(timerMode?.increment || 0);
  const [timerRunning, setTimerRunning] = useState(false);

  const timerRef = useRef(null);
  const thinkTimerRef = useRef(null);
  const gameRef = useRef(game);
  const engineRef = useRef(null);
  const botLock = useRef(false);
  gameRef.current = game;

  useEffect(() => {
    engineRef.current = createStockfish();
    return () => { engineRef.current?.terminate(); };
  }, []);

  useEffect(() => {
    if (selectedBot) playGameStartSound();
  }, [selectedBot]);

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

  const addIncrement = useCallback((color) => {
    if (increment <= 0) return;
    if (color === 'w') setWhiteTime(t => t + increment);
    else setBlackTime(t => t + increment);
  }, [increment]);

  const endByTimeout = (color) => {
    clearInterval(timerRef.current);
    setTimerRunning(false);
    setGameOver({ result: color === 'w' ? 'Black wins' : 'White wins', reason: 'Time out' });
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

  const applyBotMove = useCallback((from, to, promotion) => {
    clearInterval(thinkTimerRef.current);
    setThinkTime(0);
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
        addIncrement('b');
        if (newGame.isCheckmate()) {
          playCheckmateSound(); setTimerRunning(false);
          setGameOver({ result: 'Black wins', reason: 'Checkmate' });
        } else if (newGame.isDraw()) {
          setTimerRunning(false);
          setGameOver({ result: 'Draw', reason: 'Stalemate or draw rule' });
        }
        return newGame;
      } catch { return prev; }
    });
  }, [updateCheckSquare, addIncrement]);

  const triggerBot = useCallback(async (fen, bot) => {
    if (botLock.current) return;
    botLock.current = true;
    setIsThinking(true);

    const g = new Chess(fen);

    try {
      let move = null;

      if (bot.id === 'astra') {
        const allMoves = g.moves({ verbose: true });
        move = getBotMove(g, allMoves, allMoves, bot);
      } else {
        const allMoves = g.moves({ verbose: true });
        
        const movsToRequest = Math.max(7, bot.topMovePool || 7);
        const engineMoveStrings = await engineRef.current.getBestMoveFromPool(
          fen,
          bot.depth,
          movsToRequest
        );

        if (!engineMoveStrings || !engineMoveStrings.length) {
          move = allMoves[Math.floor(Math.random() * allMoves.length)];
        } else {
          const engineMoves = engineMoveStrings
            .map(moveStr => {
              return allMoves.find(m => {
                const uci = m.from + m.to + (m.promotion || '');
                const san = m.san;
                return uci === moveStr || san === moveStr;
              });
            })
            .filter(Boolean);

          if (engineMoves.length === 0) {
            move = allMoves[Math.floor(Math.random() * allMoves.length)];
          } else {
            move = getBotMove(g, allMoves, engineMoves, bot);
          }
        }
      }

      if (!move) {
        const allMoves = g.moves({ verbose: true });
        move = allMoves[Math.floor(Math.random() * allMoves.length)];
      }

      const thinkDelay = bot.depth === 0 ? 500 : Math.min(bot.depth * 300, 2000);
      await new Promise(resolve => setTimeout(resolve, thinkDelay));

      setIsThinking(false);
      botLock.current = false;

      applyBotMove(move.from, move.to, move.promotion);
    } catch (e) {
      console.error('Bot error:', e);
      setIsThinking(false);
      botLock.current = false;
    }
  }, [selectedBot, engineRef, applyBotMove]);

  const handleSquareClick = useCallback((square) => {
    if (gameOver || isThinking || promotionMove || resignConfirm) return;
    if (!timerRunning && history.length === 0) setTimerRunning(true);

    const turn = game.turn();  
    if (turn !== 'w') return;  

    if (selectedSquare) {  
      if (legalMoves.includes(square)) {  
        const moves = game.moves({ square: selectedSquare, verbose: true });  
        const move = moves.find(m => m.to === square);  
        const isPawnPromotion = move?.flags?.includes('p') ||  
          (game.get(selectedSquare)?.type === 'p' && turn === 'w' && square[1] === '8');  

        if (isPawnPromotion) {  
          setPromotionMove({ from: selectedSquare, to: square });  
          setSelectedSquare(null); setLegalMoves([]);  
          return;  
        }  

        const newGame = new Chess(game.fen());  
        try {  
          const result = newGame.move({ from: selectedSquare, to: square });  
          if (!result) return;  
          if (result.captured) playCaptureSound(); else playMoveSound();  
          if (newGame.inCheck() && !newGame.isCheckmate()) playCheckSound();  
          setLastMove({ from: result.from, to: result.to });  
          setHistory(newGame.history({ verbose: true }));  
          setGame(newGame);  
          updateCheckSquare(newGame);  
          setSelectedSquare(null); setLegalMoves([]);  
          addIncrement('w');  
          if (newGame.isCheckmate()) {  
            playCheckmateSound(); setTimerRunning(false);  
            setGameOver({ result: 'White wins', reason: 'Checkmate' });  
          } else if (newGame.isDraw()) {  
            setTimerRunning(false);  
            setGameOver({ result: 'Draw', reason: 'Stalemate or draw rule' });  
          } else {  
            setTimeout(() => triggerBot(newGame.fen(), selectedBot), 200);  
          }  
        } catch {}  
      } else {  
        const piece = game.get(square);  
        if (piece && piece.color === turn) {  
          setSelectedSquare(square);  
          setLegalMoves(game.moves({ square, verbose: true }).map(m => m.to));  
        } else { setSelectedSquare(null); setLegalMoves([]); }  
      }  
    } else {  
      const piece = game.get(square);  
      if (piece && piece.color === turn) {  
        setSelectedSquare(square);  
        setLegalMoves(game.moves({ square, verbose: true }).map(m => m.to));  
      }  
    }

  }, [game, selectedSquare, legalMoves, gameOver, isThinking, timerRunning,
    history, selectedBot, triggerBot, updateCheckSquare, promotionMove, resignConfirm, addIncrement]);

  const handlePromotion = (piece) => {
    if (!promotionMove) return;
    const newGame = new Chess(game.fen());
    try {
      const result = newGame.move({ from: promotionMove.from, to: promotionMove.to, promotion: piece });
      if (!result) return;
      if (result.captured) playCaptureSound(); else playMoveSound();
      setLastMove({ from: result.from, to: result.to });
      setHistory(newGame.history({ verbose: true }));
      setGame(newGame);
      updateCheckSquare(newGame);
      setPromotionMove(null);
      addIncrement('w');
      if (newGame.isCheckmate()) {
        playCheckmateSound(); setTimerRunning(false);
        setGameOver({ result: 'White wins', reason: 'Checkmate' });
      } else if (newGame.isDraw()) {
        setTimerRunning(false);
        setGameOver({ result: 'Draw', reason: 'Stalemate or draw rule' });
      } else {
        setTimeout(() => triggerBot(newGame.fen(), selectedBot), 200);
      }
    } catch {}
  };

  const handleResign = () => {
    if (!resignConfirm) { setResignConfirm(true); return; }
    clearInterval(timerRef.current);
    setTimerRunning(false);
    setGameOver({ result: 'Black wins', reason: 'You resigned' });
    setResignConfirm(false);
  };

  const handleRestart = () => {
    clearInterval(timerRef.current);
    clearInterval(thinkTimerRef.current);
    const newGame = new Chess();
    setGame(newGame); setSelectedSquare(null); setLegalMoves([]);
    setLastMove(null); setCheckSquare(null); setGameOver(null);
    setHistory([]); setWhiteTime(timerMode?.seconds || 600);
    setBlackTime(timerMode?.seconds || 600); setTimerRunning(false);
    setIsThinking(false); setThinkTime(0); setPromotionMove(null);
    setResignConfirm(false); setDrawOffer(false);
    botLock.current = false;
    playGameStartSound();
  };

  const handleUndo = () => {
    if (isThinking) return;
    const newGame = new Chess();
    game.history().slice(0, -2).forEach(m => newGame.move(m));
    setGame(newGame); setSelectedSquare(null); setLegalMoves([]);
    setLastMove(null); updateCheckSquare(newGame);
    setHistory(newGame.history({ verbose: true }));
    setPromotionMove(null); setResignConfirm(false);
  };

  if (!selectedBot) {
    return (
      <div className="min-h-screen bg-background flex flex-col font-inter">
        <div className="flex items-center px-4 py-3 border-b border-border">
          <button onClick={onBack} className="text-sm text-muted-foreground hover:text-foreground">← Menu</button>
          <h2 className="flex-1 text-center font-bold text-foreground">Choose Your Opponent</h2>
          <div className="w-12" />
        </div>
        <div className="flex-1 flex flex-col gap-3 p-4 overflow-y-auto">
          {BOTS.map(bot => (
            <button key={bot.id} onClick={() => setSelectedBot(bot)}
              className="flex items-center gap-4 px-5 py-4 rounded-2xl border border-border bg-card hover:bg-secondary/50 hover:border-primary/50 transition-all duration-200 text-left active:scale-[0.98]">
              <span className="text-3xl">{bot.emoji}</span>
              <div className="flex flex-col flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-foreground">{bot.name}</span>
                  <span className="text-xs px-2 py-0.5 rounded-full bg-secondary text-muted-foreground">{bot.label}</span>
                </div>
                <span className="text-xs text-muted-foreground italic">"{bot.personality}"</span>
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
      <GameHeader mode="normal" onBack={onBack} botName={selectedBot.name}
        gameStatus={game.inCheck() && !game.isGameOver() ? '⚠ Check!' : null} />

      {promotionMove && (  
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">  
          <div className="bg-card border border-border rounded-2xl p-6 text-center shadow-2xl">  
            <h3 className="text-foreground font-bold text-lg mb-4">Choose Promotion</h3>  
            <div className="flex gap-3">  
              {PROMOTION_PIECES.map(p => (  
                <button key={p.value} onClick={() => handlePromotion(p.value)}  
                  className="flex flex-col items-center gap-1 p-3 rounded-xl border border-border bg-secondary hover:bg-primary/20 hover:border-primary transition-all">  
                  <img src={PIECE_IMAGES['w' + p.value]} alt={p.name} style={{ width: 48, height: 48 }} />  
                  <span className="text-xs text-muted-foreground">{p.name}</span>  
                </button>  
              ))}  
            </div>  
          </div>  
        </div>  
      )}  

      {resignConfirm && (  
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">  
          <div className="bg-card border border-border rounded-2xl p-6 text-center shadow-2xl w-72">  
            <h3 className="text-foreground font-bold text-lg mb-2">Resign?</h3>  
            <p className="text-muted-foreground text-sm mb-4">Are you sure?</p>  
            <div className="flex gap-3">  
              <button onClick={() => setResignConfirm(false)}  
                className="flex-1 py-2 rounded-xl border border-border text-foreground font-semibold">Cancel</button>  
              <button onClick={handleResign}  
                className="flex-1 py-2 rounded-xl bg-red-500 text-white font-bold">Resign</button>  
            </div>  
          </div>  
        </div>  
      )}  

      {drawOffer && (  
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">  
          <div className="bg-card border border-border rounded-2xl p-6 text-center shadow-2xl w-72">  
            <h3 className="text-foreground font-bold text-lg mb-2">🤝 Offer Draw?</h3>  
            <p className="text-muted-foreground text-sm mb-4">The bot will consider your offer.</p>  
            <div className="flex gap-3">  
              <button onClick={() => setDrawOffer(false)}  
                className="flex-1 py-2 rounded-xl border border-border text-foreground font-semibold">Cancel</button>  
              <button onClick={() => {  
                setDrawOffer(false);  
                if (Math.random() > 0.5) { setTimerRunning(false); setGameOver({ result: 'Draw', reason: 'Draw agreement' }); }  
              }} className="flex-1 py-2 rounded-xl bg-primary text-primary-foreground font-bold">Offer</button>  
            </div>  
          </div>  
        </div>  
      )}  

      <div className="flex-1 flex flex-col lg:flex-row items-center lg:items-start justify-center gap-4 p-4">  
        <div className="flex flex-col items-center gap-3">  
          <div className="flex items-center justify-between w-full px-1">  
            <div className="flex items-center gap-2">  
              <span className="text-lg">{selectedBot.emoji}</span>  
              <div>  
                <span className="text-sm font-bold text-foreground">{selectedBot.name}</span>  
                {isThinking && (  
                  <span className="text-xs text-primary ml-2 animate-pulse">  
                    thinking{thinkTime > 0 ? ` ${thinkTime}s` : '…'}  
                  </span>  
                )}  
              </div>  
            </div>  
            <span className="text-xs italic text-muted-foreground">&ldquo;{selectedBot.personality}&rdquo;</span>  
          </div>  
          <ChessBoard  
            game={game} selectedSquare={selectedSquare} legalMoves={legalMoves}  
            lastMove={lastMove} onSquareClick={handleSquareClick} checkSquare={checkSquare}  
          />  
          <div className="flex items-center gap-2 w-full px-1">  
            <div className="w-3 h-3 rounded-full bg-white" />  
            <span className="text-sm font-bold text-foreground">You (White)</span>  
          </div>  
        </div>  

        <div className="flex flex-col gap-3 w-full max-w-xs lg:max-w-[240px]">  
          <GameTimer whiteTime={whiteTime} blackTime={blackTime}  
            activeColor={game.turn()} isRunning={timerRunning} />  
          {increment > 0 && (  
            <div className="text-xs text-center text-muted-foreground">+{increment}s increment</div>  
          )}  
          <div className="flex gap-2">  
            <button onClick={handleUndo} disabled={history.length < 2}  
              className="flex-1 py-2 text-xs rounded-lg bg-secondary text-foreground hover:bg-secondary/80 disabled:opacity-40 transition-colors font-medium">  
              ↩ Undo  
            </button>  
            <button onClick={handleRestart}  
              className="flex-1 py-2 text-xs rounded-lg bg-secondary text-foreground hover:bg-secondary/80 transition-colors font-medium">  
              🤝 Draw  
            </button>  
          </div>  
          <div style={{ height: '260px' }}>  
            <MoveHistory history={history} />  
          </div>  
        </div>  
      </div>  

      <GameOverModal result={gameOver?.result} reason={gameOver?.reason}  
        onRematch={handleRestart} onMenu={onBack} />  
    </div>
  );
}
