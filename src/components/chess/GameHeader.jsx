import React from 'react';

export default function GameHeader({ mode, onBack, botName, gameStatus }) {
  return (
    <div className="flex items-center px-4 py-3 border-b border-border">
      <button onClick={onBack} className="text-sm text-muted-foreground hover:text-foreground transition-colors">
        ← Menu
      </button>
      <h2 className="flex-1 text-center font-bold text-foreground">
        {mode === 'phoenix' ? '🔥 Phoenix Core' : `♟ vs ${botName}`}
      </h2>
      {gameStatus && (
        <span className="text-xs font-bold text-red-400">{gameStatus}</span>
      )}
      {!gameStatus && <div className="w-12" />}
    </div>
  );
      }
