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
  const [config, setConfig] = useState({
    admin: false,
    pollInterval: 600000,
    logLevel: 'info'
  });

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
  }, [theme]);

  useEffect(() => {
    let intervalId;

    function fetchConfig() {
      fetch('/api/config')
        .then(res => res.json())
        .then(data => setConfig(data))
        .catch(() => {});
    }

    fetchConfig();

    intervalId = setInterval(fetchConfig, config.pollInterval || 600000);

    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, [config.pollInterval]);

  const toggleTheme = () => {
    setTheme(prev => {
      if (prev === 'simple') return 'modern';
      if (prev === 'modern') return 'zen';
      return 'simple';
    });
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
      {currentPage === 'home' && <Home toggleTheme={toggleTheme} theme={theme} config={config} />}
      {currentPage === 'score' && <Score toggleTheme={toggleTheme} theme={theme} />}
      {currentPage === 'history' && <History toggleTheme={toggleTheme} theme={theme} />}
      {currentPage === 'daily-settlement' && <DailySettlement toggleTheme={toggleTheme} theme={theme} />}
      {currentPage === 'monthly-settlement' && <MonthlySettlement toggleTheme={toggleTheme} theme={theme} />}
      {currentPage === 'manage' && <PlayerManagement toggleTheme={toggleTheme} theme={theme} />}
    </div>
  );
}

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('[ErrorBoundary] App crashed:', error, errorInfo);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="container">
          <div className="header">
            <h1>🃏 地下室记分</h1>
          </div>
          <div className="error-fallback" style={{ padding: '20px', textAlign: 'center' }}>
            <h2>应用出现错误</h2>
            <p style={{ color: '#666' }}>{this.state.error?.message || '未知错误'}</p>
            <button
              className="btn btn-primary"
              onClick={this.handleReset}
              style={{ marginTop: '20px' }}
            >
              刷新页面
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

function App() {
  return (
    <ErrorBoundary>
      <GameProvider>
        <AppContent />
      </GameProvider>
    </ErrorBoundary>
  );
}

export default App;
