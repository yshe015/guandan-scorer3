import React, { useState } from 'react';
import { useGame } from '../context/GameContext';
import * as api from '../api';

export default function DailySettlement() {
  const {
    players,
    todayScores,
    date,
    month,
    setCurrentPage,
    setHasUnsettled,
    setDailySettlementCount,
    loadData,
    setSelectedPlayers
  } = useGame();

  const [alertMsg, setAlertMsg] = useState(null);
  const [confirmMsg, setConfirmMsg] = useState(null);

  const playerScoreMap = {};
  todayScores.forEach(p => {
    playerScoreMap[p.id] = p.today_score || 0;
  });

  const totalScore = Object.values(playerScoreMap).reduce((a, b) => a + b, 0);

  const confirmDailySettlement = async () => {
    setConfirmMsg('确认日结？日结后当日数据将锁定。');
  };

  const handleConfirm = async () => {
    setConfirmMsg(null);

    const data = {};
    todayScores.forEach(p => {
      const player = players.find(pl => pl.id === p.id);
      if (player) {
        data[player.name] = p.today_score || 0;
      }
    });

    try {
      await api.confirmDailySettlement({ date, month, data });
      setAlertMsg('日结成功！');
      setHasUnsettled(false);
      setDailySettlementCount(prev => prev + 1);
      setSelectedPlayers([]); // Clear players
      loadData();
      setTimeout(() => setCurrentPage('home'), 1500);
    } catch (e) {
      setAlertMsg('日结失败：' + e.message);
    }
  };

  const closeAlert = () => {
    setAlertMsg(null);
  };

  return (
    <>
      <div className="header">
        <h1>📅 日结</h1>
        <button className="header-btn" onClick={() => setCurrentPage('score')}>←</button>
      </div>
      <div className="date-display">{date}</div>
      
      <div className="settlement-info">
        <h3>今日战况汇总</h3>
      </div>
      
      <table className="score-table">
        <thead>
          <tr>
            <th>玩家</th>
            <th>今日积分</th>
          </tr>
        </thead>
        <tbody>
          {players.map(p => (
            <tr key={p.id}>
              <td>{p.name}</td>
              <td className={playerScoreMap[p.id] > 0 ? 'positive' : playerScoreMap[p.id] < 0 ? 'negative' : ''}>
                {playerScoreMap[p.id] || 0}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      
      <div className="daily-summary">
        <div>今日小计: {totalScore}</div>
      </div>
      
      <div className="section">
        <button className="btn btn-primary" onClick={confirmDailySettlement}>确认日结</button>
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
