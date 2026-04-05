import React, { useState, useEffect } from 'react';
import { GameProvider, useGame } from './context/GameContext';
import Home from './components/Home';
import Score from './components/Score';
import History from './components/History';
import DailySettlement from './components/DailySettlement';
import MonthlySettlement from './components/MonthlySettlement';
import PlayerManagement from './components/PlayerManagement';

function AppContent() {
  const { currentPage, loading } = useGame();
  const [theme, setTheme] = useState(() => {
    return localStorage.getItem('theme') || 'zen';
  });

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme(prev => {
      if (prev === 'simple') return 'modern';
      if (prev === 'modern') return 'zen';
      return 'simple';
    });
  };

  const getThemeLabel = () => {
    if (theme === 'simple') return '简';
    if (theme === 'modern') return '现';
    return '禅';
  };

  if (loading) {
    return (
      <div className="container">
        <div className="loading">加载中...</div>
      </div>
    );
  }

  return (
    <div className="container">
      {currentPage === 'home' && <Home toggleTheme={toggleTheme} theme={theme} />}
      {currentPage === 'score' && <Score toggleTheme={toggleTheme} theme={theme} />}
      {currentPage === 'history' && <History toggleTheme={toggleTheme} theme={theme} />}
      {currentPage === 'daily-settlement' && <DailySettlement toggleTheme={toggleTheme} theme={theme} />}
      {currentPage === 'monthly-settlement' && <MonthlySettlement toggleTheme={toggleTheme} theme={theme} />}
      {currentPage === 'manage' && <PlayerManagement toggleTheme={toggleTheme} theme={theme} />}
    </div>
  );
}

function App() {
  return (
    <GameProvider>
      <AppContent />
    </GameProvider>
  );
}

export default App;
