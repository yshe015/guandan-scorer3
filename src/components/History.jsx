import React, { useState, useEffect } from 'react';
import { useGame } from '../context/GameContext';
import * as api from '../api';

export default function History() {
  const { historyData, dailyRecords, month, setCurrentPage, expandedItems, setExpandedItems, loadData } = useGame();

  const [localExpanded, setLocalExpanded] = useState({});
  const [settlementRecords, setSettlementRecords] = useState({});

  useEffect(() => {
    loadData();
  }, []);

  // Fetch settlement-specific records when expanding
  const fetchSettlementRecords = async (settlementKey) => {
    if (settlementRecords[settlementKey]) return; // Already fetched
    
    try {
      const data = await api.getDailySettlementRecords(settlementKey);
      setSettlementRecords(prev => ({
        ...prev,
        [settlementKey]: data.grouped || {}
      }));
    } catch (e) {
      console.error('Failed to fetch settlement records:', e);
    }
  };

  const toggleExpand = (key) => {
    setLocalExpanded(prev => {
      const newState = { ...prev, [key]: !prev[key] };
      // Fetch settlement records when expanding
      if ((key.startsWith('daily-') || key.startsWith('daily-nm-')) && !prev[key]) {
        const settlementKey = key.replace(/^daily-nm-/, '').replace(/^daily-/, '');
        fetchSettlementRecords(settlementKey);
      }
      return newState;
    });
  };

  const { monthly, daily, currentRecords } = historyData;
  const { todayScores } = useGame();

  // 当前记录（未日结）- 不分日期，直接按局数列出
  const currentRecordsGrouped = {};
  (currentRecords || []).forEach(r => {
    if (!currentRecordsGrouped[r.round]) {
      currentRecordsGrouped[r.round] = [];
    }
    currentRecordsGrouped[r.round].push({ name: r.name, score: r.score });
  });

  const currentRounds = Object.keys(currentRecordsGrouped).sort((a, b) => b - a);

  // 计算玩家未日结累计
  const playerTotals = {};
  (currentRecords || []).forEach(r => {
    playerTotals[r.name] = (playerTotals[r.name] || 0) + r.score;
  });

  // 分离有月结和无月结的日结 - 通过 monthly_settlement_id 判断
  const dailyWithMonthly = (daily || []).filter(d => d.monthly_settlement_id);
  const dailyWithoutMonthly = (daily || []).filter(d => !d.monthly_settlement_id);

  // Default expand first item
  const isExpanded = (key) => localExpanded[key] === true || (localExpanded[key] === undefined && (key === 'current' || key === 'daily-no-monthly' || key === 'daily-history'));

  return (
    <>
      <div className="header">
        <h1>📜 历史记录</h1>
        <button className="header-btn" onClick={() => setCurrentPage('home')}>🏠</button>
      </div>
      <div className="date-display">{month}月</div>
      
      <div className="section">
        {/* 当前记录 - 默认展开 */}
        <div className={`expander ${isExpanded('current') ? 'open' : ''}`}>
          <div className="expander-header" onClick={() => toggleExpand('current')}>
            <span>📝 当前记录</span>
            <span style={{ fontSize: 12, color: '#666' }}>{currentRounds.length}局</span>
          </div>
          {Object.keys(playerTotals).length > 0 && (
            <div style={{ padding: '8px 12px', background: '#e3f2fd', fontSize: 13, borderBottom: '1px solid #ddd' }}>
              {Object.entries(playerTotals).map(([name, score]) => (
                <span key={name} style={{ marginRight: 12, color: score > 0 ? '#2e7d32' : score < 0 ? '#d32f2f' : '#666' }}>
                  {name}: {score > 0 ? '+' + score : score}
                </span>
              ))}
            </div>
          )}
          <div className="expander-content">
            {currentRounds.length === 0 ? (
              <div className="empty-state" style={{ padding: '10px 0' }}>暂无记录</div>
            ) : (
              currentRounds.map(round => {
                const roundScores = currentRecordsGrouped[round];
                
                return (
                  <div key={round} style={{ background: '#f9f9f9', marginBottom: 8, padding: 8, borderRadius: 8 }}>
                    <div style={{ fontWeight: 'bold', fontSize: 13, color: '#666', marginBottom: 4 }}>
                      第{round}局
                    </div>
                    <div className="history-scores">
                      {roundScores.map((r, i) => (
                        <span
                          key={i}
                          className={`history-score ${r.score > 0 ? 'positive' : r.score < 0 ? 'negative' : ''}`}
                        >
                          {r.name} {r.score > 0 ? '+' + r.score : r.score}
                        </span>
                      ))}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* 未月结的日结 - 放在当前记录和月结中间 */}
        {dailyWithoutMonthly && dailyWithoutMonthly.length > 0 && (
          <div className={`expander ${isExpanded('daily-no-monthly') ? 'open' : ''}`} style={{ marginTop: 12 }}>
            <div className="expander-header" onClick={() => toggleExpand('daily-no-monthly')}>
              <span>📅 未月结</span>
              <span style={{ fontSize: 12, color: '#666' }}>{dailyWithoutMonthly.length}次</span>
            </div>
            <div className="expander-content">
              {dailyWithoutMonthly.map((d) => {
                const dayKey = `daily-nm-${d.settlement_key}`;
                const dayIsOpen = isExpanded(dayKey);
                
                return (
                  <div key={d.settlement_key} className={`expander ${dayIsOpen ? 'open' : ''}`} style={{ marginLeft: 12, marginTop: 8 }}>
                    <div className="expander-header" onClick={(e) => { e.stopPropagation(); toggleExpand(dayKey); }} style={{ background: '#e8f5e9' }}>
                      <span>📅 {d.date} ({d.settlement_key})</span>
                    </div>
                    {d.data && (
                      <div style={{ padding: '8px 12px', background: '#f9f9f9', fontSize: 13 }}>
                        {Object.entries(JSON.parse(d.data)).map(([name, score]) => (
                          <span key={name} style={{ marginRight: 12, color: score > 0 ? '#2e7d32' : score < 0 ? '#d32f2f' : '#666' }}>
                            {name}: {score > 0 ? '+' + score : score}
                          </span>
                        ))}
                      </div>
                    )}
                    <div className="expander-content">
                      {settlementRecords[d.settlement_key] && Object.keys(settlementRecords[d.settlement_key]).map(round => (
                        <div key={round} style={{ margin: '8px 0', marginLeft: 12 }}>
                          <div style={{ color: '#666', fontSize: 13 }}>第{round}局</div>
                          <div className="history-scores">
                            {settlementRecords[d.settlement_key][round].map((r, i) => (
                              <span
                                key={i}
                                className={`history-score ${r.score > 0 ? 'positive' : r.score < 0 ? 'negative' : ''}`}
                              >
                                {r.name} {r.score > 0 ? '+' + r.score : r.score}
                              </span>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* 月结历史 - 默认收起 */}
        {monthly && monthly.map((m, idx) => {
          const monthKey = `monthly-${m.settlement_key}`;
          const isOpen = isExpanded(monthKey);
          
          // 该月结包含的日结记录 - 只显示有月结关联的日结
          const monthDaily = (daily || []).filter(d => d.monthly_settlement_id === m.settlement_key);
          
          return (
            <div key={m.month} className={`expander ${isOpen ? 'open' : ''}`} style={{ marginTop: 12 }}>
              <div className="expander-header" onClick={() => toggleExpand(monthKey)}>
                <span>📆 {m.month}月结 ({m.settlement_key})</span>
                <span style={{ fontSize: 12, color: '#666' }}>{monthDaily.length}次</span>
              </div>
              {m.data && (
                <div style={{ padding: '8px 12px', background: '#fff3e0', fontSize: 13, borderBottom: '1px solid #ddd' }}>
                  {Object.entries(JSON.parse(m.data)).map(([name, score]) => (
                    <span key={name} style={{ marginRight: 12, color: score > 0 ? '#2e7d32' : score < 0 ? '#d32f2f' : '#666' }}>
                      {name}: {score > 0 ? '+' + score : score}
                    </span>
                  ))}
                </div>
              )}
              <div className="expander-content">
                {monthDaily.length === 0 ? (
                  <div className="empty-state">暂无日结记录</div>
                ) : (
                  monthDaily.map((d) => {
                    const dayKey = `daily-${d.settlement_key}`;
                    const dayIsOpen = isExpanded(dayKey);
                    const dayData = settlementRecords[d.settlement_key];
                    
                    return (
                      <div key={d.settlement_key} className={`expander ${dayIsOpen ? 'open' : ''}`} style={{ marginLeft: 12, marginTop: 8 }}>
                        <div className="expander-header" onClick={(e) => { e.stopPropagation(); toggleExpand(dayKey); }} style={{ background: '#e8f5e9' }}>
                          <span>📅 {d.date} ({d.settlement_key})</span>
                        </div>
                        {d.data && (
                          <div style={{ padding: '8px 12px', background: '#f9f9f9', fontSize: 13 }}>
                            {Object.entries(JSON.parse(d.data)).map(([name, score]) => (
                              <span key={name} style={{ marginRight: 12, color: score > 0 ? '#2e7d32' : score < 0 ? '#d32f2f' : '#666' }}>
                                {name}: {score > 0 ? '+' + score : score}
                              </span>
                            ))}
                          </div>
                        )}
                        <div className="expander-content">
                          {dayData && Object.keys(dayData).map(round => (
                            <div key={round} style={{ margin: '8px 0', marginLeft: 12 }}>
                              <div style={{ color: '#666', fontSize: 13 }}>第{round}局</div>
                              <div className="history-scores">
                                {dayData[round].map((r, i) => (
                                  <span
                                    key={i}
                                    className={`history-score ${r.score > 0 ? 'positive' : r.score < 0 ? 'negative' : ''}`}
                                  >
                                    {r.name} {r.score > 0 ? '+' + r.score : r.score}
                                  </span>
                                ))}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          );
        })}

        {/* 如果没有月结但有日结，显示日结历史 */}
        {(!monthly || monthly.length === 0) && daily && daily.length > 0 && (
          <div className={`expander ${isExpanded('daily-history') ? 'open' : ''}`} style={{ marginTop: 12 }}>
            <div className="expander-header" onClick={() => toggleExpand('daily-history')}>
              <span>📅 日结历史</span>
              <span style={{ fontSize: 12, color: '#666' }}>{daily.length}次</span>
            </div>
            <div className="expander-content">
              {daily.map((d) => {
                const dayKey = `daily-${d.settlement_key}`;
                const dayIsOpen = isExpanded(dayKey);
                const dayData = settlementRecords[d.settlement_key];
                
                return (
                  <div key={d.settlement_key} className={`expander ${dayIsOpen ? 'open' : ''}`} style={{ marginLeft: 12, marginTop: 8 }}>
                    <div className="expander-header" onClick={(e) => { e.stopPropagation(); toggleExpand(dayKey); }} style={{ background: '#e8f5e9' }}>
                      <span>📅 {d.date} ({d.settlement_key})</span>
                    </div>
                    {d.data && (
                      <div style={{ padding: '8px 12px', background: '#f9f9f9', fontSize: 13 }}>
                        {Object.entries(JSON.parse(d.data)).map(([name, score]) => (
                          <span key={name} style={{ marginRight: 12, color: score > 0 ? '#2e7d32' : score < 0 ? '#d32f2f' : '#666' }}>
                            {name}: {score > 0 ? '+' + score : score}
                          </span>
                        ))}
                      </div>
                    )}
                    <div className="expander-content">
                      {dayData && Object.keys(dayData).map(round => (
                        <div key={round} style={{ margin: '8px 0', marginLeft: 12 }}>
                          <div style={{ color: '#666', fontSize: 13 }}>第{round}局</div>
                          <div className="history-scores">
                            {dayData[round].map((r, i) => (
                              <span
                                key={i}
                                className={`history-score ${r.score > 0 ? 'positive' : r.score < 0 ? 'negative' : ''}`}
                              >
                                {r.name} {r.score > 0 ? '+' + r.score : r.score}
                              </span>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {(!monthly || monthly.length === 0) && currentRounds.length === 0 && (
          <div className="empty-state" style={{ padding: '10px 0' }}>暂无记录</div>
        )}
      </div>
    </>
  );
}
