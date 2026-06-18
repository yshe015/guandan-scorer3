import { TMP, shot, BASE, PIN, getResults, assert, launchBrowser, auth, selectPlayers, setScore, resetData } from './helpers.mjs';

const PLAYERS = ['戴', '李', '沈', '范'];
const ROUNDS = [
  { scores: { '戴': 3, '李': 3, '沈': -3, '范': -3 }, label: '+3,+3,-3,-3' },
  { scores: { '戴': 2, '李': 2, '沈': -2, '范': -2 }, label: '+2,+2,-2,-2' },
  { scores: { '戴': 1, '李': 1, '沈': -1, '范': -1 }, label: '+1,+1,-1,-1' },
];
const WAIT_MS = 60000;

// Calculate expected accumulations
const accum = {};
for (const r of ROUNDS)
  for (const [name, score] of Object.entries(r.scores))
    accum[name] = (accum[name] || 0) + score;

const { browser, page } = await launchBrowser();

try {
  // ====================================
  // 0. Data reset (clean slate)
  // ====================================
  console.log('=== 数据重置 ===');
  const r = await resetData(page);
  assert(r.success === true, '数据重置');

  // ====================================
  // PIN 认证
  // ====================================
  console.log('\n=== PIN 认证 ===');
  await page.reload({ waitUntil: 'networkidle' });
  await auth(page);
  assert(true, 'PIN 认证通过');

  // ====================================
  // 选人
  // ====================================
  console.log('\n=== 选人 ===');
  await selectPlayers(page, PLAYERS);

  const selectedChips = await page.$$('.player-chip.selected');
  assert(selectedChips.length === 4, `已选 ${selectedChips.length} 位玩家`);

  // ====================================
  // 开始记分
  // ====================================
  console.log('\n=== 开始记分 ===');
  await page.click('button:has-text("开始记分")');
  await page.waitForSelector('h1:has-text("地下室记分")', { timeout: 3000 });
  assert(true, '跳转到记分页');

  // ====================================
  // 记分循环
  // ====================================
  for (let i = 0; i < ROUNDS.length; i++) {
    const r = ROUNDS[i];
    console.log(`\n=== 第${i + 1}局: ${r.label} ===`);

    const dateText = await page.textContent('.date-display');
    assert(dateText.includes(`第${i + 1}局`), `显示第${i + 1}局: "${dateText}"`);

    for (const [name, score] of Object.entries(r.scores)) {
      await setScore(page, name, score);
    }
    assert(true, `分数设置: ${JSON.stringify(r.scores)}`);

    const hint = await page.textContent('.score-hint').catch(() => '');
    assert(hint.includes('4人'), `提示: "${hint}"`);

    await page.click('button:has-text("确认记分")');
    await page.waitForSelector('.modal-content', { timeout: 5000 });
    const modalText = await page.textContent('.modal-content p');
    assert(modalText.includes('记分成功'), `Modal: "${modalText}"`);

    await page.click('.modal-content .btn-primary');
    await page.waitForSelector('.modal-content', { state: 'detached', timeout: 3000 }).catch(() => {});

    if (i < ROUNDS.length - 1) {
      const nextDate = await page.textContent('.date-display');
      assert(nextDate.includes(`第${i + 2}局`), `递增到第${i + 2}局`);
      console.log(`  ⏱ 等待 ${WAIT_MS / 1000} 秒...`);
      await page.waitForTimeout(WAIT_MS);
    }
  }

  // ====================================
  // 返回主页验证
  // ====================================
  console.log('\n=== 返回主页验证 ===');
  await page.click('button.header-btn:has-text("🏠")');
  await page.waitForSelector('h1:has-text("掼蛋记分器")', { timeout: 3000 });

  const rows = await page.$$('.score-table tbody tr');
  let verified = 0;
  for (const row of rows) {
    const cells = await row.$$('td');
    if (cells.length < 4) continue;
    const name = (await cells[1].textContent()).trim();
    const todayScore = parseInt((await cells[2].textContent()).trim());
    if (PLAYERS.includes(name)) {
      assert(todayScore === accum[name], `${name} = ${todayScore} (期望 ${accum[name]})`);
      verified++;
    }
  }
  assert(verified === 4, `验证 ${verified}/4 人`);

  await page.screenshot({ path: shot('scene2-scoring.png'), fullPage: true });
  console.log('\n📸 截图:', shot('scene2-scoring.png'));

} catch (e) {
  console.error('\n💥 异常:', e.message);
  await page.screenshot({ path: shot('scene2-error.png'), fullPage: true }).catch(() => {});
  getResults().failed++;
} finally {
  await browser.close();
}

const { passed, failed } = getResults();
console.log(`\n=== 结果: ${passed} 通过, ${failed} 失败 ===`);
process.exit(failed > 0 ? 1 : 0);
