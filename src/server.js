import express from 'express';
import cors from 'cors';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import { initDb, getDb, saveDb, markDirty, flushDb, startCheckpointTimer, closeDb } from './database.js';
import { getConfig } from './config.js';
import logger from './logger.js';

const tokens = new Set();
let tokenExpireTimer = null;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.APIPORT || process.env.PORT || 3000;

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

function findUnsettledRecord(date, round, playerId) {
  return queryOne(
    `SELECT id, score FROM score_records
     WHERE date = ? AND round = ? AND player_id = ? AND daily_settlement_id IS NULL`,
    [date, round, playerId]
  );
}

function run(sql, params = []) {
  const db = getDb();
  db.run(sql, params);
  markDirty();
  return { lastInsertRowid: db.exec('SELECT last_insert_rowid()')[0]?.values[0]?.[0] };
}

app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-auth-token']
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

// Auth middleware - skip auth and config endpoints
app.use('/api', (req, res, next) => {
  const publicPaths = ['/config', '/auth', '/check-auth'];
  if (publicPaths.includes(req.path)) return next();

  const token = req.headers['x-auth-token'];
  if (!token || !tokens.has(token)) {
    return res.status(401).json({ error: '认证已过期，请重新输入PIN' });
  }
  next();
});

// Config API
app.get('/api/config', (req, res) => {
  try {
    const config = getConfig();
    res.json({
      admin: config.admin,
      pinLength: config.pin?.length || 0,
      tokenExpireMinutes: config.tokenExpireMinutes ?? 0,
      pollInterval: config.pollInterval,
      logLevel: config.logLevel
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Auth API
app.post('/api/auth', (req, res) => {
  const { pin } = req.body;
  const config = getConfig();
  if (!config.pin) {
    return res.status(500).json({ error: 'PIN not configured' });
  }
  if (pin !== config.pin) {
    return res.status(401).json({ error: 'PIN 错误' });
  }
  const token = crypto.randomBytes(32).toString('hex');
  tokens.add(token);
  res.json({ token, pinLength: config.pin.length });
});

app.post('/api/check-auth', (req, res) => {
  const token = req.headers['x-auth-token'];
  if (token && tokens.has(token)) {
    return res.json({ valid: true });
  }
  res.json({ valid: false });
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
      LEFT JOIN score_records sr ON p.id = sr.player_id AND sr.daily_settlement_id IS NULL AND sr.monthly_settlement_id IS NULL
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
    
    const hasUnsettled = queryOne('SELECT COUNT(*) as count FROM score_records WHERE daily_settlement_id IS NULL AND monthly_settlement_id IS NULL')?.count > 0;
    
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
  
  if (!records || !Array.isArray(records) || records.length === 0) {
    return res.status(400).json({ error: '没有记分记录' });
  }

  if (records.length !== 4) {
    return res.status(400).json({ error: '仅限4位玩家记分' });
  }

  for (const r of records) {
    if (r.player_id == null || typeof r.score !== 'number' || !Number.isFinite(r.score)) {
      return res.status(400).json({ error: '记分数据格式错误' });
    }
  }

  const seen = new Set();
  for (const r of records) {
    if (seen.has(r.player_id)) {
      return res.status(400).json({ error: `记分包含重复玩家 player_id=${r.player_id},必须是 4 位不同玩家` });
    }
    seen.add(r.player_id);
  }

  const sortedScores = records.map(r => r.score).sort((a, b) => b - a);
  const validCombos = [[3, 3, -3, -3], [2, 2, -2, -2], [1, 1, -1, -1]];
  const isValidCombo = validCombos.some(c => JSON.stringify(c) === JSON.stringify(sortedScores));
  if (!isValidCombo) {
    return res.status(400).json({ error: `记分组合无效:${JSON.stringify(sortedScores)},必须是 [+3,+3,-3,-3] / [+2,+2,-2,-2] / [+1,+1,-1,-1]` });
  }

  try {
    let inserted = 0;
    let skipped = 0;
    for (const r of records) {
      const existing = findUnsettledRecord(date, round, r.player_id);
      if (existing) {
        skipped++;
        logger.warn({
          date, round, player_id: r.player_id,
          existing_id: existing.id, existing_score: existing.score,
          attempted_score: r.score
        }, 'Duplicate record skipped (unsettled record exists)');
        continue;
      }
      run('INSERT INTO score_records (date, month, round, player_id, score) VALUES (?, ?, ?, ?, ?)', 
        [date, month, round, r.player_id, r.score]);
      inserted++;
    }
    res.json({ success: true, inserted, skipped });
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
    const existing = queryOne('SELECT id FROM current_game WHERE id = 1');
    if (existing) {
      run('UPDATE current_game SET date = ?, selected_players = ?, scores = ? WHERE id = 1',
        [date, JSON.stringify(selected_players), JSON.stringify(scores)]);
    } else {
      run('INSERT INTO current_game (id, date, round, selected_players, scores, submitted) VALUES (1, ?, ?, ?, ?, 0)',
        [date, round, JSON.stringify(selected_players), JSON.stringify(scores)]);
    }
    res.json({ success: true });
  } catch (e) {
    const clientIP = req.ip || req.headers['x-forwarded-for'] || 'unknown';
    logger.error({ url: req.url, error: e.message, clientIP: clientIP }, 'API Error');
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/current-game/submit', (req, res) => {
  const { date, month, records } = req.body;

  // 1. Basic shape validation
  if (!records || !Array.isArray(records) || records.length === 0) {
    return res.status(400).json({ error: '没有记分记录' });
  }

  // 2. Must be exactly 4 player scores
  if (records.length !== 4) {
    return res.status(400).json({ error: '仅限4位玩家记分' });
  }

  // 3. Each record must have a valid player_id and numeric score
  for (const r of records) {
    if (r.player_id == null || typeof r.score !== 'number' || !Number.isFinite(r.score)) {
      return res.status(400).json({ error: '记分数据格式错误' });
    }
  }

  // 4. Deduplicate by player_id; reject if duplicates in input (must be 4 unique players)
  const dedupedMap = new Map();
  for (const r of records) {
    if (dedupedMap.has(r.player_id)) {
      return res.status(400).json({ error: `记分包含重复玩家 player_id=${r.player_id},必须是 4 位不同玩家` });
    }
    dedupedMap.set(r.player_id, r.score);
  }
  const dedupedRecords = Array.from(dedupedMap.entries()).map(([player_id, score]) => ({ player_id, score }));

  // 5. Validate score combo: only [3,3,-3,-3] | [2,2,-2,-2] | [1,1,-1,-1]
  const sortedScores = dedupedRecords.map(r => r.score).sort((a, b) => b - a);
  const validCombos = [[3, 3, -3, -3], [2, 2, -2, -2], [1, 1, -1, -1]];
  const isValidCombo = validCombos.some(c => JSON.stringify(c) === JSON.stringify(sortedScores));
  if (!isValidCombo) {
    return res.status(400).json({ error: `记分组合无效:${JSON.stringify(sortedScores)},必须是 [+3,+3,-3,-3] / [+2,+2,-2,-2] / [+1,+1,-1,-1]` });
  }

  // 6. Sum must be 0 (defense-in-depth; valid combos already sum to 0)
  const total = sortedScores.reduce((a, b) => a + b, 0);
  if (total !== 0) {
    return res.status(400).json({ error: `记分总和必须为 0,收到 ${total}` });
  }

  // 7. All player_ids must exist in players table
  for (const r of dedupedRecords) {
    const player = queryOne('SELECT id FROM players WHERE id = ?', [r.player_id]);
    if (!player) {
      return res.status(400).json({ error: `玩家 id=${r.player_id} 不存在` });
    }
  }

  try {
    // 8. Read current round from DB (authoritative source)
    const game = queryOne('SELECT round FROM current_game WHERE id = 1');
    const currentRound = game ? game.round : 1;

    // 9. Per-record dedup check on (date, round, player_id, daily_settlement_id IS NULL)
    for (const r of dedupedRecords) {
      const existing = findUnsettledRecord(date, currentRound, r.player_id);
      if (existing) {
        return res.status(400).json({
          error: `本局 (${date} 第${currentRound}局) 玩家 ${r.player_id} 已经记分 (id=${existing.id}, score=${existing.score}),不能重复提交`
        });
      }
    }

    for (const r of dedupedRecords) {
      run('INSERT INTO score_records (date, month, round, player_id, score) VALUES (?, ?, ?, ?, ?)',
        [date, month, currentRound, r.player_id, r.score]);
    }

    const nextRound = currentRound + 1;
    run(`UPDATE current_game SET round = ?, scores = '{}', submitted = 0, submitted_at = datetime('now') WHERE id = 1`, [nextRound]);

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

    flushDb();

    try {
      getDb().run('VACUUM');
      flushDb();
      logger.info({ month, settlementKey }, 'Monthly settlement + VACUUM completed');
    } catch (vacErr) {
      logger.warn({ error: vacErr.message, month }, 'VACUUM failed (non-fatal)');
    }

    const expireMin = getConfig().tokenExpireMinutes ?? 0;
    if (expireMin > 0) {
      if (tokenExpireTimer) clearTimeout(tokenExpireTimer);
      tokenExpireTimer = setTimeout(() => {
        tokens.clear();
        tokenExpireTimer = null;
        logger.info('Tokens cleared after monthly settlement expiry');
      }, expireMin * 60 * 1000);
    } else if (expireMin === 0) {
      tokens.clear();
    }

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
      WHERE sr.daily_settlement_id IS NULL AND sr.monthly_settlement_id IS NULL
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
      WHERE sr.month = ? AND sr.monthly_settlement_id IS NULL
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
  const config = getConfig();
  
  if (!config.resetPassword || password !== config.resetPassword) {
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

// SPA fallback: serve index.html for all unmatched GET routes
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'dist', 'index.html'));
});

// 404 handler (must be after SPA fallback)
app.use((req, res) => {
  const clientIP = req.ip || req.headers['x-forwarded-for'] || 'unknown';
  logger.warn({ url: req.url, clientIP: clientIP }, '404 Not Found');
  res.status(404).json({ error: 'Not found' });
});

async function startServer() {
  try {
    await initDb();
    logger.info('Database initialized');
    startCheckpointTimer();

    app.listen(PORT, '0.0.0.0', () => {
      logger.info(`Server running on port ${PORT}`);
    });
  } catch (e) {
    logger.error('Failed to start server:', e);
    process.exit(1);
  }
}

process.on('SIGINT', () => {
  flushDb();
  closeDb();
  process.exit();
});

process.on('SIGTERM', () => {
  flushDb();
  closeDb();
  process.exit();
});

process.on('beforeExit', () => {
  flushDb();
});

startServer();
