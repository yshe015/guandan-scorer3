import { TMP, shot, BASE, PIN, getResults, assert, launchBrowser, resetData, auth, selectPlayers, setScore } from './helpers.mjs';

const PLAYERS = ['戴', '李', '沈', '范'];

const { browser, page } = await launchBrowser();

try {
  // ====================================
  // 0. Data reset
  // ====================================
  console.log('=== 数据重置 ===');
  const r = await resetData(page);
  assert(r.success === true, '数据重置');

  // ====================================
  // 1. PIN auth
  // ====================================
  console.log('\n=== PIN 认证 ===');
  await page.reload({ waitUntil: 'networkidle' });
  await auth(page);
  assert(true, 'PIN 认证通过');

  // ====================================
  // 2. Select 4 + start game + 2 rounds
  // ====================================
  console.log('\n=== 准备记分 ===');
  await selectPlayers(page, PLAYERS);
  let sel = await page.$$('.player-chip.selected');
  assert(sel.length === 4, `已选 ${sel.length} 人`);

  await page.click('button:has-text("开始记分")');
  await page.waitForSelector('h1:has-text("地下室记分")', { timeout: 3000 });
  assert(true, '跳到记分页');

  // Round 1: +3,+3,-3,-3
  for (const [name, score] of Object.entries({ '戴': 3, '李': 3, '沈': -3, '范': -3 }))
    await setScore(page, name, score);
  await page.waitForTimeout(500);
  await page.click('button:has-text("确认记分")');
  await page.waitForSelector('.modal-content', { timeout: 5000 });
  assert((await page.textContent('.modal-content p')).includes('记分成功'), '第1局');
  await page.click('.modal-content .btn-primary');
  await page.waitForSelector('.modal-content', { state: 'detached', timeout: 3000 }).catch(() => {});

  // Round 2: +2,+2,-2,-2
  const round2Date = await page.textContent('.date-display');
  assert(round2Date.includes('第2局'), `第2局: "${round2Date}"`);
  for (const [name, score] of Object.entries({ '戴': 2, '李': 2, '沈': -2, '范': -2 }))
    await setScore(page, name, score);
  await page.waitForTimeout(500);
  await page.click('button:has-text("确认记分")');
  await page.waitForSelector('.modal-content', { timeout: 5000 });
  assert((await page.textContent('.modal-content p')).includes('记分成功'), '第2局');
  await page.click('.modal-content .btn-primary');
  await page.waitForSelector('.modal-content', { state: 'detached', timeout: 3000 }).catch(() => {});

  // Verify round 3
  assert((await page.textContent('.date-display')).includes('第3局'), '第3局');

  // ====================================
  // 3. Navigate to daily settlement
  // ====================================
  console.log('\n=== 进入日结页 ===');
  await page.click('button:has-text("📅 日结")');
  await page.waitForTimeout(500);
  assert((await page.textContent('h1')).includes('日结'), '日结页标题');

  // ====================================
  // 4. Verify scores
  // ====================================
  console.log('\n=== 验证积分表 ===');
  const dailyRows = await page.$$('.score-table tbody tr');
  assert(dailyRows.length > 0, `积分表 ${dailyRows.length} 行`);

  // Top: 戴 +5
  const firstCells = await dailyRows[0].$$('td');
  assert((await firstCells[0].textContent()).trim() === '戴' && (await firstCells[1].textContent()).trim() === '+5', '第1名 戴+5');

  // Check all scores
  let allScores = '';
  for (const row of dailyRows) {
    const cells = await row.$$('td');
    allScores += (await cells[0].textContent()).trim() + ':' + (await cells[1].textContent()).trim() + ' ';
  }
  assert(allScores.includes('沈:-5'), '沈 -5');
  assert(allScores.includes('范:-5'), '范 -5');
  assert(allScores.includes('戴:+5'), '戴 +5');
  assert(allScores.includes('李:+5'), '李 +5');

  // ====================================
  // 5. Confirm daily settlement
  // ====================================
  console.log('\n=== 确认日结 ===');
  await page.click('button:has-text("确认日结")');
  await page.waitForSelector('.modal-content', { timeout: 3000 });
  assert((await page.textContent('.modal-content p')).includes('确认日结'), '日结弹窗');

  await page.click('.modal-content .btn-primary:has-text("确认")');
  await page.waitForTimeout(500);
  assert((await page.textContent('.modal-content p')).includes('日结成功'), '日结成功');
  await page.click('.modal-content .btn-primary');

  // Wait for redirect to home (1.5s)
  await page.waitForSelector('h1:has-text("掼蛋记分器")', { timeout: 5000 });
  assert(true, '回到主页');

  // ====================================
  // 6. Verify scores reset
  // ====================================
  console.log('\n=== 结算后验证 ===');
  const homeRows = await page.$$('.score-table tbody tr');
  let allZero = true;
  for (const row of homeRows) {
    const cells = await row.$$('td');
    if (cells.length < 4) continue;
    if ((await cells[2].textContent()).trim() !== '0') { allZero = false; break; }
  }
  assert(allZero, '今日分数归零');

  await page.screenshot({ path: shot('scene4-settlement.png'), fullPage: true });
  console.log('\n📸 截图:', shot('scene4-settlement.png'));

} catch (e) {
  console.error('\n💥 异常:', e.message);
  await page.screenshot({ path: shot('scene4-error.png'), fullPage: true }).catch(() => {});
  getResults().failed++;
} finally {
  await browser.close();
}

const { passed, failed } = getResults();
console.log(`\n=== 结果: ${passed} 通过, ${failed} 失败 ===`);
process.exit(failed > 0 ? 1 : 0);
