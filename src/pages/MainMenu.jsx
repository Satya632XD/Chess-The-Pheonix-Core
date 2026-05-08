import React, { useState } from 'react';

export const TIMER_MODES = [
  { id: 1,  label: '⚡ 1 min',  seconds: 60,   increment: 0 },
  { id: 2,  label: '⚡ 2 min',  seconds: 120,  increment: 0 },
  { id: 3,  label: '⚡ 2+3',    seconds: 120,  increment: 3 },
  { id: 4,  label: '🔥 3 min',  seconds: 180,  increment: 0 },
  { id: 5,  label: '🔥 3+2',    seconds: 180,  increment: 2 },
  { id: 6,  label: '🔥 5 min',  seconds: 300,  increment: 0 },
  { id: 7,  label: '🔥 5+5',    seconds: 300,  increment: 5 },
  { id: 8,  label: '⏱ 10 min', seconds: 600,  increment: 0 },
  { id: 9,  label: '⏱ 10+5',   seconds: 600,  increment: 5 },
  { id: 10, label: '⏱ 15+5',   seconds: 900,  increment: 5 },
  { id: 11, label: '▲ 30 min', seconds: 1800, increment: 0 },
];

export default function MainMenu({ onPlayNormal, onPlayPhoenix, onPlayOnline, onProfile, onLeaderboard, onAnalysis }) {
  const [showTimerSelect, setShowTimerSelect] = useState(null);
  const [selectedTimer, setSelectedTimer] = useState(TIMER_MODES[0]);

  const handleModeSelect = (mode) => setShowTimerSelect(mode);

  const handleStartGame = () => {
    switch (showTimerSelect) {
      case 'normal': onPlayNormal(selectedTimer); break;
      case 'online': onPlayOnline(selectedTimer); break;
      case 'phoenix': onPlayPhoenix(selectedTimer); break;
      default: return;
    }
  };

  const menuItems = [
    {
      id: 'online',
      icon: '🌐',
      title: 'Play Online',
      subtitle: 'Matchmaking vs real players',
      gradient: 'from-blue-500/20 to-blue-700/10',
      border: 'border-blue-500/30',
      glow: 'hover:shadow-[0_0_24px_rgba(59,130,246,0.2)]',
      requiresTimer: true,
    },
    {
      id: 'normal',
      icon: '♟',
      title: 'Play vs Bot',
      subtitle: 'Chess with AI opponent',
      gradient: 'from-amber-500/20 to-amber-700/10',
      border: 'border-amber-500/30',
      glow: 'hover:shadow-[0_0_24px_rgba(245,158,11,0.15)]',
      requiresTimer: true,
    },
    {
      id: 'phoenix',
      icon: '🔥',
      title: 'Phoenix Core',
      subtitle: 'Custom 2-player variant',
      gradient: 'from-orange-600/20 to-red-800/10',
      border: 'border-orange-500/30',
      glow: 'hover:shadow-[0_0_24px_rgba(249,115,22,0.2)]',
      requiresTimer: true,
    },
    {
      id: 'analysis',
      icon: '📊',
      title: 'Analysis Mode',
      subtitle: 'Review & analyze your games',
      gradient: 'from-cyan-500/20 to-blue-700/10',
      border: 'border-cyan-500/30',
      glow: 'hover:shadow-[0_0_24px_rgba(34,211,238,0.2)]',
      requiresTimer: false,
    },
  ];

  if (showTimerSelect) {
    const isPhoenix = showTimerSelect === 'phoenix';
    const isOnline = showTimerSelect === 'online';

    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6 font-inter">
        <button
          onClick={() => { setShowTimerSelect(null); setSelectedTimer(TIMER_MODES[0]); }}
          className="mb-6 text-sm text-muted-foreground hover:text-foreground transition-colors self-start"
        >
          ← Back
        </button>

        <h2 className="text-2xl font-black text-foreground mb-1">
          {isPhoenix ? '🔥 Phoenix Core' : isOnline ? '🌐 Play Online' : '♟ Play vs Bot'}
        </h2>

        <p className="text-muted-foreground text-sm mb-6">Choose time per player</p>

        <div className="space-y-3 w-full max-w-sm mb-6">
          {TIMER_MODES.map((mode) => (
            <button
              key={mode.id}
              onClick={() => setSelectedTimer(mode)}
              className={`w-full flex items-center justify-between px-4 py-3.5 rounded-xl border transition-all duration-200 ${
                selectedTimer?.id === mode.id
                  ? 'border-primary bg-primary/10 shadow-lg shadow-primary/20'
                  : 'border-border bg-card hover:bg-card/80'
              }`}
            >
              <span className="font-semibold text-sm text-foreground">{mode.label}</span>
              <span className="font-mono text-xs text-muted-foreground">
                {Math.floor(mode.seconds / 60)}:{(mode.seconds % 60).toString().padStart(2,'0')}
                {mode.increment > 0 && `+${mode.increment}`}
              </span>
            </button>
          ))}
        </div>

        <button
          onClick={handleStartGame}
          className="w-full max-w-sm py-4 rounded-xl bg-primary text-primary-foreground font-bold text-base hover:bg-primary/90 transition-colors shadow-lg shadow-primary/30"
        >
          {isOnline ? 'Find Match →' : 'Start Game →'}
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col font-inter">
      {/* Top bar with profile and leaderboard */}
      <div className="flex items-center justify-between px-4 pt-4">
        <button
          onClick={onLeaderboard}
          className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors px-3 py-2 rounded-lg border border-border hover:bg-secondary"
        >
          🏆 Leaderboard
        </button>
        <button
          onClick={onProfile}
          className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors px-3 py-2 rounded-lg border border-border hover:bg-secondary"
        >
          👤 Profile
        </button>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center p-6">
        <div className="flex flex-col items-center mb-12">
          <span className="text-6xl mb-4 drop-shadow-lg">♟</span>
          <h1 className="text-5xl font-black text-foreground tracking-tight">
            Chess<span className="text-primary">.</span>
          </h1>
          <p className="text-muted-foreground text-sm mt-1 font-medium">Modern Chess Experience</p>
        </div>

        <div className="flex flex-col gap-4 w-full max-w-sm">
          {menuItems.map((item) => (
            <button
              key={item.id}
              onClick={() => {
                // For analysis mode, don't show timer selection, just call onAnalysis directly
                if (item.id === 'analysis') {
                  onAnalysis();
                } else {
                  handleModeSelect(item.id);
                }
              }}
              className={`flex items-center gap-4 px-5 py-4 rounded-2xl border bg-gradient-to-r ${item.gradient} ${item.border} ${item.glow} transition-all duration-300 hover:scale-[1.02] active:scale-[0.98] text-left`}
            >
              <span className="text-2xl">{item.icon}</span>
              <div className="flex flex-col">
                <span className="font-bold text-foreground text-base">{item.title}</span>
                <span className="text-xs text-muted-foreground">{item.subtitle}</span>
              </div>
              <span className="ml-auto text-muted-foreground">→</span>
            </button>
          ))}
        </div>

        <p className="mt-10 text-xs text-muted-foreground/50">
          Powered by Stockfish AI • Chess.js
        </p>
      </div>
    </div>
  );
}
