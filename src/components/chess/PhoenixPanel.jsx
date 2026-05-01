import React from 'react';

const DICE_PIECE_MAP = {
  1: { piece: 'Pawn',   icon: '♟', move: 'moves forward 1-2 squares' },
  2: { piece: 'Knight', icon: '♞', move: 'moves in L-shape' },
  3: { piece: 'Bishop', icon: '♝', move: 'moves diagonally' },
  4: { piece: 'Rook',   icon: '♜', move: 'moves in straight lines' },
  5: { piece: 'Queen',  icon: '♛', move: 'moves any direction' },
  6: { piece: 'King',   icon: '♚', move: 'moves 1 square any direction' },
};

export default function PhoenixPanel({
  currentTurn, phoenixState, diceValue,
  hasRolledThisTurn, mustMovePhoenix, phoenixSelected,
  onSelectPhoenix, onRollDice, turnCount,
}) {
  const active = phoenixState.active[currentTurn];
  const used = phoenixState.used[currentTurn];
  const pos = phoenixState.positions[currentTurn];
  const turnsSince = phoenixState.turnsSinceMoved[currentTurn] || 0;
  const turnsUntilForced = 3 - turnsSince;

  // Dice can only be rolled on turn 3 (forced) — not optional every turn
  const canRoll = active && !hasRolledThisTurn && !diceValue && mustMovePhoenix;

  return (
    <div className="bg-card rounded-xl border border-border p-3 space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-xs font-bold text-foreground">🔥 Phoenix Core</span>
        <span className="text-xs text-muted-foreground">
          {currentTurn === 'w' ? '🔵 White' : '🔴 Black'}
        </span>
      </div>

      {!active && (
        <div className="text-xs text-muted-foreground text-center py-2 bg-secondary/50 rounded-lg">
          {used ? '✓ Phoenix used — king was revived' : 'Phoenix no longer active'}
        </div>
      )}

      {active && (
        <>
          <div className="text-xs bg-secondary/30 rounded-lg px-2 py-1.5">
            <span className="text-muted-foreground">Position: </span>
            <span className="text-foreground font-mono font-bold">{pos?.toUpperCase() || '?'}</span>
            {mustMovePhoenix
              ? <span className="text-red-400 ml-2 font-bold">⚠ MUST MOVE NOW</span>
              : <span className="text-muted-foreground ml-2">
                  (move in {turnsUntilForced} turn{turnsUntilForced !== 1 ? 's' : ''})
                </span>
            }
          </div>

          {!diceValue && (
            <button
              onClick={onRollDice}
              disabled={!canRoll}
              className={`w-full py-2.5 text-xs rounded-lg font-bold transition-all ${
                canRoll
                  ? 'bg-red-500 text-white animate-pulse cursor-pointer shadow-lg shadow-red-500/30'
                  : 'bg-secondary text-muted-foreground opacity-50 cursor-not-allowed'
              }`}
            >
              {mustMovePhoenix
                ? '🎲 Roll Dice — Move Phoenix Now!'
                : `🎲 Roll available in ${turnsUntilForced} turn${turnsUntilForced !== 1 ? 's' : ''}`
              }
            </button>
          )}

          {diceValue && (
            <div className="space-y-2">
              <div className="text-xs text-center bg-primary/10 border border-primary/20 rounded-lg py-2">
                <span className="font-bold text-primary text-base">{diceValue}</span>
                <span className="text-muted-foreground ml-2">→</span>
                <span className="ml-1">{DICE_PIECE_MAP[diceValue]?.icon}</span>
                <span className="font-semibold text-foreground ml-1">{DICE_PIECE_MAP[diceValue]?.piece}</span>
                <div className="text-muted-foreground text-xs mt-0.5">{DICE_PIECE_MAP[diceValue]?.move}</div>
              </div>
              <button
                onClick={onSelectPhoenix}
                className={`w-full py-2 text-xs rounded-lg font-bold transition-all ${
                  phoenixSelected
                    ? 'bg-orange-500 text-white shadow-lg shadow-orange-500/30'
                    : 'bg-secondary text-foreground hover:bg-secondary/80'
                }`}
              >
                {phoenixSelected
                  ? '🔥 Tap a highlighted square to move Phoenix'
                  : '🔥 Tap to select Phoenix destination'}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
    }
