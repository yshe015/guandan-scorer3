const API = '';

function addTimestamp(url) {
  const separator = url.includes('?') ? '&' : '?';
  return `${url}${separator}_t=${Date.now()}`;
}

async function apiFetch(url, options = {}) {
  const token = localStorage.getItem('pin_token');
  const headers = { ...options.headers };
  if (token) headers['x-auth-token'] = token;
  const res = await fetch(url, { ...options, headers });
  if (res.status === 401) {
    localStorage.removeItem('pin_token');
    window.dispatchEvent(new CustomEvent('auth:expired'));
    throw new Error('认证已过期，请重新输入PIN');
  }
  return res;
}

export async function auth(pin) {
  const res = await fetch(`${API}/api/auth`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ pin })
  });
  if (!res.ok) {
    const error = await res.json().catch(() => ({ error: 'PIN 错误' }));
    throw new Error(error.error || 'PIN 错误');
  }
  return res.json();
}

export async function checkAuth() {
  const token = localStorage.getItem('pin_token');
  if (!token) return { valid: false };
  const res = await apiFetch(`${API}/api/check-auth`, { method: 'POST' });
  return res.json();
}

export async function getPlayers() {
  const res = await apiFetch(`${API}/api/players`);
  return res.json();
}

export async function addPlayer(name) {
  const res = await apiFetch(`${API}/api/players`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name })
  });
  if (!res.ok) {
    const error = await res.json().catch(() => ({ error: 'Error' }));
    throw new Error(error.error || 'API error');
  }
  return res.json();
}

export async function deletePlayer(id) {
  const res = await apiFetch(`${API}/api/players/${id}`, { method: 'DELETE' });
  return res.json();
}

export async function updatePlayer(id, name) {
  const res = await apiFetch(`${API}/api/players/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name })
  });
  if (!res.ok) {
    const error = await res.json().catch(() => ({ error: 'Error' }));
    throw new Error(error.error || 'API error');
  }
  return res.json();
}

export async function getScores(date, month) {
  const res = await apiFetch(addTimestamp(`${API}/api/scores?date=${date}&month=${month}`));
  return res.json();
}

export async function getRecords(date) {
  const res = await apiFetch(addTimestamp(`${API}/api/records?date=${date}`));
  return res.json();
}

export async function getCurrentGame() {
  const res = await apiFetch(addTimestamp(`${API}/api/current-game`));
  return res.json();
}

export async function saveCurrentGame(data) {
  const res = await apiFetch(`${API}/api/current-game`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });
  return res.json();
}

export async function submitScore(data) {
  const res = await apiFetch(`${API}/api/current-game/submit`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });
  if (!res.ok) {
    const error = await res.json().catch(() => ({ error: 'Error' }));
    throw new Error(error.error || 'API error');
  }
  return res.json();
}

export async function getDailySettlement(date) {
  const res = await apiFetch(`${API}/api/daily-settlement?date=${date}`);
  return res.json();
}

export async function confirmDailySettlement(data) {
  const res = await apiFetch(`${API}/api/daily-settlement`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });
  if (!res.ok) {
    const error = await res.json().catch(() => ({ error: 'Error' }));
    throw new Error(error.error || 'API error');
  }
  return res.json();
}

export async function getMonthlySettlement(month) {
  const res = await apiFetch(`${API}/api/monthly-settlement?month=${month}`);
  return res.json();
}

export async function confirmMonthlySettlement(data) {
  const res = await apiFetch(`${API}/api/monthly-settlement`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });
  if (!res.ok) {
    const error = await res.json().catch(() => ({ error: 'Error' }));
    throw new Error(error.error || 'API error');
  }
  return res.json();
}

export async function getHistory() {
  const res = await apiFetch(`${API}/api/history`);
  return res.json();
}

export async function getDailyRecords(month) {
  const res = await apiFetch(`${API}/api/daily-records?month=${month}`);
  return res.json();
}

export async function getCheckDailySettled(date) {
  const res = await apiFetch(`${API}/api/check-daily-settled?date=${date}`);
  return res.json();
}

export async function getDailySettlementRecords(settlementKey) {
  const res = await apiFetch(addTimestamp(`${API}/api/daily-settlement/${settlementKey}/records`));
  return res.json();
}

export async function resetData(password) {
  const res = await apiFetch(`${API}/api/reset`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password })
  });
  return res.json();
}
