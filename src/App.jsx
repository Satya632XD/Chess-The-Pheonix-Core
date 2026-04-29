import React, { useState } from 'react';
import { useAuth } from './context/AuthContext';
import AuthPage from './pages/AuthPage';
import MainMenu from './pages/MainMenu';
import NormalChess from './pages/NormalChess';
import PhoenixCore from './pages/PhoenixCore';
import OnlineChess from './pages/OnlineChess';
import ProfilePage from './pages/ProfilePage';
import LeaderboardPage from './pages/LeaderboardPage';

export default function App() {
  const { loading } = useAuth();
  const [screen, setScreen] = useState('auth');
  const [timerMode, setTimerMode] = useState(null);

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-4xl animate-pulse">♟</div>
      </div>
    );
  }

  const goMenu = () => setScreen('menu');

  if (screen === 'auth') return <AuthPage onSuccess={() => setScreen('menu')} />;
  if (screen === 'profile') return <ProfilePage onBack={goMenu} />;
  if (screen === 'leaderboard') return <LeaderboardPage onBack={goMenu} />;
  if (screen === 'normal') return <NormalChess timerMode={timerMode} onBack={goMenu} />;
  if (screen === 'phoenix') return <PhoenixCore timerMode={timerMode} onBack={goMenu} />;
  if (screen === 'online') return <OnlineChess timerMode={timerMode} onBack={goMenu} />;

  return (
    <MainMenu
      onPlayNormal={(t) => { setTimerMode(t); setScreen('normal'); }}
      onPlayPhoenix={(t) => { setTimerMode(t); setScreen('phoenix'); }}
      onPlayOnline={(t) => { setTimerMode(t); setScreen('online'); }}
      onProfile={() => setScreen('profile')}
      onLeaderboard={() => setScreen('leaderboard')}
    />
  );
}
