import { TMP, shot, BASE, PIN, getResults, assert, launchBrowser, selectPlayers, setScore } from './helpers.mjs';

const ALL_PLAYERS = ['戴', '李', '沈', '范', 'max', 'mason'];
const COMBOS = [[3, 3, -3, -3], [2, 2, -2, -2], [1, 1, -1, -1]];
const TOTAL_ROUNDS = 45;
const WAIT_MS = 30000;
const NAME_TO_ID = { '戴': 1, '李': 2, '沈': 3, '范': 4, 'max': 5, 'mason': 6 };

const accum = {};
ALL_PLAYERS.forEach(p => accum[p] = 0);

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function pickRound() {
  const picked = shuffle(ALL_PLAYERS).slice(0, 4);
  const combo = COMBOS[Math.floor(Math.random() * COMBOS.length)];
  const scores = shuffle(combo);
  const scoreMap = {}, scoreById = {};
  for (const name of ALL_PLAYERS) {
    const idx = picked.indexOf(name);
    const s = idx >= 0 ? scores[idx] : 0;
    scoreMap[name] = s;
    scoreById[NAME_TO_ID[name]] = s;
    if (s !== 0) accum[name] += s;
  }
  return { picked, scoreMap, scoreById, comboLabel: combo.join(',') };
}

const { browser, page } = await launchBrowser();

try {
  // ========================================
  // 0. API 数据重置
  // ========================================
  console.log('=== API 数据重置 ===');
  const tokenRes = await (await fetch(`${BASE}/api/auth`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ pin: PIN })
  })).json();

  const resetRes = await (await fetch(`${BASE}/api/reset`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', 'x-auth-token': tokenRes.token },
    body: JSON.stringify({ password: '8dm1n' })
  })).json();
  assert(resetRes.success === true, '数据重置');

  // ========================================
  // 1. PIN 认证
  // ========================================
  console.log('\n=== PIN 认证 ===');
  await page.goto(BASE, { waitUntil: 'networkidle' });
  const boxes = await page.$$('.pin-box');
  for (let i = 0; i < boxes.length; i++) await boxes[i].fill(PIN[i]);
  await page.waitForSelector('h1:has-text("掼蛋记分器")', { timeout: 5000 });
  assert(true, 'PIN 认证通过');

  // ========================================
  // 2. 选 6 人
  // ========================================
  console.log('\n=== 选人 ===');
  await selectPlayers(page, ALL_PLAYERS);
  const sel = await page.$$('.player-chip.selected');
  assert(sel.length === 6, `已选 ${sel.length} 人`);

  // ========================================
  // 3. 开始记分
  // ========================================
  await page.click('button:has-text("开始记分")');
  await page.waitForSelector('h1:has-text("地下室记分")', { timeout: 3000 });
  assert(true, '跳到记分页');

  // ========================================
  // 4. 循环记分
  // ========================================
  for (let round = 1; round <= TOTAL_ROUNDS; round++) {
    const r = pickRound();
    console.log(`\n--- 第${round}局: ${r.picked.join('/')} [${r.comboLabel}] ---`);

    const dateText = await page.textContent('.date-display');
    assert(dateText.includes(`第${round}局`), `显示第${round}局`);

    const currentDateText = await page.textContent('.date-display');
    const dateMatch = currentDateText.match(/(\d{4})年(\d{1,2})月(\d{1,2})日/);
    const apiDate = dateMatch ? `${dateMatch[1]}-${dateMatch[2].padStart(2,'0')}-${dateMatch[3].padStart(2,'0')}` : '2026-06-18';

    // API batch scoring to avoid polling race
    const game = await page.evaluate(async ({ scoresObj, dt, rd }) => {
      const token = localStorage.getItem('pin_token');
      const res = await fetch('/api/current-game', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-auth-token': token },
        body: JSON.stringify({ date: dt, round: rd, selected_players: [1,2,3,4,5,6], scores: scoresObj })
      });
      return await res.json();
    }, { scoresObj: r.scoreById, dt: apiDate, rd: round });
    assert(game?.success === true, `API 设分`);

    // Wait for polling to propagate
    await page.waitForTimeout(6000);

    await page.click('button:has-text("确认记分")');
    try {
      await page.waitForSelector('.modal-content', { timeout: 5000 });
      const modalText = await page.textContent('.modal-content p');
      assert(modalText.includes('记分成功'), `Modal: "${modalText}"`);
      await page.click('.modal-content .btn-primary');
      await page.waitForSelector('.modal-content', { state: 'detached', timeout: 3000 }).catch(() => {});
    } catch (e) {
      await page.screenshot({ path: shot(`scene2-round-${round}-error.png`), fullPage: true }).catch(() => {});
      assert(false, `第${round}局异常: ${e.message}`);
    }

    if (round < TOTAL_ROUNDS) {
      const nextText = await page.textContent('.date-display');
      assert(nextText.includes(`第${round + 1}局`), `递增到第${round + 1}局`);
    }

    if (round % 10 === 0) {
      await page.screenshot({ path: shot(`scene2-round-${round}.png`), fullPage: true });
      console.log(`  📸 ${shot(`scene2-round-${round}.png`)}`);
    }

    if (round < TOTAL_ROUNDS) {
      console.log('  ⏱ 等待 30 秒...');
      await page.waitForTimeout(WAIT_MS);
    }
  }

  // ========================================
  // 5. 返回主页验证
  // ========================================
  console.log('\n=== 返回主页 ===');
  await page.click('button.header-btn:has-text("🏠")');
  await page.waitForSelector('h1:has-text("掼蛋记分器")', { timeout: 3000 });

  const rows = await page.$$('.score-table tbody tr');
  let verified = 0;
  for (const row of rows) {
    const cells = await row.$$('td');
    if (cells.length < 4) continue;
    const name = (await cells[1].textContent()).trim();
    const todayScore = parseInt((await cells[2].textContent()).trim());
    if (ALL_PLAYERS.includes(name)) {
      assert(todayScore === accum[name], `${name} = ${todayScore} 期望=${accum[name]}`);
      verified++;
    }
  }
  assert(verified === 6, `验证 ${verified}/6 人`);

  console.log('\n=== 最终累计 ===');
  let totalSum = 0;
  for (const [name, acc] of Object.entries(accum)) {
    console.log(`  ${name}: ${acc > 0 ? '+' : ''}${acc}`);
    totalSum += acc;
  }
  console.log(`  总分和: ${totalSum} (应为 0)`);
  assert(totalSum === 0, `总分和 = ${totalSum}`);

  await page.screenshot({ path: shot('scene2-final.png'), fullPage: true });
  console.log('📸', shot('scene2-final.png'));

} catch (e) {
  console.error('\n💥 异常:', e.message);
  await page.screenshot({ path: shot('scene2-error.png'), fullPage: true }).catch(() => {});
  getResults().failed++;
} finally {
  await browser.close();
}

const { passed, failed } = getResults();
console.log(`\n=== 结果: ${passed} 通过, ${failed} 失败 (${TOTAL_ROUNDS}局) ===`);
process.exit(failed > 0 ? 1 : 0);
