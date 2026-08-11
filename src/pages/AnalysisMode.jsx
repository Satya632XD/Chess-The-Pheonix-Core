// src/pages/AnalysisMode.jsx
//
// Rebuilt from scratch. Previously this page used a second, separate
// Stockfish wrapper (src/lib/stockfishEngine.js) that duplicated
// everything stockfishBot.js already does correctly for NormalChess.jsx.
// That duplication was the source of "analysis mode just doesn't work" —
// two engine wrappers, two sets of init/queueing logic, twice the surface
// area for something to silently break, and no way to tell which one was
// actually failing without instrumenting both.
//
// This version uses ONE engine: src/engine/stockfishBot.js, the same
// module NormalChess.jsx already uses successfully for bot play. It
// exposes getBestMoveFromPool(fen, depth, mpv, moveTime), which returns
// an array of {move, eval} sorted best-first — exactly what both live
// analysis and PGN review need (mpv=1 is just the top line).

import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { Chess } from 'chess.js';

import ChessBoard from '../components/chess/ChessBoard';
import EvalBar from '../components/chess/EvalBar';
import GameHeader from '../components/chess/GameHeader';

import { parsePgn } from '../lib/pgnParser';
import {
  analyzeGame,
  COACH_PERSONAS,
  CLASSIFICATION_COLOR,
  CLASSIFICATION_EMOJI,
} from '../lib/gameAnalysis';

import { createStockfish } from '../engine/stockfishBot';

const LIVE_DEPTH = 16;
const LIVE_MOVETIME = 1200;

const REVIEW_DEPTH = 14;
const REVIEW_MOVETIME = 1000;

// Converts a raw engine eval (centipawns, side-to-move perspective) into
// a White-positive pawn value for display (eval bar, "+1.4" labels etc).
function toWhitePerspectivePawns(evalCp, fen) {
  if (evalCp == null) return 0;
  const sideToMove = fen.split(' ')[1] === 'b' ? -1 : 1;
  return (evalCp * sideToMove) / 100;
}

function uciToSan(fen, uciMove) {
  if (!uciMove) return null;
  try {
    const g = new Chess(fen);
    const from = uciMove.slice(0, 2);
    const to = uciMove.slice(2, 4);
    const promotion = uciMove.length > 4 ? uciMove.slice(4) : undefined;
    const res = g.move({ from, to, promotion });
    return res ? { san: res.san, from, to, promotion } : null;
  } catch {
    return null;
  }
}

