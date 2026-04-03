import React, { useState } from 'react';
import { useGame } from '../context/GameContext';
import * as api from '../api';

export default function MonthlySettlement() {
  const {
    players,
    monthScores,
    month,
    setCurrentPage,
    setHasUnsettled,
    loadData
  } = useGame();

  const [alertMsg, setAlertMsg] = useState(null);
  const [confirmMsg, setConfirmMsg] = useState(null);

  const playerScoreMap = {};
  monthScores.forEach(p => {
    playerScoreMap[p.id] = p.month_score || 0;
  });

  const sortedPlayers = players.map(p => ({
    name: p.name,
    score: playerScoreMap[p.id] || 0
  })).sort((a, b) => b.score - a.score);

  const champion = sortedPlayers[0];

  const confirmMonthlySettlement = async () => {
    setConfirmMsg('确认月结？月结后数据将存档。');
  };

  const handleConfirm = async () => {
    setConfirmMsg(null);
    
    const data = {};
    monthScores.forEach(p => {
      const player = players.find(pl => pl.id === p.id);
      if (player) {
        data[player.name] = p.month_score || 0;
      }
    });

    try {
      await api.confirmMonthlySettlement({ month, data });
      setAlertMsg('月结成功！');
      setHasUnsettled(false);
      loadData();
      setTimeout(() => {
        setAlertMsg(null);
        setCurrentPage('home');
      }, 1500);
    } catch (e) {
      setAlertMsg('月结失败：' + e.message);
    }
  };

  const closeAlert = () => {
    setAlertMsg(null);
  };

  return (
    <>
      <div className="header">
        <h1>📆 月结</h1>
        <button className="header-btn" onClick={() => setCurrentPage('home')}>🏠</button>
      </div>
      <div className="date-display">{month}月</div>
      
      <div className="settlement-info">
        <h3>{month}月战况汇总</h3>
      </div>
      
      <table className="score-table">
        <thead>
          <tr>
            <th>#</th>
            <th>玩家</th>
            <th>本月积分</th>
          </tr>
        </thead>
        <tbody>
          {sortedPlayers.map((p, i) => (
            <tr key={i}>
              <td><span className="rank-num">{i + 1}</span></td>
              <td>{p.name}</td>
              <td className={p.score > 0 ? 'positive' : p.score < 0 ? 'negative' : ''}>
                {p.score > 0 ? '+' + p.score : p.score}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      
      {champion && (
        <div className="month-champion">
          <h4>🏆 月度冠军</h4>
          <div className="name">{champion.name}</div>
          <div>{champion.score > 0 ? '+' + champion.score : champion.score}分</div>
        </div>
      )}
      
      <div className="section">
        <button className="btn btn-primary" onClick={confirmMonthlySettlement}>确认月结</button>
      </div>

      {alertMsg && (
        <div className="modal-overlay" onClick={closeAlert}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <p>{alertMsg}</p>
            <button className="btn btn-primary" onClick={closeAlert}>确定</button>
          </div>
        </div>
      )}

      {confirmMsg && (
        <div className="modal-overlay" onClick={() => setConfirmMsg(null)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <p>{confirmMsg}</p>
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
              <button className="btn btn-secondary" onClick={() => setConfirmMsg(null)}>取消</button>
              <button className="btn btn-primary" onClick={handleConfirm}>确认</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
