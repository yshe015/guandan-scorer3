import React, { useState } from 'react';
import { useGame } from '../context/GameContext';
import * as api from '../api';

export default function PlayerManagement() {
  const { players, todayScores, setPlayers, setSelectedPlayers, selectedPlayers, setCurrentPage, loadData } = useGame();
  const [newName, setNewName] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [editName, setEditName] = useState('');
  const [alertMsg, setAlertMsg] = useState(null);
  const [confirmMsg, setConfirmMsg] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);

  const playerScoreMap = {};
  todayScores.forEach(p => {
    playerScoreMap[p.id] = p.today_score || 0;
  });

  const addPlayer = async () => {
    const name = newName.trim();
    if (!name) return;

    try {
      await api.addPlayer(name);
      setNewName('');
      loadData();
    } catch (e) {
      if (e.message.includes('UNIQUE constraint failed')) {
        setAlertMsg('玩家已存在');
      } else {
        setAlertMsg('添加失败: ' + e.message);
      }
    }
  };

  const deletePlayer = async (id) => {
    setConfirmMsg('确定要删除该玩家吗？');
    setDeleteTarget(id);
  };

  const handleDeleteConfirm = async () => {
    setConfirmMsg(null);
    const id = deleteTarget;
    setDeleteTarget(null);

    try {
      await api.deletePlayer(id);
      setSelectedPlayers(selectedPlayers.filter(p => p !== id));
      loadData();
    } catch (e) {
      setAlertMsg('删除失败：' + e.message);
    }
  };

  const startEdit = (player) => {
    setEditingId(player.id);
    setEditName(player.name);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditName('');
  };

  const saveEdit = async (id) => {
    const name = editName.trim();
    if (!name) return;

    try {
      await api.updatePlayer(id, name);
      setEditingId(null);
      setEditName('');
      loadData();
    } catch (e) {
      alert('修改失败：' + e.message);
    }
  };

  return (
    <>
      <div className="header">
        <h1>👥 玩家管理</h1>
        <button className="header-btn" onClick={() => setCurrentPage('home')}>🏠</button>
      </div>
      
      <div className="player-input-wrap">
        <input
          type="text"
          className="player-input"
          id="newPlayerName"
          placeholder="输入玩家名称"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          onKeyPress={(e) => e.key === 'Enter' && addPlayer()}
        />
        <button className="btn btn-primary" style={{ width: 'auto', margin: 0 }} onClick={addPlayer}>添加</button>
      </div>
      
      <div className="section">
        <div className="section-title">玩家列表</div>
        {players.length === 0 ? (
          <div className="empty-state">暂无玩家，请添加</div>
        ) : (
          players.map(p => (
            <div key={p.id} className="player-list-item">
              {editingId === p.id ? (
                <div style={{ display: 'flex', gap: '8px', flex: 1, alignItems: 'center' }}>
                  <input
                    type="text"
                    className="player-input"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && saveEdit(p.id)}
                    autoFocus
                  />
                  <button className="btn btn-primary" style={{ width: 'auto', padding: '8px 12px' }} onClick={() => saveEdit(p.id)}>保存</button>
                  <button className="btn btn-secondary" style={{ width: 'auto', padding: '8px 12px' }} onClick={cancelEdit}>取消</button>
                </div>
              ) : (
                <>
                  <span className="player-list-name">{p.name}</span>
                  <div>
                    <button className="delete-btn" style={{ background: '#1976d2' }} onClick={() => startEdit(p)}>修改</button>
                    <button className="delete-btn" style={{ marginLeft: '4px' }} onClick={() => deletePlayer(p.id)}>删除</button>
                  </div>
                </>
              )}
            </div>
          ))
        )}
      </div>

      {alertMsg && (
        <div className="modal-overlay" onClick={() => setAlertMsg(null)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <p>{alertMsg}</p>
            <button className="btn btn-primary" onClick={() => setAlertMsg(null)}>确定</button>
          </div>
        </div>
      )}

      {confirmMsg && (
        <div className="modal-overlay" onClick={() => { setConfirmMsg(null); setDeleteTarget(null); }}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <p>{confirmMsg}</p>
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
              <button className="btn btn-secondary" onClick={() => { setConfirmMsg(null); setDeleteTarget(null); }}>取消</button>
              <button className="btn btn-primary" onClick={handleDeleteConfirm}>确认</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}