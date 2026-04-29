import React, { useState, useEffect } from 'react';

const SERVER_URL = 'https://phoenix-chess-server.onrender.com';

const NORMAL_CATEGORIES = ['bullet', 'blitz', 'rapid', 'classical'];
const PHOENIX_CATEGORIES = ['blitz', 'rapid', 'classical'];

function getTierColor(rating) {
  if (rating < 800)  return 'text-green-400';
  if (rating < 1300) return 'text-yellow-400';
  if (rating < 1800) return 'text-blue-400';
  if (rating < 2000) return 'text-purple-400';
  if (rating < 2300) return 'text-cyan-400';
  return 'text-orange-400';
}

export default function LeaderboardPage({ onBack }) {
  const [mode, setMode] = useState('normal');
  const [category, setCategory] = useState('blitz');
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);

  const categories = mode === 'normal' ? NORMAL_CATEGORIES : PHOENIX_CATEGORIES;

  useEffect(() => {
    setLoading(true);
    fetch(`${SERVER_URL}/leaderboard/${mode}/${category}`)
      .then(r => r.json())
      .then(d => { if (Array.isArray(d)) setData(d); else setData([]); })
      .catch(() => setData([]))
      .finally(() => setLoading(false));
  }, [mode, category]);

  useEffect(() => {
    if (mode === 'phoenix' && category === 'bullet') setCategory('blitz');
  }, [mode]);

  return (
    <div className="min-h-screen bg-background flex flex-col font-inter">
      <div className="flex items-center px-4 py-3 border-b border-border">
        <button onClick={onBack} className="text-sm text-muted-foreground hover:text-foreground">← Menu</button>
        <h2 className="flex-1 text-center font-bold text-foreground">🏆 Leaderboard</h2>
        <div className="w-12" />
      </div>

      {/* Mode selector */}
      <div className="flex gap-2 p-4 pb-0">
        <button
          onClick={() => setMode('normal')}
          className={`flex-1 py-2 rounded-xl text-sm font-bold transition-all ${mode === 'normal' ? 'bg-primary text-primary-foreground' : 'bg-card border border-border text-muted-foreground'}`}
        >
          ♟ Normal Chess
        </button>
        <button
          onClick={() => setMode('phoenix')}
          className={`flex-1 py-2 rounded-xl text-sm font-bold transition-all ${mode === 'phoenix' ? 'bg-primary text-primary-foreground' : 'bg-card border border-border text-muted-foreground'}`}
        >
          🔥 Phoenix Core
        </button>
      </div>

      {/* Category selector */}
      <div className="flex gap-2 p-4 pb-0 overflow-x-auto">
        {categories.map(cat => (
          <button
            key={cat}
            onClick={() => setCategory(cat)}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${category === cat ? 'bg-secondary border border-primary text-foreground' : 'bg-card border border-border text-muted-foreground'}`}
          >
            {cat.charAt(0).toUpperCase() + cat.slice(1)}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        {loading && (
          <div className="text-center py-8 text-muted-foreground animate-pulse">Loading...</div>
        )}

        {!loading && data.length === 0 && (
          <div className="text-center py-8 text-muted-foreground">
            <div className="text-4xl mb-2">🏆</div>
            <p>No players yet</p>
            <p className="text-xs mt-1">Be the first to play!</p>
          </div>
        )}

        {!loading && data.map((player, i) => (
          <div key={i} className={`flex items-center gap-3 bg-card border rounded-xl px-4 py-3 mb-2 ${i < 3 ? 'border-primary/30' : 'border-border'}`}>
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-black ${
              i === 0 ? 'bg-yellow-500/20 text-yellow-400' :
              i === 1 ? 'bg-gray-400/20 text-gray-400' :
              i === 2 ? 'bg-amber-600/20 text-amber-600' :
              'bg-secondary text-muted-foreground'
            }`}>
              {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : player.rank}
            </div>

            <div className="flex-1">
              <div className="font-bold text-foreground text-sm">{player.displayName}</div>
              <div className="text-xs text-muted-foreground">@{player.username}</div>
            </div>

            <div className="text-right">
              <div className={`font-black text-lg ${getTierColor(player.rating)}`}>{player.rating}</div>
              <div className="text-xs text-muted-foreground">{player.tier?.emoji} {player.tier?.name}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
                        }
