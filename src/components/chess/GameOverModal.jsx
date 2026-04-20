import React from 'react';

export default function GameOverModal({ result, reason, onRematch, onMenu }) {
  if (!result) return null;

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="bg-card border border-border rounded-2xl p-6 w-full max-w-sm text-center animate-in zoom-in">
        <div className="text-4xl mb-3">
          {result === 'Draw' ? '🤝' : '🏆'}
        </div>
        <h2 className="text-2xl font-black text-foreground mb-1">{result}</h2>
        <p className="text-muted-foreground text-sm mb-6">{reason}</p>
        <div className="flex gap-3">
          <button
            onClick={onMenu}
            className="flex-1 py-3 rounded-xl border border-border text-foreground font-semibold hover:bg-secondary transition-colors"
          >
            Menu
          </button>
          <button
            onClick={onRematch}
            className="flex-1 py-3 rounded-xl bg-primary text-primary-foreground font-bold hover:bg-primary/90 transition-colors"
          >
            Rematch
          </button>
        </div>
      </div>
    </div>
  );
}
