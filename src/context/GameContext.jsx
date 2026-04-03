import React, { createContext, useContext, useState, useEffect, useRef } from 'react';

const GameContext = createContext();

export function useGame() {
  return useContext(GameContext);
}

function getToday() {
  const now = new Date();
  const offset = now.getTimezoneOffset() * 60000;
  const localDate = new Date(now.getTime() - offset);
  return localDate.toISOString().split('T')[0];
}

function getMonth() {
  const now = new Date();
  const offset = now.getTimezoneOffset() * 60000;
  const localDate = new Date(now.getTime() - offset);
  return localDate.toISOString().slice(0, 7);
}

export function GameProvider({ children }) {
  const [players, setPlayers] = useState([]);
  const [todayScores, setTodayScores] = useState([]);
  const [monthScores, setMonthScores] = useState([]);
  const [selectedPlayers, setSelectedPlayers] = useState([]);
  const [currentRound, setCurrentRound] = useState(1);
  const [date, setDate] = useState(getToday());
  const [month, setMonth] = useState(getMonth());
  const [currentPage, setCurrentPage] = useState('home');
  const [historyData, setHistoryData] = useState({});
  const [dailyRecords, setDailyRecords] = useState({});
  const [dailySettled, setDailySettled] = useState(false);
  const [hasGame, setHasGame] = useState(false);
  const [hasUnsettled, setHasUnsettled] = useState(false);
  const [dailySettlementCount, setDailySettlementCount] = useState(0);
  const [currentGame, setCurrentGame] = useState({
    round: 1,
    selected_players: [],
    scores: {},
    submitted: false
  });
  const [expandedItems, setExpandedItems] = useState({});
  const [loading, setLoading] = useState(true);
  
  const pollingRef = useRef(null);
  const isPollingRef = useRef(false);

  const loadData = async () => {
    try {
      const [playersRes, scoresRes, historyRes, checkSettled, dailyRecordsRes, currentGameRes] = await Promise.all([
        import('../api').then(m => m.getPlayers()),
        import('../api').then(m => m.getScores(date, month)),
        import('../api').then(m => m.getHistory()),
        import('../api').then(m => m.getCheckDailySettled(date)),
        import('../api').then(m => m.getDailyRecords(month)),
        import('../api').then(m => m.getCurrentGame())
      ]);
      
      setPlayers(playersRes);
      setTodayScores(scoresRes.todayScores || []);
      setMonthScores(scoresRes.monthScores || []);
      setCurrentRound(scoresRes.currentRound || 1);
      setDate(scoresRes.date);
      setMonth(scoresRes.month);
      setHistoryData(historyRes);
      setDailyRecords(dailyRecordsRes.grouped || {});
      setDailySettled(checkSettled.settled);
      setHasGame(scoresRes.hasGame || false);
      setHasUnsettled(scoresRes.hasUnsettled || false);
      setDailySettlementCount(scoresRes.dailySettlementCount || 0);
      
      // Sync selectedPlayers from scoresRes.gamePlayers when there's an active game
      if (scoresRes.hasGame && scoresRes.gamePlayers && scoresRes.gamePlayers.length > 0) {
        setSelectedPlayers(scoresRes.gamePlayers);
      } else if (!scoresRes.hasGame) {
        setSelectedPlayers([]);
      }
      
      // Update currentGame with selected_players
      setCurrentGame(prev => ({
        ...prev,
        selected_players: scoresRes.gamePlayers || [],
        round: scoresRes.currentRound || prev.round
      }));
      
      setLoading(false);
    } catch (e) {
      console.error(e);
      setLoading(false);
    }
  };

  const loadCurrentGame = async () => {
    try {
      const [game, scoresRes] = await Promise.all([
        import('../api').then(m => m.getCurrentGame()),
        import('../api').then(m => m.getScores(date, month))
      ]);
      
      // Update scores
      setTodayScores(scoresRes.todayScores || []);
      setCurrentRound(scoresRes.currentRound || 1);
      setHasGame(scoresRes.hasGame || false);
      setHasUnsettled(scoresRes.hasUnsettled || false);
      
      // Update currentGame with selected_players from API
      const apiPlayers = scoresRes.gamePlayers || [];
      setCurrentGame(prev => ({
        ...prev,
        selected_players: apiPlayers,
        round: scoresRes.currentRound || prev.round
      }));
      
      // Sync selectedPlayers when there's an active game (no date restriction)
      if (scoresRes.hasGame && scoresRes.gamePlayers && scoresRes.gamePlayers.length > 0) {
        setSelectedPlayers(scoresRes.gamePlayers);
      } else if (!scoresRes.hasGame) {
        setSelectedPlayers([]);
      }
    } catch (e) {
      console.error('Polling error:', e);
    }
  };

  const startPolling = () => {
    if (isPollingRef.current) return;
    isPollingRef.current = true;
    console.log('[Polling] Starting polling...');
    
    pollingRef.current = setInterval(() => {
      console.log('[Polling] Fetching current game...');
      loadCurrentGame();
    }, 3000);
  };

  const stopPolling = () => {
    console.log('[Polling] Stopping polling...');
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }
    isPollingRef.current = false;
  };

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    return () => {
      stopPolling();
    };
  }, []);

  const value = {
    players,
    setPlayers,
    todayScores,
    setTodayScores,
    monthScores,
    setMonthScores,
    selectedPlayers,
    setSelectedPlayers,
    currentRound,
    setCurrentRound,
    date,
    setDate,
    month,
    setMonth,
    currentPage,
    setCurrentPage,
    historyData,
    setHistoryData,
    dailyRecords,
    setDailyRecords,
    dailySettled,
    setDailySettled,
    hasGame,
    setHasGame,
    hasUnsettled,
    setHasUnsettled,
    dailySettlementCount,
    setDailySettlementCount,
    currentGame,
    setCurrentGame,
    expandedItems,
    setExpandedItems,
    loadData,
    loading,
    startPolling,
    stopPolling
  };

  return (
    <GameContext.Provider value={value}>
      {children}
    </GameContext.Provider>
  );
}
