import React, { useState } from 'react';

import { useAuth } from './context/AuthContext';

import AuthPage from './pages/AuthPage';
import MainMenu from './pages/MainMenu';
import NormalChess from './pages/NormalChess';
import PhoenixCore from './pages/PhoenixCore';
import OnlineChess from './pages/OnlineChess';
import AnalysisMode from './pages/AnalysisMode';
import ProfilePage from './pages/ProfilePage';
import LeaderboardPage from './pages/LeaderboardPage';

export default function App() {
  const { loading } = useAuth();

  const [screen, setScreen] = useState('auth');
  const [timerMode, setTimerMode] = useState(null);

  // LOADING SCREEN
  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-4xl animate-pulse">
          ♟
        </div>
      </div>
    );
  }

  // NAVIGATION HELPERS
  const goMenu = () => setScreen('menu');

  // AUTH PAGE
  if (screen === 'auth') {
    return (
      <AuthPage
        onSuccess={() => setScreen('menu')}
      />
    );
  }

  // PROFILE PAGE
  if (screen === 'profile') {
    return (
      <ProfilePage
        onBack={goMenu}
      />
    );
  }

  // LEADERBOARD PAGE
  if (screen === 'leaderboard') {
    return (
      <LeaderboardPage
        onBack={goMenu}
      />
    );
  }

  // NORMAL CHESS PAGE
  if (screen === 'normal') {
    return (
      <NormalChess
        timerMode={timerMode}
        onBack={goMenu}
      />
    );
  }

  // PHOENIX CORE PAGE
  if (screen === 'phoenix') {
    return (
      <PhoenixCore
        timerMode={timerMode}
        onBack={goMenu}
      />
    );
  }

  // ONLINE CHESS PAGE
  if (screen === 'online') {
    return (
      <OnlineChess
        timerMode={timerMode}
        onBack={goMenu}
      />
    );
  }

  // ANALYSIS MODE PAGE
  if (screen === 'analysis') {
    return (
      <AnalysisMode
        onBack={goMenu}
      />
    );
  }

  // MAIN MENU
  return (
    <MainMenu
      onPlayNormal={(timer) => {
        setTimerMode(timer);
        setScreen('normal');
      }}
      onPlayPhoenix={(timer) => {
        setTimerMode(timer);
        setScreen('phoenix');
      }}
      onPlayOnline={(timer) => {
        setTimerMode(timer);
        setScreen('online');
      }}
      onAnalysis={() => {
        setScreen('analysis');
      }}
      onProfile={() => {
        setScreen('profile');
      }}
      onLeaderboard={() => {
        setScreen('leaderboard');
      }}
    />
  );
}
