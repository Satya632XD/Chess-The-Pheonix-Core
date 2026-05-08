import React, { useState, useRef } from 'react';
import { Chess } from 'chess.js';
import ChessBoard from '../components/chess/ChessBoard';
import GameAnalysis from '../components/analysis/GameAnalysis';

export default function AnalysisMode({ onBack }) {
  const [gameState, setGameState] = useState('upload'); // upload, analyzing, review
  const [pgn, setPgn] = useState('');
  const [uploadedGame, setUploadedGame] = useState(null);
  const [selectedSquare, setSelectedSquare] = useState(null);
  const [currentMoveIndex, setCurrentMoveIndex] = useState(-1);
  const fileInputRef = useRef(null);

  const handlePgnUpload = () => {
    if (!pgn.trim()) {
      alert('Please paste a PGN');
      return;
    }

    try {
      const game = new Chess();
      const lines = pgn.split('\n');
      const movesLine = lines.find(l => !l.startsWith('['));
      
      if (movesLine) {
        const moves = movesLine.trim().split(/\s+/);
        const moveHistory = [];
        
        for (const move of moves) {
          if (move === '*' || move.includes('/')) continue;
          const result = game.move(move, { sloppy: true });
          if (result) {
            moveHistory.push(result);
          }
        }

        setUploadedGame({
          pgn,
          moveHistory,
          fen: game.fen(),
          result: moves[moves.length - 1] || '*'
        });
        setGameState('analyzing');
        setCurrentMoveIndex(0);
      }
    } catch (e) {
      alert('Invalid PGN format: ' + e.message);
    }
  };

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        setPgn(event.target.result);
      };
      reader.readAsText(file);
    }
  };

  if (gameState === 'upload') {
    return (
      <div style={{
        padding: 30,
        maxWidth: 800,
        margin: '0 auto',
        backgroundColor: '#1a1a1a',
        color: 'white',
        minHeight: '100vh',
      }}>
        <h1 style={{ marginBottom: 20 }}>📊 Game Analysis Mode</h1>
        
        <div style={{
          backgroundColor: '#222',
          padding: 20,
          borderRadius: 10,
          marginBottom: 20,
          border: '2px solid #00cc00',
        }}>
          <h2>Upload a Game (PGN Format)</h2>
          
          <div style={{ marginBottom: 20 }}>
            <h3>Option 1: Paste PGN</h3>
            <textarea
              value={pgn}
              onChange={(e) => setPgn(e.target.value)}
              placeholder={`[Event "Game"]
[Site "?"]
[Date "2024.01.01"]
[White "Player1"]
[Black "Player2"]

1. e4 c5 2. Nf3 d6 3. d4 cxd4 4. Nxd4 Nf6 5. Nc3...`}
              style={{
                width: '100%',
                height: 200,
                padding: 10,
                backgroundColor: '#333',
                color: 'white',
                border: '1px solid #444',
                borderRadius: 6,
                fontFamily: 'monospace',
                marginBottom: 10,
              }}
            />
            <button
              onClick={handlePgnUpload}
              style={{
                padding: '10px 20px',
                backgroundColor: '#00cc00',
                color: '#000',
                border: 'none',
                borderRadius: 6,
                cursor: 'pointer',
                fontWeight: 'bold',
                width: '100%',
              }}
            >
              ✅ Upload & Analyze
            </button>
          </div>

          <div style={{
            display: 'flex',
            alignItems: 'center',
            marginBottom: 20,
            color: '#888',
          }}>
            <div style={{ flex: 1, height: '1px', backgroundColor: '#444' }} />
            <span style={{ margin: '0 10px' }}>OR</span>
            <div style={{ flex: 1, height: '1px', backgroundColor: '#444' }} />
          </div>

          <div>
            <h3>Option 2: Upload PGN File</h3>
            <input
              ref={fileInputRef}
              type="file"
              accept=".pgn,.txt"
              onChange={handleFileUpload}
              style={{ display: 'none' }}
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              style={{
                padding: '10px 20px',
                backgroundColor: '#ff9900',
                color: '#000',
                border: 'none',
                borderRadius: 6,
                cursor: 'pointer',
                fontWeight: 'bold',
                width: '100%',
              }}
            >
              📁 Choose File
            </button>
          </div>
        </div>

        <div style={{
          backgroundColor: '#222',
          padding: 15,
          borderRadius: 8,
          marginBottom: 20,
          borderLeft: '4px solid #00ccff',
        }}>
          <h3>💡 Supported Formats:</h3>
          <ul style={{ marginLeft: 20, color: '#aaa' }}>
            <li>Standard PGN format</li>
            <li>Games from Chess.com</li>
            <li>Games from Lichess</li>
            <li>Games from other chess platforms</li>
          </ul>
        </div>

        <button
          onClick={onBack}
          style={{
            padding: '10px 20px',
            backgroundColor: '#666',
            color: 'white',
            border: 'none',
            borderRadius: 6,
            cursor: 'pointer',
            width: '100%',
          }}
        >
          ← Back to Menu
        </button>
      </div>
    );
  }

  if (!uploadedGame) {
    return <div style={{ padding: 20, color: 'white' }}>Loading...</div>;
  }

  return (
    <GameAnalysis
      pgn={uploadedGame.pgn}
      moveHistory={uploadedGame.moveHistory}
      gameResult={uploadedGame.result}
      onBack={() => {
        setGameState('upload');
        setPgn('');
        setUploadedGame(null);
      }}
    />
  );
}
