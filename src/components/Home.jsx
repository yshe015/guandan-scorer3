import React, { useState } from 'react';
import { useGame } from '../context/GameContext';
import * as api from '../api';

function formatDate(date) {
  const weekdays = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'];
  const d = new Date(date);
  return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日 ${weekdays[d.getDay()]}`;
}

export default function Home({ toggleTheme, theme, config }) {
  const { admin } = config || { admin: false };
  const showThemeButton = admin;
  const showResetButton = admin;
  const {
    players,
    todayScores,
    monthScores,
    selectedPlayers,
    setSelectedPlayers,
    currentRound,
    date,
    hasGame,
    hasUnsettled,
    dailySettlementCount,
    setCurrentPage,
    loadData,
    currentGame
  } = useGame();

  const [alertMsg, setAlertMsg] = useState(null);

  const displayRound = currentGame?.round || currentRound;

  React.useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 5000);
    return () => clearInterval(interval);
  }, []);

  const playerScoreMap = {};
  todayScores.forEach(p => {
    playerScoreMap[p.id] = p.today_score || 0;
  });

  const monthScoreMap = {};
  monthScores.forEach(p => {
    monthScoreMap[p.id] = p.month_score || 0;
  });

  const sortedPlayers = players.map(p => ({
    ...p,
    todayScore: playerScoreMap[p.id] || 0,
    monthScore: monthScoreMap[p.id] || 0
  })).sort((a, b) => b.monthScore - a.monthScore);

  const isGameActive = hasGame && selectedPlayers.length >= 4;

  const togglePlayer = async (id) => {
    const idx = selectedPlayers.indexOf(id);
    let newSelected;
    if (idx > -1) {
      // Check if deselecting would result in less than 4 players
      if (selectedPlayers.length <= 4) {
        setAlertMsg('至少需要4位玩家！');
        return;
      }
      newSelected = selectedPlayers.filter(p => p !== id);
    } else {
      if (selectedPlayers.length < 10) {
        newSelected = [...selectedPlayers, id];
      } else {
        return;
      }
    }
    setSelectedPlayers(newSelected);
    
    // 只有选中4人或以上时才同步到服务器
    if (newSelected.length >= 4) {
      const scores = {};
      newSelected.forEach(pid => {
        scores[pid] = currentGame.scores?.[pid] || 0;
      });
      try {
        await api.saveCurrentGame({
          date,
          round: currentRound,
          selected_players: newSelected,
          scores
        });
      } catch (e) {
        console.error('Failed to sync players:', e);
      }
    }
  };

  const startGame = async () => {
    if (selectedPlayers.length < 4) {
      alert('请选择至少4位玩家！');
      return;
    }

    const scores = {};
    selectedPlayers.forEach(id => {
      scores[id] = 0;
    });

    await api.saveCurrentGame({
      date,
      round: currentRound,
      selected_players: selectedPlayers,
      scores
    });

    loadData();
    setCurrentPage('score');
  };

  const resetData = async () => {
    const password = prompt('请输入密码:');
    if (!password) return;

    try {
      await api.resetData(password);
      alert('清零成功！');
      setSelectedPlayers([]);
      loadData();
    } catch (e) {
      alert('清零失败：' + e.message);
    }
  };

  return (
    <>
      <div className="header">
        <h1>🃏 地下室掼蛋记分器</h1>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          {showThemeButton && (
            <button 
              className="header-btn" 
              onClick={toggleTheme}
              title={`当前: ${theme === 'simple' ? '简洁' : theme === 'modern' ? '现代' : '禅'}主题`}
              style={{ fontSize: '14px' }}
            >
              {theme === 'simple' ? '简' : theme === 'modern' ? '现' : '禅'}
            </button>
          )}
          <button className="header-btn" onClick={() => setCurrentPage('manage')}>管理</button>
          {showResetButton && (
            <button className="header-btn" onClick={resetData}>清零</button>
          )}
        </div>
      </div>
      <div className="date-display">{formatDate(date)}</div>
      
      <div className="section">
        <div className="section-title">
          <span>👥 玩家 ({players.length}人)</span>
        </div>
        <div className="players-grid">
          {players.map(p => (
            <div
              key={p.id}
              className={`player-chip ${selectedPlayers.includes(p.id) ? 'selected' : ''}`}
              onClick={() => togglePlayer(p.id)}
            >
              <span className="check"></span>
              <span>{p.name}</span>
            </div>
          ))}
        </div>
      </div>
      
      <div className="section">
        <div className="section-title">📊 积分榜</div>
        <table className="score-table">
          <thead>
            <tr>
              <th>#</th>
              <th>玩家</th>
              <th>今日</th>
              <th>本月累计</th>
            </tr>
          </thead>
          <tbody>
            {sortedPlayers.map((p, i) => (
              <tr key={p.id}>
                <td><span className="rank-num">{i + 1}</span></td>
                <td>{p.name}</td>
                <td><span className={`score-box ${p.todayScore > 0 ? 'positive' : p.todayScore < 0 ? 'negative' : 'neutral'}`}>{p.todayScore > 0 ? '+' + p.todayScore : p.todayScore}</span></td>
                <td><span className={`score-box ${p.monthScore > 0 ? 'positive' : p.monthScore < 0 ? 'negative' : 'neutral'}`}>{p.monthScore > 0 ? '+' + p.monthScore : p.monthScore}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      
      <div className="section">
        {isGameActive ? (
          <button className="btn btn-primary" onClick={() => setCurrentPage('score')}>
            🎮 记分 (第{displayRound}局)
          </button>
        ) : (
          <button
            className="btn btn-primary"
            onClick={startGame}
            disabled={selectedPlayers.length < 4}
            style={selectedPlayers.length < 4 ? { opacity: 0.5 } : {}}
          >
            🎮 开始记分
          </button>
        )}
      </div>
      
      <div className="section">
        <div className="btn-group">
          <button className="btn btn-secondary" onClick={() => setCurrentPage('history')}>📜 历史</button>
          <button className="btn btn-secondary" onClick={() => setCurrentPage('monthly-settlement')}>📆 月结</button>
        </div>
      </div>

      {alertMsg && (
        <div className="modal-overlay" onClick={() => setAlertMsg(null)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <p>{alertMsg}</p>
            <button className="btn btn-primary" onClick={() => setAlertMsg(null)}>确定</button>
          </div>
        </div>
      )}
    </>
  );
}