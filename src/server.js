import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { initDb, getDb, saveDb, closeDb } from './database.js';
import { getConfig } from './config.js';
import logger from './logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

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

function queryAll(sql, params = []) {
  const db = getDb();
  const result = db.exec(sql, params);
  if (result.length === 0) return [];
  const columns = result[0].columns;
  return result[0].values.map(row => {
    const obj = {};
    columns.forEach((col, i) => obj[col] = row[i]);
    return obj;
  });
}

function queryOne(sql, params = []) {
  const results = queryAll(sql, params);
  return results.length > 0 ? results[0] : null;
}

function run(sql, params = []) {
  const db = getDb();
  db.run(sql, params);
  saveDb();
  return { lastInsertRowid: db.exec('SELECT last_insert_rowid()')[0]?.values[0]?.[0] };
}

app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json());

// Request logging with response time and client IP
app.use((req, res, next) => {
  const start = Date.now();
  
  res.on('finish', () => {
    const duration = Date.now() - start;
    const clientIP = req.ip || req.headers['x-forwarded-for'] || 'unknown';
    logger.debug({
      method: req.method,
      url: req.url,
      status: res.statusCode,
      duration: `${duration}ms`,
      clientIP: clientIP
    }, 'HTTP Request');
  });
  
  next();
});

// Disable cache for API
app.use('/api', (req, res, next) => {
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  next();
});

