const API = '';

function addTimestamp(url) {
  const separator = url.includes('?') ? '&' : '?';
  return `${url}${separator}_t=${Date.now()}`;
}

export async function getPlayers() {
  const res = await fetch(`${API}/api/players`);
  return res.json();
}

export async function addPlayer(name) {
  const res = await fetch(`${API}/api/players`, {
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
  const res = await fetch(`${API}/api/players/${id}`, { method: 'DELETE' });
  return res.json();
}

export async function updatePlayer(id, name) {
  const res = await fetch(`${API}/api/players/${id}`, {
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
  const res = await fetch(addTimestamp(`${API}/api/scores?date=${date}&month=${month}`));
  return res.json();
}

export async function getRecords(date) {
  const res = await fetch(addTimestamp(`${API}/api/records?date=${date}`));
  return res.json();
}

export async function getCurrentGame() {
  const res = await fetch(addTimestamp(`${API}/api/current-game`));
  return res.json();
}

export async function saveCurrentGame(data) {
  const res = await fetch(`${API}/api/current-game`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });
  return res.json();
}

export async function submitScore(data) {
  const res = await fetch(`${API}/api/current-game/submit`, {
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
  const res = await fetch(`${API}/api/daily-settlement?date=${date}`);
  return res.json();
}

export async function confirmDailySettlement(data) {
  const res = await fetch(`${API}/api/daily-settlement`, {
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
  const res = await fetch(`${API}/api/monthly-settlement?month=${month}`);
  return res.json();
}

export async function confirmMonthlySettlement(data) {
  const res = await fetch(`${API}/api/monthly-settlement`, {
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
  const res = await fetch(`${API}/api/history`);
  return res.json();
}

export async function getDailyRecords(month) {
  const res = await fetch(`${API}/api/daily-records?month=${month}`);
  return res.json();
}

export async function getCheckDailySettled(date) {
  const res = await fetch(`${API}/api/check-daily-settled?date=${date}`);
  return res.json();
}

export async function getDailySettlementRecords(settlementKey) {
  const res = await fetch(addTimestamp(`${API}/api/daily-settlement/${settlementKey}/records`));
  return res.json();
}

export async function resetData(password) {
  const res = await fetch(`${API}/api/reset`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password })
  });
  return res.json();
}
