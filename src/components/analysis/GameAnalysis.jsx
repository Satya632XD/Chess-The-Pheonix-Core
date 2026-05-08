import React, { useState, useEffect } from 'react';
import { Chess } from 'chess.js';
import {
  analyzeGame,
  classifyMove,
  getExplanation,
  COACH_PERSONAS,
  CLASSIFICATION_COLOR,
  CLASSIFICATION_EMOJI,
  findTurningPoint,
  generateCareerStats,
} from '../../lib/gameAnalysis';

export default function GameAnalysis({ pgn, moveHistory, gameResult }) {
  const [currentMoveIndex, setCurrentMoveIndex] = useState(0);
  const [selectedCoach, setSelectedCoach] = useState('FRIENDLY');
  const [analysis, setAnalysis] = useState(null);
  const [showCoach, setShowCoach] = useState(true);
  const [gameNotes, setGameNotes] = useState({});

  useEffect(() => {
    if (moveHistory && moveHistory.length > 0) {
      // Mock analysis - In real app, fetch from Stockfish
      const mockAnalysis = analyzeGame(
        moveHistory.map((m, i) => ({
          ...m,
          bestEval: m.eval - (Math.random() * 20 - 10),
          playedEval: m.eval,
        }))
      );
      setAnalysis(mockAnalysis);
    }
  }, [moveHistory]);

  if (!analysis) {
    return <div style={{ padding: 20 }}>Loading analysis...</div>;
  }

  const currentMove = moveHistory[currentMoveIndex];
  const classification = currentMove ? classifyMove(
    currentMove.eval - (Math.random() * 20 - 10),
    currentMove.eval
  ) : null;

  const coach = COACH_PERSONAS[selectedCoach];
  const coachComment = coach.getComment(analysis);
  const moveExplanation = classification ? getExplanation(
    classification,
    Math.random() * 50,
    ''
  ) : '';

  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: '2fr 1fr',
      gap: 20,
      padding: 20,
      maxWidth: 1200,
      margin: '0 auto',
    }}>
      {/* LEFT: Main Analysis */}
      <div>
        {/* Header */}
        <div style={{
          marginBottom: 20,
          padding: 15,
          backgroundColor: '#f5f5f5',
          borderRadius: 8,
        }}>
          <h2>Game Analysis</h2>
          <div style={{ display: 'flex', gap: 15, marginTop: 10 }}>
            <div>
              <strong>Accuracy:</strong> {analysis.accuracy}%
            </div>
            <div>
              <strong>Best Moves:</strong> {analysis.classifications['Best']}
            </div>
            <div>
              <strong>Blunders:</strong> {analysis.blunders.length}
            </div>
            <div>
              <strong>Brilliant:</strong> {analysis.brilliant_moves.length}
            </div>
          </div>
        </div>

        {/* Move Classifications Bar */}
        <div style={{ marginBottom: 20 }}>
          <h3>Move Distribution</h3>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(7, 1fr)',
            gap: 10,
          }}>
            {['Best', 'Good', 'Decent', 'Inaccuracy', 'Mistake', 'Blunder', 'Brilliant'].map(cls => {
              const count = analysis.classifications[cls];
              const percent = (count / analysis.total_moves * 100).toFixed(0);
              return (
                <div key={cls} style={{
                  padding: 10,
                  backgroundColor: CLASSIFICATION_COLOR[cls],
                  borderRadius: 6,
                  textAlign: 'center',
                  color: ['Best', 'Good', 'Brilliant'].includes(cls) ? 'white' : 'black',
                  fontWeight: 'bold',
                }}>
                  <div>{CLASSIFICATION_EMOJI[cls]}</div>
                  <div style={{ fontSize: 12, marginTop: 5 }}>{cls}</div>
                  <div style={{ fontSize: 14, marginTop: 3 }}>{count}</div>
                  <div style={{ fontSize: 10, marginTop: 2 }}>{percent}%</div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Move Navigator */}
        <div style={{
          marginBottom: 20,
          padding: 15,
          border: '1px solid #ddd',
          borderRadius: 8,
        }}>
          <h3>Move Review</h3>
          <div style={{ marginBottom: 15 }}>
            <p><strong>Move {currentMoveIndex + 1} of {moveHistory.length}</strong></p>
            {currentMove && (
              <p>
                <strong>{currentMove.san}</strong> - {CLASSIFICATION_EMOJI[classification]} <span style={{
                  color: CLASSIFICATION_COLOR[classification],
                  fontWeight: 'bold',
                }}>
                  {classification}
                </span>
              </p>
            )}
          </div>

          {moveExplanation && (
            <div style={{
              padding: 10,
              backgroundColor: '#f0f0f0',
              borderRadius: 6,
              marginBottom: 15,
              fontStyle: 'italic',
            }}>
              {moveExplanation}
            </div>
          )}

          {/* Note Textbox */}
          <div style={{ marginBottom: 15 }}>
            <label style={{ display: 'block', marginBottom: 5 }}>Your Notes:</label>
            <textarea
              value={gameNotes[currentMoveIndex] || ''}
              onChange={(e) => setGameNotes({
                ...gameNotes,
                [currentMoveIndex]: e.target.value,
              })}
              placeholder="Add your thoughts about this move..."
              style={{
                width: '100%',
                height: 80,
                padding: 10,
                borderRadius: 6,
                border: '1px solid #ddd',
                fontFamily: 'Arial',
              }}
            />
          </div>

          {/* Navigation Buttons */}
          <div style={{ display: 'flex', gap: 10 }}>
            <button
              onClick={() => setCurrentMoveIndex(Math.max(0, currentMoveIndex - 1))}
              disabled={currentMoveIndex === 0}
              style={{
                padding: '8px 15px',
                backgroundColor: '#007bff',
                color: 'white',
                border: 'none',
                borderRadius: 6,
                cursor: 'pointer',
                opacity: currentMoveIndex === 0 ? 0.5 : 1,
              }}
            >
              ⬅ Previous
            </button>
            <button
              onClick={() => setCurrentMoveIndex(Math.min(moveHistory.length - 1, currentMoveIndex + 1))}
              disabled={currentMoveIndex === moveHistory.length - 1}
              style={{
                padding: '8px 15px',
                backgroundColor: '#007bff',
                color: 'white',
                border: 'none',
                borderRadius: 6,
                cursor: 'pointer',
                opacity: currentMoveIndex === moveHistory.length - 1 ? 0.5 : 1,
              }}
            >
              Next ➜
            </button>
            <button
              onClick={() => setCurrentMoveIndex(findTurningPoint(moveHistory).turning_point - 1)}
              style={{
                padding: '8px 15px',
                backgroundColor: '#ff6600',
                color: 'white',
                border: 'none',
                borderRadius: 6,
                cursor: 'pointer',
              }}
              title="Jump to biggest evaluation swing"
            >
              ⚡ Turning Point
            </button>
          </div>
        </div>

        {/* Blunders List */}
        {analysis.blunders.length > 0 && (
          <div style={{
            padding: 15,
            border: '1px solid #ff6600',
            borderRadius: 8,
            backgroundColor: '#fff5f0',
          }}>
            <h3>💥 Your Blunders ({analysis.blunders.length})</h3>
            <div>
              {analysis.blunders.map((blunder, i) => (
                <div
                  key={i}
                  onClick={() => setCurrentMoveIndex(blunder.turn - 1)}
                  style={{
                    padding: 10,
                    marginBottom: 8,
                    backgroundColor: 'white',
                    borderRadius: 6,
                    cursor: 'pointer',
                    border: '1px solid #ddd',
                    transition: 'all 0.2s',
                  }}
                  onMouseEnter={(e) => e.target.style.backgroundColor = '#ffe6d5'}
                  onMouseLeave={(e) => e.target.style.backgroundColor = 'white'}
                >
                  <strong>Move {blunder.turn}:</strong> {blunder.move} (-{Math.round(blunder.eval_loss)} cp)
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* RIGHT: Coach Panel */}
      <div>
        {/* Coach Selection */}
        <div style={{
          marginBottom: 20,
          padding: 15,
          backgroundColor: '#f9f9f9',
          borderRadius: 8,
          border: '1px solid #ddd',
        }}>
          <h3>Coach Mode</h3>
          <label style={{ display: 'flex', alignItems: 'center', marginBottom: 10 }}>
            <input
              type="checkbox"
              checked={showCoach}
              onChange={(e) => setShowCoach(e.target.checked)}
              style={{ marginRight: 10 }}
            />
            Show Coach Commentary
          </label>

          {showCoach && (
            <div style={{ marginTop: 10 }}>
              <p style={{ fontSize: 12, marginBottom: 10, color: '#666' }}>Select coach personality:</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {Object.entries(COACH_PERSONAS).map(([key, coach]) => (
                  <button
                    key={key}
                    onClick={() => setSelectedCoach(key)}
                    style={{
                      padding: '10px 12px',
                      backgroundColor: selectedCoach === key ? '#007bff' : '#e9ecef',
                      color: selectedCoach === key ? 'white' : 'black',
                      border: 'none',
                      borderRadius: 6,
                      cursor: 'pointer',
                      textAlign: 'left',
                      fontWeight: selectedCoach === key ? 'bold' : 'normal',
                      transition: 'all 0.2s',
                    }}
                  >
                    {coach.emoji} {coach.name}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Coach Comment */}
        {showCoach && (
          <div style={{
            padding: 15,
            backgroundColor: '#e3f2fd',
            border: '2px solid #2196F3',
            borderRadius: 8,
            marginBottom: 20,
          }}>
            <h3>💬 {coach.emoji} Coach Says:</h3>
            <p style={{
              fontSize: 14,
              lineHeight: 1.6,
              marginTop: 10,
              fontStyle: 'italic',
            }}>
              "{coachComment}"
            </p>
          </div>
        )}

        {/* Accuracy Meter */}
        <div style={{
          padding: 15,
          backgroundColor: '#f5f5f5',
          borderRadius: 8,
          marginBottom: 20,
        }}>
          <h3>Accuracy Rating</h3>
          <div style={{
            height: 30,
            backgroundColor: '#ddd',
            borderRadius: 15,
            overflow: 'hidden',
            marginTop: 10,
          }}>
            <div style={{
              height: '100%',
              width: `${analysis.accuracy}%`,
              backgroundColor: analysis.accuracy > 80 ? '#00cc00' :
                                analysis.accuracy > 60 ? '#ffff00' :
                                analysis.accuracy > 40 ? '#ff9900' : '#ff0000',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'white',
              fontWeight: 'bold',
              fontSize: 14,
              transition: 'width 0.3s',
            }}>
              {analysis.accuracy}%
            </div>
          </div>
          <p style={{
            fontSize: 12,
            marginTop: 10,
            color: '#666',
            textAlign: 'center',
          }}>
            {analysis.accuracy > 80 ? '⭐ Excellent play!' :
             analysis.accuracy > 60 ? '👍 Good performance' :
             analysis.accuracy > 40 ? '➖ Room for improvement' :
             '❌ Lots to work on'}
          </p>
        </div>

        {/* Export Button */}
        <button
          onClick={() => {
            const data = JSON.stringify({
              pgn,
              analysis,
              gameNotes,
              exportDate: new Date().toISOString(),
            }, null, 2);
            const blob = new Blob([data], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `game-analysis-${Date.now()}.json`;
            a.click();
          }}
          style={{
            width: '100%',
            padding: 12,
            backgroundColor: '#28a745',
            color: 'white',
            border: 'none',
            borderRadius: 6,
            cursor: 'pointer',
            fontWeight: 'bold',
            fontSize: 14,
          }}
        >
          📥 Export Analysis
        </button>
      </div>
    </div>
  );
}
