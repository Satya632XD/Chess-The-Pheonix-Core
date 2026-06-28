// src/pages/AnalysisMode.jsx

import React, {
  useState,
  useRef,
  useEffect,
} from 'react';

import { Chess } from 'chess.js';

import { Chessboard }
from 'react-chessboard';

import { parsePgn } from '../lib/pgnParser';

import {
  buildAnalysisText,
  downloadTextFile,
  explainMove,
} from '../lib/analysisExport';

import {
  analyzeGame,
  COACH_PERSONAS,
  CLASSIFICATION_COLOR,
  CLASSIFICATION_EMOJI,
} from '../lib/gameAnalysis';

import {
  initEngine,
  evaluatePosition,
} from '../lib/stockfishEngine';

export default function AnalysisMode({
  onBack,
}) {
  const [pgn, setPgn] =
    useState('');

  const [loading, setLoading] =
    useState(false);

  const [gameState, setGameState] =
    useState('upload');

  const [uploadedGame,
    setUploadedGame] =
    useState(null);

  const [analysis,
    setAnalysis] =
    useState(null);

  const [
    currentMoveIndex,
    setCurrentMoveIndex,
  ] = useState(0);

  const [
    selectedCoach,
    setSelectedCoach,
  ] = useState(
    'FRIENDLY'
  );

  const [
    gameNotes,
    setGameNotes,
  ] = useState({});

  // OFFLINE ANALYSIS BOARD
  const [
    analysisBoard,
    setAnalysisBoard,
  ] = useState(
    new Chess()
  );

  const fileInputRef =
    useRef(null);

  useEffect(() => {
    initEngine();
  }, []);

  // =========================
  // OFFLINE POSITION ANALYSIS
  // =========================

  async function analyzeCurrentPosition() {
    try {
      const fen =
        analysisBoard.fen();

      const result =
        await evaluatePosition(
          fen,
          12
        );

      alert(
`Best Move:
${result.bestMove}

Eval:
${result.eval}

PV:
${result.pv}`
      );
    } catch (err) {
      console.error(err);

      alert(
        'Failed to analyze position'
      );
    }
  }

  function resetOfflineBoard() {
    const freshBoard = new Chess();

    setAnalysisBoard(freshBoard);
    setPgn('');
  }

  async function analyzePgnText(pgnText) {
    const parsed =
      parsePgn(pgnText);

    const analyzedMoves =
      [];

    const chess =
      new Chess();

    for (
      let i = 0;
      i <
      parsed.history.length;
      i++
    ) {
      const move =
        parsed.history[i];

      const beforeFen =
        chess.fen();

      const movingSide =
        chess.turn();

      const beforeEval =
        await evaluatePosition(
          beforeFen,
          10
        );

      const legalMoves =
        chess.moves()
          .length;

      chess.move(move);

      const afterFen =
        chess.fen();

      const afterEval =
        await evaluatePosition(
          afterFen,
          10
        );

      const bestEval =
        beforeEval.eval;

      const playedEval =
        -afterEval.eval;

      analyzedMoves.push({
        ...move,

        moveNumber:
          Math.floor(i / 2) +
          1,

        side:
          movingSide,

        prevEval:
          i === 0
            ? 0
            : analyzedMoves[
                i - 1
              ]
                .playedEval,

        bestEval,

        playedEval,

        evalLoss:
          Math.max(
            0,
            bestEval -
              playedEval
          ),

        bestMove:
          beforeEval.bestMove,

        pv:
          beforeEval.pv,

        mate:
          afterEval.mate,

        legalMoves,
      });
    }

    const analysisResult =
      analyzeGame(
        analyzedMoves
      );

    analyzedMoves.forEach((move) => {
      move.explanation =
        explainMove(move);
    });

    setUploadedGame({
      ...parsed,
      sourcePgn: pgnText,
      moveHistory:
        analyzedMoves,
    });

    setAnalysis(
      analysisResult
    );

    setCurrentMoveIndex(
      0
    );

    setGameState(
      'analysis'
    );
  }

  // =========================
  // PGN ANALYSIS
  // =========================

  async function handlePgnUpload() {
    try {
      if (!pgn.trim()) {
        alert(
          'Please paste a PGN'
        );

        return;
      }

      setLoading(true);

      await analyzePgnText(
        pgn
      );
    } catch (err) {
      console.error(err);

      alert(
        err.message ||
          'Failed to analyze PGN'
      );
    } finally {
      setLoading(false);
    }
  }



  async function handleOfflineGameAnalysis() {
    const offlinePgn =
      analysisBoard.pgn();

    if (!offlinePgn.trim()) {
      alert(
        'Play at least one move on the offline board first.'
      );

      return;
    }

    setPgn(offlinePgn);
    setLoading(true);

    try {
      await analyzePgnText(
        offlinePgn
      );
    } catch (err) {
      console.error(err);

      alert(
        err.message ||
          'Failed to analyze offline game'
      );
    } finally {
      setLoading(false);
    }
  }

  function exportOfflinePgn() {
    const offlinePgn =
      analysisBoard.pgn();

    if (!offlinePgn.trim()) {
      alert(
        'Play at least one move before exporting PGN.'
      );

      return;
    }

    downloadTextFile(
      'offline-game.pgn',
      offlinePgn
    );
  }

  // =========================
  // UPLOAD SCREEN
  // =========================

  if (
    gameState === 'upload'
  ) {
    return (
      <div
        style={{
          padding: 30,
          backgroundColor:
            '#111',
          color: 'white',
          minHeight:
            '100vh',
          maxWidth: 1200,
          margin:
            '0 auto',
        }}
      >
        <button
          onClick={onBack}
          style={{
            marginBottom: 20,
            padding:
              '10px 16px',
            borderRadius: 8,
            border: 'none',
            cursor: 'pointer',
            backgroundColor:
              '#333',
            color: 'white',
          }}
        >
          ← Back
        </button>

        <h1
          style={{
            fontSize: 42,
            marginBottom: 10,
          }}
        >
          📊 Professional
          Chess Analysis
        </h1>

        <p
          style={{
            color: '#aaa',
            marginBottom: 25,
          }}
        >
          Paste PGN or
          analyze positions
          offline
        </p>

        {/* PGN INPUT */}

        <textarea
          value={pgn}
          onChange={(e) =>
            setPgn(
              e.target.value
            )
          }
          placeholder={`[Event "Game"]

1. e4 e5
2. Nf3 Nc6
3. Bb5 a6`}
          style={{
            width: '100%',
            height: 280,
            backgroundColor:
              '#222',
            color: 'white',
            border:
              '1px solid #444',
            borderRadius: 10,
            padding: 15,
            fontSize: 14,
            fontFamily:
              'monospace',
            resize: 'vertical',
          }}
        />

        {/* BUTTONS */}

        <div
          style={{
            display: 'flex',
            gap: 15,
            marginTop: 20,
            flexWrap: 'wrap',
          }}
        >
          <button
            onClick={
              handlePgnUpload
            }
            disabled={
              loading
            }
            style={{
              padding:
                '12px 20px',
              borderRadius: 8,
              border: 'none',
              cursor:
                'pointer',
              backgroundColor:
                '#00cc66',
              color: 'black',
              fontWeight:
                'bold',
              fontSize: 15,
            }}
          >
            {loading
              ? 'Analyzing...'
              : 'Analyze Game'}
          </button>

          <button
            onClick={() =>
              fileInputRef.current?.click()
            }
            style={{
              padding:
                '12px 20px',
              borderRadius: 8,
              border: 'none',
              cursor:
                'pointer',
              backgroundColor:
                '#007bff',
              color: 'white',
              fontWeight:
                'bold',
              fontSize: 15,
            }}
          >
            Upload PGN
          </button>

          <button
            onClick={
              analyzeCurrentPosition
            }
            style={{
              padding:
                '12px 20px',
              borderRadius: 8,
              border: 'none',
              cursor:
                'pointer',
              backgroundColor:
                '#ff9800',
              color: 'black',
              fontWeight:
                'bold',
              fontSize: 15,
            }}
          >
            Analyze Current
            Board
          </button>

          <button
            onClick={
              handleOfflineGameAnalysis
            }
            disabled={
              loading
            }
            style={{
              padding:
                '12px 20px',
              borderRadius: 8,
              border: 'none',
              cursor:
                'pointer',
              backgroundColor:
                '#9c27b0',
              color: 'white',
              fontWeight:
                'bold',
              fontSize: 15,
            }}
          >
            Analyze Offline
            Game
          </button>

          <button
            onClick={
              exportOfflinePgn
            }
            style={{
              padding:
                '12px 20px',
              borderRadius: 8,
              border: 'none',
              cursor:
                'pointer',
              backgroundColor:
                '#607d8b',
              color: 'white',
              fontWeight:
                'bold',
              fontSize: 15,
            }}
          >
            Export Offline
            PGN
          </button>

          <button
            onClick={() => {
              resetOfflineBoard();
            }}
            style={{
              padding:
                '12px 20px',
              borderRadius: 8,
              border: 'none',
              cursor:
                'pointer',
              backgroundColor:
                '#555',
              color: 'white',
              fontWeight:
                'bold',
              fontSize: 15,
            }}
          >
            Reset Offline Game
          </button>

          <input
            ref={
              fileInputRef
            }
            type='file'
            accept='.pgn,.txt'
            style={{
              display:
                'none',
            }}
            onChange={(e) => {
              const file =
                e.target
                  .files[0];

              if (!file)
                return;

              const reader =
                new FileReader();

              reader.onload =
                (event) => {
                  setPgn(
                    event
                      .target
                      .result
                  );
                };

              reader.readAsText(
                file
              );
            }}
          />
        </div>

        {/* OFFLINE BOARD */}

        <div
          style={{
            marginTop: 40,
            maxWidth: 550,
          }}
        >
          <Chessboard
            position={
              analysisBoard.fen()
            }
            onPieceDrop={(
              sourceSquare,
              targetSquare
            ) => {
              const move =
                analysisBoard.move({
                  from:
                    sourceSquare,
                  to:
                    targetSquare,
                  promotion:
                    'q',
                });

              if (
                move ===
                null
              ) {
                return false;
              }

              setAnalysisBoard(
                new Chess(
                  analysisBoard.fen()
                )
              );

              return true;
            }}
          />
        </div>
      </div>
    );
  }

  // =========================
  // SAFETY
  // =========================

  if (
    !uploadedGame ||
    !analysis
  ) {
    return null;
  }

  const move =
    uploadedGame
      .moveHistory[
      currentMoveIndex
    ];

  const coach =
    COACH_PERSONAS[
      selectedCoach
    ];

  // =========================
  // ANALYSIS SCREEN
  // =========================

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns:
          '2fr 1fr',
        gap: 20,
        padding: 20,
        backgroundColor:
          '#111',
        color: 'white',
        minHeight:
          '100vh',
      }}
    >
      {/* LEFT PANEL */}

      <div>
        <button
          onClick={() => {
            setGameState(
              'upload'
            );

            setUploadedGame(
              null
            );

            setAnalysis(
              null
            );

            setCurrentMoveIndex(
              0
            );
          }}
          style={{
            marginBottom: 20,
            padding:
              '10px 16px',
            borderRadius: 8,
            border: 'none',
            cursor:
              'pointer',
            backgroundColor:
              '#333',
            color: 'white',
          }}
        >
          ← Back
        </button>

        {/* BOARD */}

        <div
          style={{
            maxWidth: 700,
            marginBottom: 20,
          }}
        >
          <Chessboard
            position={
              uploadedGame
                .fenHistory[
                currentMoveIndex
              ]
            }
          />
        </div>

        {/* GAME INFO */}

        <div
          style={{
            backgroundColor:
              '#1c1c1c',
            padding: 20,
            borderRadius: 12,
            marginBottom: 20,
          }}
        >
          <h2>
            Game Overview
          </h2>

          <div
            style={{
              display:
                'grid',
              gridTemplateColumns:
                '1fr 1fr',
              gap: 10,
              marginTop: 15,
            }}
          >
            <div>
              Accuracy:{' '}
              <strong>
                {
                  analysis.accuracy
                }
                %
              </strong>
            </div>

            <div>
              ACPL:{' '}
              <strong>
                {
                  analysis.acpl
                }
              </strong>
            </div>

            <div>
              Blunders:{' '}
              <strong>
                {
                  analysis
                    .blunders
                    .length
                }
              </strong>
            </div>

            <div>
              Brilliant:{' '}
              <strong>
                {
                  analysis
                    .brilliantMoves
                    .length
                }
              </strong>
            </div>
          </div>
        </div>

        {/* CURRENT MOVE */}

        <div
          style={{
            backgroundColor:
              '#1c1c1c',
            padding: 20,
            borderRadius: 12,
            marginBottom: 20,
          }}
        >
          <h2>
            Move{' '}
            {currentMoveIndex +
              1}
          </h2>

          <div
            style={{
              fontSize: 42,
              fontWeight:
                'bold',
              marginTop: 10,
            }}
          >
            {move.san}
          </div>

          <div
            style={{
              color:
                CLASSIFICATION_COLOR[
                  move
                    .classification
                ],
              fontWeight:
                'bold',
              fontSize: 24,
              marginTop: 15,
            }}
          >
            {
              CLASSIFICATION_EMOJI[
                move
                  .classification
              ]
            }{' '}
            {
              move.classification
            }
          </div>

          <div
            style={{
              marginTop: 20,
              lineHeight: 2,
            }}
          >
            <div>
              <strong>
                Eval:
              </strong>{' '}
              {
                move.playedEval
              }
            </div>

            <div>
              <strong>
                Best Move:
              </strong>{' '}
              {
                move.bestMove
              }
            </div>

            <div>
              <strong>
                PV:
              </strong>{' '}
              {move.pv}
            </div>

            <div>
              <strong>
                Why:
              </strong>{' '}
              {move.explanation}
            </div>

            {move.mate !==
              null && (
              <div>
                <strong>
                  Mate:
                </strong>{' '}
                {
                  move.mate
                }
              </div>
            )}
          </div>
        </div>

        {/* NOTES */}

        <div
          style={{
            backgroundColor:
              '#1c1c1c',
            padding: 20,
            borderRadius: 12,
            marginBottom: 20,
          }}
        >
          <h3>
            📝 Notes
          </h3>

          <textarea
            value={
              gameNotes[
                currentMoveIndex
              ] || ''
            }
            onChange={(e) =>
              setGameNotes({
                ...gameNotes,
                [
                  currentMoveIndex
                ]:
                  e.target
                    .value,
              })
            }
            placeholder='Write your thoughts...'
            style={{
              width: '100%',
              height: 120,
              marginTop: 10,
              backgroundColor:
                '#222',
              color: 'white',
              border:
                '1px solid #444',
              borderRadius: 10,
              padding: 12,
              resize: 'vertical',
            }}
          />
        </div>

        {/* NAVIGATION */}

        <div
          style={{
            display: 'flex',
            gap: 10,
          }}
        >
          <button
            disabled={
              currentMoveIndex ===
              0
            }
            onClick={() =>
              setCurrentMoveIndex(
                currentMoveIndex -
                  1
              )
            }
            style={{
              padding:
                '12px 18px',
              borderRadius: 8,
              border: 'none',
              backgroundColor:
                '#007bff',
              color: 'white',
              cursor:
                'pointer',
            }}
          >
            ⬅ Prev
          </button>

          <button
            disabled={
              currentMoveIndex ===
              uploadedGame
                .moveHistory
                .length -
                1
            }
            onClick={() =>
              setCurrentMoveIndex(
                currentMoveIndex +
                  1
              )
            }
            style={{
              padding:
                '12px 18px',
              borderRadius: 8,
              border: 'none',
              backgroundColor:
                '#007bff',
              color: 'white',
              cursor:
                'pointer',
            }}
          >
            Next ➜
          </button>
        </div>
      </div>

      {/* RIGHT PANEL */}

      <div>
        <div
          style={{
            backgroundColor:
              '#1c1c1c',
            padding: 20,
            borderRadius: 12,
            marginBottom: 20,
          }}
        >
          <h2>
            Export Analysis
          </h2>

          <button
            onClick={() =>
              downloadTextFile(
                'chess-analysis.txt',
                buildAnalysisText(
                  uploadedGame,
                  analysis,
                  gameNotes
                )
              )
            }
            style={{
              padding:
                '12px',
              borderRadius: 8,
              border: 'none',
              cursor:
                'pointer',
              backgroundColor:
                '#00cc66',
              color: 'black',
              fontWeight:
                'bold',
              width: '100%',
              marginBottom: 10,
            }}
          >
            Export Text Report
          </button>

          <button
            onClick={() =>
              downloadTextFile(
                'analyzed-game.pgn',
                uploadedGame.sourcePgn ||
                  pgn
              )
            }
            style={{
              padding:
                '12px',
              borderRadius: 8,
              border: 'none',
              cursor:
                'pointer',
              backgroundColor:
                '#607d8b',
              color: 'white',
              fontWeight:
                'bold',
              width: '100%',
            }}
          >
            Export PGN
          </button>
        </div>

        {/* COACH */}

        <div
          style={{
            backgroundColor:
              '#1c1c1c',
            padding: 20,
            borderRadius: 12,
            marginBottom: 20,
          }}
        >
          <h2>
            Coach Mode
          </h2>

          <div
            style={{
              display:
                'flex',
              flexDirection:
                'column',
              gap: 10,
              marginTop: 15,
            }}
          >
            {Object.entries(
              COACH_PERSONAS
            ).map(
              ([
                key,
                value,
              ]) => (
                <button
                  key={key}
                  onClick={() =>
                    setSelectedCoach(
                      key
                    )
                  }
                  style={{
                    padding:
                      '12px',
                    borderRadius: 8,
                    border:
                      'none',
                    cursor:
                      'pointer',
                    backgroundColor:
                      selectedCoach ===
                      key
                        ? '#00bfff'
                        : '#333',
                    color:
                      selectedCoach ===
                      key
                        ? 'black'
                        : 'white',
                    fontWeight:
                      'bold',
                  }}
                >
                  {
                    value.emoji
                  }{' '}
                  {
                    value.name
                  }
                </button>
              )
            )}
          </div>

          <div
            style={{
              marginTop: 20,
              lineHeight: 1.7,
              color: '#ddd',
            }}
          >
            {coach.getComment(
              analysis
            )}
          </div>
        </div>

        {/* BRILLIANT MOVES */}

        <div
          style={{
            backgroundColor:
              '#1c1c1c',
            padding: 20,
            borderRadius: 12,
            marginBottom: 20,
          }}
        >
          <h2>
            💎 Brilliant
            Moves
          </h2>

          {analysis
            .brilliantMoves
            .length === 0 && (
            <div
              style={{
                color:
                  '#888',
                marginTop: 10,
              }}
            >
              No brilliant
              moves found
            </div>
          )}

          {analysis.brilliantMoves.map(
            (
              move,
              index
            ) => (
              <div
                key={index}
                style={{
                  marginTop: 10,
                }}
              >
                💎 Move{' '}
                {
                  move.turn
                }
                :{' '}
                {
                  move.move
                }
              </div>
            )
          )}
        </div>

        {/* BLUNDERS */}

        <div
          style={{
            backgroundColor:
              '#1c1c1c',
            padding: 20,
            borderRadius: 12,
          }}
        >
          <h2>
            💥 Blunders
          </h2>

          {analysis
            .blunders
            .length === 0 && (
            <div
              style={{
                color:
                  '#888',
                marginTop: 10,
              }}
            >
              No blunders
            </div>
          )}

          {analysis.blunders.map(
            (
              move,
              index
            ) => (
              <div
                key={index}
                style={{
                  marginTop: 10,
                  cursor:
                    'pointer',
                }}
                onClick={() =>
                  setCurrentMoveIndex(
                    move.turn -
                      1
                  )
                }
              >
                💥 Move{' '}
                {
                  move.turn
                }
                :{' '}
                {
                  move.move
                }
              </div>
            )
          )}
        </div>
      </div>
    </div>
  );
              }
