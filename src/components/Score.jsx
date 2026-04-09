import React, { useEffect, useState } from 'react';
import { useGame } from '../context/GameContext';
import * as api from '../api';

const SCORE_OPTIONS = [
  { value: 3, label: '+3' },
  { value: 2, label: '+2' },
  { value: 1, label: '+1' },
  { value: 0, label: '0' },
  { value: -1, label: '-1' },
  { value: -2, label: '-2' },
  { value: -3, label: '-3' }
];

function formatDate(date) {
  const weekdays = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'];
  const d = new Date(date);
  return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日 ${weekdays[d.getDay()]}`;
}

export default function Score() {
  const {
    players,
    todayScores,
    selectedPlayers,
    setSelectedPlayers,
    currentRound,
    date,
    month,
    hasUnsettled,
    dailySettlementCount,
    setCurrentPage,
    loadData,
    setHasUnsettled,
    setDailySettlementCount,
    startPolling,
    stopPolling,
    currentGame,
    setCurrentGame
  } = useGame();

  const [alertMsg, setAlertMsg] = useState(null);

  useEffect(() => {
    loadCurrentGame();
    loadData(); // Also refresh scores
    
    const intervalId = setInterval(() => {
      loadCurrentGame();
      loadData(); // Refresh scores every 3 seconds
    }, 3000);
    
    return () => {
      clearInterval(intervalId);
    };
  }, []);

  const loadCurrentGame = async () => {
    try {
      const game = await api.getCurrentGame();
      
      // No game at all - go to home
      if (!game) {
        setCurrentGame({
          round: 1,
          selected_players: [],
          scores: {},
          submitted: false
        });
        setCurrentPage('home');
        return;
      }
      
      // Game exists - load it (regardless of date)
      const scores = game.scores || {};
      const initializedScores = {};
      (game.selected_players || []).forEach(id => {
        initializedScores[id] = scores[id] !== undefined ? scores[id] : 0;
      });
      setCurrentGame({
        round: game.round,
        selected_players: game.selected_players || [],
        scores: initializedScores,
        submitted: game.submitted
      });
    } catch (e) {
      console.error(e);
    }
  };

  const playerScoreMap = {};
  todayScores.forEach(p => {
    playerScoreMap[p.id] = p.today_score || 0;
  });

  const selectedPlayerList = players.filter(p => selectedPlayers.includes(p.id));

  const updateScore = (playerId, value) => {
    const newScores = { ...currentGame.scores, [playerId]: parseInt(value) };
    setCurrentGame({ ...currentGame, scores: newScores });
    syncGameState(newScores);
  };

  const syncGameState = async (scores) => {
    try {
      await api.saveCurrentGame({
        date,
        round: currentGame.round,
        selected_players: currentGame.selected_players,
        scores
      });
    } catch (e) {
      console.error(e);
    }
  };

  const submitScore = async () => {
    if (currentGame.submitted) {
      setAlertMsg('本局已结束，请刷新页面');
      return;
    }

    const records = Object.entries(currentGame.scores)
      .filter(([id, score]) => score !== 0)
      .map(([playerId, score]) => ({
        player_id: parseInt(playerId),
        score
      }));

    if (records.length !== 4) {
      setAlertMsg('必须有4人记分！');
      return;
    }

    const scores = records.map(r => r.score).sort((a, b) => b - a);
    const validCombos = [
      [3, 3, -3, -3],
      [2, 2, -2, -2],
      [1, 1, -1, -1]
    ];

    const isValidCombo = validCombos.some(combo => 
      JSON.stringify(combo) === JSON.stringify(scores)
    );

    if (!isValidCombo) {
      setAlertMsg('记分组合无效！只能使用 [+3,+3,-3,-3] 或 [+2,+2,-2,-2] 或 [+1,+1,-1,-1]');
      return;
    }

    const total = scores.reduce((a, b) => a + b, 0);
    if (total !== 0) {
      setAlertMsg('记分总和必须为0！');
      return;
    }

    try {
      console.log('[Score] Submitting score, date:', date, 'round:', currentGame.round);
      await api.submitScore({
        date,
        month,
        round: currentGame.round,
        records
      });
      
      setAlertMsg('记分成功！');
      setHasUnsettled(true);
      setDailySettlementCount(0);
      console.log('[Score] Calling loadData...');
      loadData();
      console.log('[Score] Calling loadCurrentGame...');
      loadCurrentGame();
    } catch (e) {
      setAlertMsg('记分失败：' + e.message);
    }
  };

  const closeAlert = () => {
    setAlertMsg(null);
  };

  const nonZeroScores = Object.values(currentGame.scores).filter(s => s !== 0).length;
  const scoreStr = Object.values(currentGame.scores).filter(s => s !== 0).sort((a, b) => b - a).join(',');

  return (
    <>
      <div className="header">
        <h1>🃏 地下室记分</h1>
        <button className="header-btn" onClick={() => setCurrentPage('home')}>🏠</button>
      </div>
      <div className="date-display">
        {formatDate(date)} 第{currentGame.round}局 {currentGame.submitted ? <span style={{color: 'red'}}>(已结束)</span> : ''}
      </div>
      
      <div className="section" style={{ padding: '12px 16px' }}>
        <div className="section-title">本局得分:</div>
        <table className="score-table">
          <thead>
            <tr>
              <th>玩家</th>
              <th>本局</th>
              <th>今日</th>
            </tr>
          </thead>
          <tbody>
            {selectedPlayerList.map(p => {
              const score = currentGame.scores[p.id] || 0;
              return (
                <tr key={p.id}>
                  <td>{p.name}</td>
                  <td>
                    {currentGame.submitted ? (
                      <span className={`score-box ${score > 0 ? 'positive' : score < 0 ? 'negative' : 'neutral'}`}>
                        {score > 0 ? '+' + score : score}
                      </span>
                    ) : (
                      <select
                        className="score-select"
                        value={score}
                        onChange={(e) => updateScore(p.id, e.target.value)}
                      >
                        {SCORE_OPTIONS.map(o => (
                          <option key={o.value} value={o.value}>{o.label}</option>
                        ))}
                      </select>
                    )}
                  </td>
                  <td>
                    {playerScoreMap[p.id] !== undefined ? (
                      <span className={`score-box ${playerScoreMap[p.id] > 0 ? 'positive' : playerScoreMap[p.id] < 0 ? 'negative' : 'neutral'}`}>
                        {playerScoreMap[p.id] > 0 ? '+' + playerScoreMap[p.id] : playerScoreMap[p.id]}
                      </span>
                    ) : (
                      <span className="score-box neutral">0</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        
        <div className="score-hint">
          已选: {nonZeroScores}人 &nbsp; 当前: {scoreStr || '无'}
        </div>
      </div>
      
      <div className="section btn-group" style={{ padding: '12px 16px' }}>
        <button className="btn btn-secondary" onClick={() => setCurrentPage('home')}>取消</button>
        <button
          className="btn btn-primary"
          onClick={submitScore}
          disabled={currentGame.submitted}
          style={currentGame.submitted ? { opacity: 0.5 } : {}}
        >
          确认记分
        </button>
      </div>
      
      <div className="section" style={{ padding: '12px 16px' }}>
        <button
          className={`btn ${hasUnsettled ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setCurrentPage('daily-settlement')}
          disabled={!hasUnsettled}
          style={!hasUnsettled ? { opacity: 0.5 } : {}}
        >
          📅 日结 {dailySettlementCount > 0 ? `(已结${dailySettlementCount}次)` : ''}
        </button>
      </div>

      {alertMsg && (
        <div className="modal-overlay" onClick={closeAlert}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <p>{alertMsg}</p>
            <button className="btn btn-primary" onClick={closeAlert}>确定</button>
          </div>
        </div>
      )}
    </>
  );
}