// Config API
app.get('/api/config', (req, res) => {
  try {
    const config = getConfig();
    res.json({
      admin: config.admin,
      pollInterval: config.pollInterval,
      logLevel: config.logLevel
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Players API
app.get('/api/players', (req, res) => {
  try {
    const players = queryAll('SELECT * FROM players ORDER BY name');
    res.json(players);
  } catch (e) {
    const clientIP = req.ip || req.headers['x-forwarded-for'] || 'unknown';
    logger.error({ url: req.url, error: e.message, clientIP: clientIP }, 'API Error');
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/players', (req, res) => {
  const { name } = req.body;
  if (!name || !name.trim()) {
    return res.status(400).json({ error: '玩家名称不能为空' });
  }
  try {
    const result = run('INSERT INTO players (name) VALUES (?)', [name.trim()]);
    res.json({ id: result.lastInsertRowid, name: name.trim() });
  } catch (e) {
    const clientIP = req.ip || req.headers['x-forwarded-for'] || 'unknown';
    logger.error({ url: req.url, error: e.message, clientIP: clientIP }, 'API Error');
    res.status(500).json({ error: e.message });
  }
});

// Get daily settlement records by settlement_key
app.get('/api/daily-settlement/:settlementKey/records', (req, res) => {
  const { settlementKey } = req.params;
  
  try {
    const records = queryAll(`
      SELECT sr.round, p.name, sr.score
      FROM score_records sr
      JOIN players p ON sr.player_id = p.id
      WHERE sr.daily_settlement_id = ?
      ORDER BY sr.round DESC
    `, [settlementKey]);
    
    const grouped = {};
    records.forEach(r => {
      if (!grouped[r.round]) {
        grouped[r.round] = [];
      }
      grouped[r.round].push({ name: r.name, score: r.score });
    });
    
    res.json({ grouped });
  } catch (e) {
    const clientIP = req.ip || req.headers['x-forwarded-for'] || 'unknown';
    logger.error({ url: req.url, error: e.message, clientIP: clientIP }, 'API Error');
    res.status(500).json({ error: e.message });
  }
});

app.delete('/api/players/:id', (req, res) => {
  try {
    run('DELETE FROM score_records WHERE player_id = ?', [req.params.id]);
    run('DELETE FROM players WHERE id = ?', [req.params.id]);
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.put('/api/players/:id', (req, res) => {
  const { name } = req.body;
  if (!name || !name.trim()) {
    return res.status(400).json({ error: '玩家名称不能为空' });
  }
  try {
    run('UPDATE players SET name = ? WHERE id = ?', [name.trim(), req.params.id]);
    res.json({ id: parseInt(req.params.id), name: name.trim() });
  } catch (e) {
    const clientIP = req.ip || req.headers['x-forwarded-for'] || 'unknown';
    logger.error({ url: req.url, error: e.message, clientIP: clientIP }, 'API Error');
    res.status(400).json({ error: '玩家名称已存在' });
  }
});

// Scores API
app.get('/api/scores', (req, res) => {
  const date = getToday();
  const month = getMonth();
  
  try {
    // Today's scores: include all unsettled records (not just today)
    const todayScores = queryAll(`
      SELECT p.id, p.name, COALESCE(SUM(sr.score), 0) as today_score
      FROM players p
      LEFT JOIN score_records sr ON p.id = sr.player_id AND sr.daily_settlement_id IS NULL
      GROUP BY p.id
    `);
    
    const monthScores = queryAll(`
      SELECT p.id, p.name, COALESCE(SUM(sr.score), 0) as month_score
      FROM players p
      LEFT JOIN score_records sr ON p.id = sr.player_id AND sr.monthly_settlement_id IS NULL
      GROUP BY p.id
    `);
    
    const gameResult = queryOne('SELECT * FROM current_game WHERE id = 1');
    
    // 有 current_game 记录就认为游戏在进行
    const hasGame = !!gameResult;
    const gamePlayers = gameResult ? JSON.parse(gameResult.selected_players || '[]') : [];
    const currentRound = gameResult ? gameResult.round : 1;
    
    const hasUnsettled = queryOne('SELECT COUNT(*) as count FROM score_records WHERE daily_settlement_id IS NULL')?.count > 0;
    
    const dailySettlementCount = queryOne('SELECT COUNT(*) as count FROM daily_settlement WHERE date = ?', [date]);
    
    res.json({ 
      todayScores, 
      monthScores, 
      currentRound,
      date,
      month,
      hasGame,
      gamePlayers,
      hasUnsettled,
      dailySettlementCount: dailySettlementCount?.count || 0
    });
  } catch (e) {
    const clientIP = req.ip || req.headers['x-forwarded-for'] || 'unknown';
    logger.error({ url: req.url, error: e.message, clientIP: clientIP }, 'API Error');
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/records', (req, res) => {
  const { date, month, round, records } = req.body;
  
  if (!records || records.length === 0) {
    return res.status(400).json({ error: '没有记分记录' });
  }

  try {
    for (const r of records) {
      run('INSERT INTO score_records (date, month, round, player_id, score) VALUES (?, ?, ?, ?, ?)', 
        [date, month, round, r.player_id, r.score]);
    }
    res.json({ success: true });
  } catch (e) {
    const clientIP = req.ip || req.headers['x-forwarded-for'] || 'unknown';
    logger.error({ url: req.url, error: e.message, clientIP: clientIP }, 'API Error');
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/records', (req, res) => {
  const targetDate = req.query.date || getToday();
  
  try {
    const records = queryAll(`
      SELECT sr.*, p.name 
      FROM score_records sr
      JOIN players p ON sr.player_id = p.id
      WHERE sr.date = ?
      ORDER BY sr.round DESC
    `, [targetDate]);
    
    const grouped = {};
    records.forEach(r => {
      if (!grouped[r.round]) {
        grouped[r.round] = [];
      }
      grouped[r.round].push(r);
    });
    
    res.json({ records, grouped });
  } catch (e) {
    const clientIP = req.ip || req.headers['x-forwarded-for'] || 'unknown';
    logger.error({ url: req.url, error: e.message, clientIP: clientIP }, 'API Error');
    res.status(500).json({ error: e.message });
  }
});

// Current Game API
app.get('/api/current-game', (req, res) => {
  const date = getToday();
  
  try {
    const game = queryOne('SELECT * FROM current_game WHERE id = 1');
    
    if (game) {
      res.json({
        ...game,
        selected_players: JSON.parse(game.selected_players || '[]'),
        scores: JSON.parse(game.scores || '{}'),
        submitted: game.submitted === 1
      });
    } else {
      res.json(null);
    }
  } catch (e) {
    const clientIP = req.ip || req.headers['x-forwarded-for'] || 'unknown';
    logger.error({ url: req.url, error: e.message, clientIP: clientIP }, 'API Error');
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/current-game', (req, res) => {
  const { date, round, selected_players, scores } = req.body;
  
  try {
    run(`
      INSERT OR REPLACE INTO current_game (id, date, round, selected_players, scores, submitted)
      VALUES (1, ?, ?, ?, ?, 0)
    `, [date, round, JSON.stringify(selected_players), JSON.stringify(scores)]);
    res.json({ success: true });
  } catch (e) {
    const clientIP = req.ip || req.headers['x-forwarded-for'] || 'unknown';
    logger.error({ url: req.url, error: e.message, clientIP: clientIP }, 'API Error');
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/current-game/submit', (req, res) => {
  const { date, month, round, records } = req.body;
  
  try {
    for (const r of records) {
      run('INSERT INTO score_records (date, month, round, player_id, score) VALUES (?, ?, ?, ?, ?)', 
        [date, month, round, r.player_id, r.score]);
    }
    
    const nextRound = round + 1;
    run('UPDATE current_game SET round = ?, scores = \'{}\', submitted = 0, submitted_at = datetime(\'now\') WHERE id = 1', [nextRound]);
    
    res.json({ success: true });
  } catch (e) {
    const clientIP = req.ip || req.headers['x-forwarded-for'] || 'unknown';
    logger.error({ url: req.url, error: e.message, clientIP: clientIP }, 'API Error');
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/current-game/reset', (req, res) => {
  try {
    run('DELETE FROM current_game WHERE id = 1');
    res.json({ success: true });
  } catch (e) {
    const clientIP = req.ip || req.headers['x-forwarded-for'] || 'unknown';
    logger.error({ url: req.url, error: e.message, clientIP: clientIP }, 'API Error');
    res.status(500).json({ error: e.message });
  }
});

// Daily Settlement API
app.get('/api/daily-settlement', (req, res) => {
  const targetDate = req.query.date || getToday();
  
  try {
    const result = queryOne('SELECT * FROM daily_settlement WHERE date = ?', [targetDate]);
    res.json(result || null);
  } catch (e) {
    const clientIP = req.ip || req.headers['x-forwarded-for'] || 'unknown';
    logger.error({ url: req.url, error: e.message, clientIP: clientIP }, 'API Error');
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/daily-settlement', (req, res) => {
  const { date, month, data } = req.body;
  
  try {
    const countResult = queryOne('SELECT COUNT(*) as count FROM daily_settlement WHERE date = ?', [date]);
    const count = (countResult?.count || 0) + 1;
    const settlementKey = `${date.replace(/-/g, '')}RJ${count}`;
    
    run('INSERT INTO daily_settlement (date, month, data, settlement_key) VALUES (?, ?, ?, ?)', 
      [date, month, JSON.stringify(data), settlementKey]);
    
    run('UPDATE score_records SET daily_settlement_id = ? WHERE daily_settlement_id IS NULL AND monthly_settlement_id IS NULL', 
      [settlementKey]);
    
    run('DELETE FROM current_game WHERE id = 1');
    
    res.json({ success: true });
  } catch (e) {
    const clientIP = req.ip || req.headers['x-forwarded-for'] || 'unknown';
    logger.error({ url: req.url, error: e.message, clientIP: clientIP }, 'API Error');
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/check-daily-settled', (req, res) => {
  const targetDate = req.query.date || getToday();
  
  try {
    const result = queryOne('SELECT * FROM daily_settlement WHERE date = ?', [targetDate]);
    res.json({ settled: !!result });
  } catch (e) {
    const clientIP = req.ip || req.headers['x-forwarded-for'] || 'unknown';
    logger.error({ url: req.url, error: e.message, clientIP: clientIP }, 'API Error');
    res.status(500).json({ error: e.message });
  }
});

// Monthly Settlement API
app.get('/api/monthly-settlement', (req, res) => {
  const targetMonth = req.query.month || getMonth();
  
  try {
    const result = queryOne('SELECT * FROM monthly_settlement WHERE month = ?', [targetMonth]);
    res.json(result || null);
  } catch (e) {
    const clientIP = req.ip || req.headers['x-forwarded-for'] || 'unknown';
    logger.error({ url: req.url, error: e.message, clientIP: clientIP }, 'API Error');
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/monthly-settlement', (req, res) => {
  const { month, data } = req.body;
  
  try {
    const countResult = queryOne('SELECT COUNT(*) as count FROM monthly_settlement WHERE month = ?', [month]);
    const count = (countResult?.count || 0) + 1;
    const settlementKey = `${month.replace(/-/g, '')}YJ${count}`;
    
    run('INSERT INTO monthly_settlement (month, data, settlement_key) VALUES (?, ?, ?)', 
      [month, JSON.stringify(data), settlementKey]);
    
    run('UPDATE score_records SET monthly_settlement_id = ? WHERE monthly_settlement_id IS NULL', 
      [settlementKey]);
    
    run('DELETE FROM current_game WHERE id = 1');
    
    res.json({ success: true });
  } catch (e) {
    const clientIP = req.ip || req.headers['x-forwarded-for'] || 'unknown';
    logger.error({ url: req.url, error: e.message, clientIP: clientIP }, 'API Error');
    res.status(500).json({ error: e.message });
  }
});

// History API
app.get('/api/history', (req, res) => {
  try {
    const monthly = queryAll('SELECT * FROM monthly_settlement ORDER BY settled_at DESC LIMIT 12');
    const daily = queryAll(`
      SELECT ds.*, 
        (SELECT DISTINCT monthly_settlement_id 
         FROM score_records 
         WHERE daily_settlement_id = ds.settlement_key) as monthly_settlement_id
      FROM daily_settlement ds 
      ORDER BY ds.settled_at DESC
    `);
    const currentRecords = queryAll(`
      SELECT sr.date, sr.round, p.name, sr.score
      FROM score_records sr
      JOIN players p ON sr.player_id = p.id
      WHERE sr.daily_settlement_id IS NULL
      ORDER BY sr.date DESC, sr.round DESC
    `);
    
    res.json({ monthly, daily, currentRecords });
  } catch (e) {
    const clientIP = req.ip || req.headers['x-forwarded-for'] || 'unknown';
    logger.error({ url: req.url, error: e.message, clientIP: clientIP }, 'API Error');
    res.status(500).json({ error: e.message });
  }
});

// Daily Records API
app.get('/api/daily-records', (req, res) => {
  const month = req.query.month || getMonth();
  
  try {
    const records = queryAll(`
      SELECT sr.date, sr.round, p.name, sr.score
      FROM score_records sr
      JOIN players p ON sr.player_id = p.id
      WHERE sr.month = ?
      ORDER BY sr.date DESC, sr.round DESC
    `, [month]);
    
    const grouped = {};
    records.forEach(r => {
      if (!grouped[r.date]) {
        grouped[r.date] = { rounds: {}, totals: {} };
      }
      if (!grouped[r.date].rounds[r.round]) {
        grouped[r.date].rounds[r.round] = [];
      }
      grouped[r.date].rounds[r.round].push({ name: r.name, score: r.score });
      grouped[r.date].totals[r.name] = (grouped[r.date].totals[r.name] || 0) + r.score;
    });
    
    res.json({ grouped });
  } catch (e) {
    const clientIP = req.ip || req.headers['x-forwarded-for'] || 'unknown';
    logger.error({ url: req.url, error: e.message, clientIP: clientIP }, 'API Error');
    res.status(500).json({ error: e.message });
  }
});

// Reset API
app.post('/api/reset', (req, res) => {
  const { password } = req.body;
  
  if (password !== '8dm1n') {
    return res.status(401).json({ error: '密码错误' });
  }
  
  try {
    run('DELETE FROM score_records');
    run('DELETE FROM daily_settlement');
    run('DELETE FROM monthly_settlement');
    run('DELETE FROM current_game');
    res.json({ success: true });
  } catch (e) {
    const clientIP = req.ip || req.headers['x-forwarded-for'] || 'unknown';
    logger.error({ url: req.url, error: e.message, clientIP: clientIP }, 'API Error');
    res.status(500).json({ error: e.message });
  }
});

// Serve static files in production
app.use(express.static(path.join(__dirname, '..', 'dist')));

// Global error handler
app.use((err, req, res, next) => {
  const clientIP = req.ip || req.headers['x-forwarded-for'] || 'unknown';
  logger.error({ url: req.url, error: err.message, stack: err.stack, clientIP: clientIP }, 'Unhandled Error');
  res.status(500).json({ error: 'Internal server error' });
});

// 404 handler
app.use((req, res) => {
  const clientIP = req.ip || req.headers['x-forwarded-for'] || 'unknown';
  logger.warn({ url: req.url, clientIP: clientIP }, '404 Not Found');
  res.status(404).json({ error: 'Not found' });
});

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'dist', 'index.html'));
});

async function startServer() {
  try {
    await initDb();
    logger.info('Database initialized');
    
    app.listen(PORT, '0.0.0.0', () => {
      logger.info(`Server running on port ${PORT}`);
    });
  } catch (e) {
    logger.error('Failed to start server:', e);
    process.exit(1);
  }
}

process.on('SIGINT', () => {
  closeDb();
  process.exit();
});

startServer();