export default function AnalysisMode({ onBack }) {
  // --- Mode: 'live' board exploration or 'review' of an uploaded game ---
  const [mode, setMode] = useState('live');

  // --- Engine lifecycle ---
  const engineRef = useRef(null);
  const [engineReady, setEngineReady] = useState(false);
  const [engineError, setEngineError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    engineRef.current = createStockfish();

    engineRef.current
      .waitUntilReady()
      .then(() => {
        if (!cancelled) setEngineReady(true);
      })
      .catch((e) => {
        if (!cancelled) setEngineError(e?.message || 'Engine failed to start.');
      });

    return () => {
      cancelled = true;
      engineRef.current?.terminate?.();
      engineRef.current = null;
    };
  }, []);

  // =========================================================
  // LIVE ANALYSIS (explore any position on a scratch board)
  // =========================================================
  const [liveGame, setLiveGame] = useState(() => new Chess());
  const [selectedSquare, setSelectedSquare] = useState(null);
  const [legalMoves, setLegalMoves] = useState([]);
  const [lastMove, setLastMove] = useState(null);
  const [liveEvalCp, setLiveEvalCp] = useState(null);
  const [liveBestSan, setLiveBestSan] = useState(null);
  const [liveThinking, setLiveThinking] = useState(false);

  const liveRequestId = useRef(0);

  const runLiveEval = useCallback(async (fen) => {
    if (!engineRef.current) return;
    const myId = ++liveRequestId.current;
    setLiveThinking(true);
    try {
      const pool = await engineRef.current.getBestMoveFromPool(
        fen,
        LIVE_DEPTH,
        1,
        LIVE_MOVETIME
      );
      if (myId !== liveRequestId.current) return; // stale response, ignore
      const top = pool?.[0] || null;
      setLiveEvalCp(top?.eval ?? null);
      const sanInfo = top?.move ? uciToSan(fen, top.move) : null;
      setLiveBestSan(sanInfo?.san || null);
    } catch (e) {
      if (myId === liveRequestId.current) {
        setLiveEvalCp(null);
        setLiveBestSan(null);
      }
    } finally {
      if (myId === liveRequestId.current) setLiveThinking(false);
    }
  }, []);

  // Re-run eval whenever the live board position changes (and engine is up)
  useEffect(() => {
    if (!engineReady || mode !== 'live') return;
    runLiveEval(liveGame.fen());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [liveGame, engineReady, mode]);

  const handleLiveSquareClick = useCallback((square) => {
    const curr = liveGame;
    if (selectedSquare && legalMoves.includes(square)) {
      const moveList = curr.moves({ square: selectedSquare, verbose: true });
      const chosen = moveList.find((m) => m.to === square);
      const next = new Chess(curr.fen());
      const res = next.move({
        from: selectedSquare,
        to: square,
        promotion: chosen?.promotion || 'q',
      });
      if (res) {
        setLiveGame(next);
        setLastMove({ from: res.from, to: res.to });
      }
      setSelectedSquare(null);
      setLegalMoves([]);
      return;
    }

    const piece = curr.get(square);
    if (piece && piece.color === curr.turn()) {
      setSelectedSquare(square);
      setLegalMoves(curr.moves({ square, verbose: true }).map((m) => m.to));
    } else {
      setSelectedSquare(null);
      setLegalMoves([]);
    }
  }, [liveGame, selectedSquare, legalMoves]);

  const resetLiveBoard = useCallback(() => {
    engineRef.current?.stop?.();
    setLiveGame(new Chess());
    setSelectedSquare(null);
    setLegalMoves([]);
    setLastMove(null);
    setLiveEvalCp(null);
    setLiveBestSan(null);
  }, []);

  const undoLiveMove = useCallback(() => {
    const next = new Chess(liveGame.fen());
    next.undo();
    setLiveGame(next);
    setSelectedSquare(null);
    setLegalMoves([]);
    setLastMove(null);
  }, [liveGame]);

  const liveEvalPawns = useMemo(
    () => toWhitePerspectivePawns(liveEvalCp, liveGame.fen()),
    [liveEvalCp, liveGame]
  );

  // =========================================================
  // GAME REVIEW (paste/upload a PGN, get full analysis)
  // =========================================================
  const [pgnInput, setPgnInput] = useState('');
  const [reviewLoading, setReviewLoading] = useState(false);
  const [reviewProgress, setReviewProgress] = useState(0);
  const [reviewError, setReviewError] = useState(null);
  const [reviewedMoves, setReviewedMoves] = useState(null); // per-move data
  const [gameSummary, setGameSummary] = useState(null);
  const [reviewMoveIndex, setReviewMoveIndex] = useState(0);
  const [selectedCoach, setSelectedCoach] = useState('FRIENDLY');

  const fileInputRef = useRef(null);

  const runGameReview = useCallback(async () => {
    if (!engineRef.current) return;
    if (!pgnInput.trim()) {
      setReviewError('Paste or upload a PGN first.');
      return;
    }

    setReviewError(null);
    setReviewLoading(true);
    setReviewProgress(0);
    setReviewedMoves(null);
    setGameSummary(null);

    try {
      const parsed = parsePgn(pgnInput);
      const chess = new Chess();
      const total = parsed.history.length;
      const results = [];

      let prevEvalMoverPerspective = 0;

      for (let i = 0; i < total; i++) {
        const move = parsed.history[i];
        const moverColor = chess.turn();
        const beforeFen = chess.fen();
        const legalCount = chess.moves().length;

        const beforePool = await engineRef.current.getBestMoveFromPool(
          beforeFen,
          REVIEW_DEPTH,
          1,
          REVIEW_MOVETIME
        );
        const bestEntry = beforePool?.[0] || null;
        // eval from beforeFen is already in the mover's perspective
        // (stockfishBot.js reports side-to-move-relative cp).
        const bestEvalMover = bestEntry?.eval ?? 0;
        const bestSan = bestEntry?.move ? uciToSan(beforeFen, bestEntry.move)?.san : null;

        const playedResult = chess.move(move);
        const afterFen = chess.fen();

        const afterPool = await engineRef.current.getBestMoveFromPool(
          afterFen,
          REVIEW_DEPTH,
          1,
          REVIEW_MOVETIME
        );
        // afterPool's eval is from the OPPONENT's perspective (they're now
        // to move) — flip sign to get it back in the mover's perspective.
        const playedEvalMover = afterPool?.[0]?.eval != null ? -afterPool[0].eval : bestEvalMover;

        const loss = Math.max(0, bestEvalMover - playedEvalMover);

        results.push({
          index: i,
          san: playedResult?.san || move,
          moverColor,
          fenBefore: beforeFen,
          fenAfter: afterFen,
          bestSan,
          bestEval: bestEvalMover,
          playedEval: playedEvalMover,
          prevEval: prevEvalMoverPerspective,
          loss,
          legalMoves: legalCount,
          captured: playedResult?.captured,
          piece: playedResult?.piece,
        });

        prevEvalMoverPerspective = playedEvalMover;

        setReviewProgress(Math.round(((i + 1) / total) * 100));
      }

      const summary = analyzeGame(results);
      setReviewedMoves(results);
      setGameSummary(summary);
      setReviewMoveIndex(0);
    } catch (e) {
      setReviewError(e?.message || 'Failed to analyze this PGN.');
    } finally {
      setReviewLoading(false);
    }
  }, [pgnInput]);

  const handleFileUpload = useCallback((e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => setPgnInput(String(ev.target?.result || ''));
    reader.readAsText(file);
  }, []);

  const reviewBoardGame = useMemo(() => {
    if (!reviewedMoves || !reviewedMoves.length) return new Chess();
    const fen =
      reviewMoveIndex === 0
        ? new Chess().fen()
        : reviewedMoves[Math.min(reviewMoveIndex, reviewedMoves.length) - 1].fenAfter;
    return new Chess(fen);
  }, [reviewedMoves, reviewMoveIndex]);

  const currentReviewMove = reviewedMoves?.[reviewMoveIndex] || null;
  const coach = COACH_PERSONAS[selectedCoach];

  // =========================================================
  // RENDER
  // =========================================================
  return (
    <div className="min-h-screen bg-background flex flex-col">
      <GameHeader mode="analysis" onBack={onBack} botName="Analysis Mode" />

      <div className="flex items-center justify-center gap-2 py-3">
        <button
          onClick={() => setMode('live')}
          className={`px-4 py-1.5 rounded-full text-sm font-medium border ${
            mode === 'live' ? 'bg-primary text-primary-foreground' : 'bg-card'
          }`}
        >
          Live Board
        </button>
        <button
          onClick={() => setMode('review')}
          className={`px-4 py-1.5 rounded-full text-sm font-medium border ${
            mode === 'review' ? 'bg-primary text-primary-foreground' : 'bg-card'
          }`}
        >
          Game Review (PGN)
        </button>
      </div>

      {engineError && (
        <div className="mx-auto max-w-md w-full px-4 py-2 text-sm text-red-500 text-center">
          Engine error: {engineError}
        </div>
      )}
      {!engineReady && !engineError && (
        <div className="mx-auto max-w-md w-full px-4 py-2 text-sm text-muted-foreground text-center">
          Starting engine…
        </div>
      )}

      {mode === 'live' && (
        <div className="flex flex-col items-center gap-4 p-4">
          <div className="flex items-start gap-3">
            <EvalBar evalScore={liveEvalPawns} />
            <ChessBoard
              game={liveGame}
              selectedSquare={selectedSquare}
              legalMoves={legalMoves}
              lastMove={lastMove}
              onSquareClick={handleLiveSquareClick}
            />
          </div>

          <div className="text-center text-sm">
            {liveThinking ? (
              <span className="text-muted-foreground">Analyzing…</span>
            ) : (
              <>
                <span className="font-bold">
                  {liveEvalCp == null ? '—' : (liveEvalPawns > 0 ? '+' : '') + liveEvalPawns.toFixed(2)}
                </span>
                {liveBestSan && (
                  <span className="ml-2 text-muted-foreground">Best: {liveBestSan}</span>
                )}
              </>
            )}
          </div>

          <div className="flex gap-2">
            <button onClick={undoLiveMove} className="px-3 py-1.5 rounded-lg border bg-card text-sm">
              Undo
            </button>
            <button onClick={resetLiveBoard} className="px-3 py-1.5 rounded-lg border bg-card text-sm">
              Reset Board
            </button>
          </div>
        </div>
      )}

      {mode === 'review' && (
        <div className="flex flex-col items-center gap-4 p-4 max-w-2xl mx-auto w-full">
          {!reviewedMoves && (
            <div className="w-full flex flex-col gap-3">
              <textarea
                value={pgnInput}
                onChange={(e) => setPgnInput(e.target.value)}
                placeholder="Paste PGN here..."
                className="w-full h-40 p-3 rounded-lg border bg-card text-sm font-mono"
              />
              <div className="flex gap-2 items-center">
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="px-3 py-1.5 rounded-lg border bg-card text-sm"
                >
                  Upload .pgn
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pgn,.txt"
                  className="hidden"
                  onChange={handleFileUpload}
                />
                <button
                  onClick={runGameReview}
                  disabled={!engineReady || reviewLoading}
                  className="px-4 py-1.5 rounded-lg bg-primary text-primary-foreground text-sm font-medium disabled:opacity-50"
                >
                  {reviewLoading ? `Analyzing… ${reviewProgress}%` : 'Analyze Game'}
                </button>
              </div>
              {reviewError && <div className="text-sm text-red-500">{reviewError}</div>}
            </div>
          )}

          {reviewedMoves && gameSummary && (
            <div className="w-full flex flex-col gap-4">
              <div className="flex justify-center">
                <ChessBoard game={reviewBoardGame} legalMoves={[]} onSquareClick={() => {}} />
              </div>

              <div className="flex items-center justify-center gap-2">
                <button
                  onClick={() => setReviewMoveIndex((i) => Math.max(0, i - 1))}
                  className="px-3 py-1 rounded-lg border bg-card text-sm"
                >
                  ◀ Prev
                </button>
                <span className="text-sm">
                  Move {reviewMoveIndex} / {reviewedMoves.length}
                </span>
                <button
                  onClick={() => setReviewMoveIndex((i) => Math.min(reviewedMoves.length, i + 1))}
                  className="px-3 py-1 rounded-lg border bg-card text-sm"
                >
                  Next ▶
                </button>
              </div>

              {currentReviewMove && (
                <div
                  className="text-center text-sm font-medium px-3 py-2 rounded-lg"
                  style={{
                    color: CLASSIFICATION_COLOR[currentReviewMove.classification] || undefined,
                  }}
                >
                  {CLASSIFICATION_EMOJI[currentReviewMove.classification]}{' '}
                  {currentReviewMove.san} — {currentReviewMove.classification}
                  {currentReviewMove.bestSan && currentReviewMove.bestSan !== currentReviewMove.san && (
                    <span className="text-muted-foreground"> (best: {currentReviewMove.bestSan})</span>
                  )}
                </div>
              )}

              <div className="grid grid-cols-2 gap-3 text-sm bg-card rounded-lg p-4 border">
                <div>Accuracy: <span className="font-bold">{gameSummary.accuracy}%</span></div>
                <div>ACPL: <span className="font-bold">{gameSummary.acpl}</span></div>
                <div>Blunders: <span className="font-bold">{gameSummary.blunders.length}</span></div>
                <div>Brilliant: <span className="font-bold">{gameSummary.brilliantMoves.length}</span></div>
              </div>

              <div className="flex items-center gap-2 justify-center flex-wrap">
                {Object.keys(COACH_PERSONAS).map((key) => (
                  <button
                    key={key}
                    onClick={() => setSelectedCoach(key)}
                    className={`px-3 py-1 rounded-full text-xs border ${
                      selectedCoach === key ? 'bg-primary text-primary-foreground' : 'bg-card'
                    }`}
                  >
                    {COACH_PERSONAS[key].emoji} {COACH_PERSONAS[key].name}
                  </button>
                ))}
              </div>
              <div className="text-center text-sm italic">{coach.getComment(gameSummary)}</div>

              <button
                onClick={() => {
                  setReviewedMoves(null);
                  setGameSummary(null);
                  setPgnInput('');
                }}
                className="mx-auto px-4 py-1.5 rounded-lg border bg-card text-sm"
              >
                Analyze another game
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
