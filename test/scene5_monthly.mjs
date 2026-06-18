import { TMP, shot, BASE, PIN, getResults, assert, launchBrowser, resetData, auth, selectPlayers, setScore } from './helpers.mjs';

const PLAYERS = ['戴', '李', '沈', '范'];

const { browser, page } = await launchBrowser();

try {
  // ==============================
  // 0. Data reset
  // ==============================
  console.log('=== 数据重置 ===');
  const r = await resetData(page);
  assert(r.success === true, '数据重置');

  // ==============================
  // 1. PIN auth
  // ==============================
  console.log('\n=== PIN 认证 ===');
  await page.reload({ waitUntil: 'networkidle' });
  await auth(page);
  assert(true, 'PIN 认证');

  // ==============================
  // 2. Start game + 2 rounds
  // ==============================
  console.log('\n=== 提交 2 局 ===');
  await selectPlayers(page, PLAYERS);
  let sel = await page.$$('.player-chip.selected');
  assert(sel.length === 4, `已选 ${sel.length} 人`);

  await page.click('button:has-text("开始记分")');
  await page.waitForSelector('h1:has-text("地下室记分")', { timeout: 3000 });
  assert(true, '跳到记分页');

  // R1
  for (const [name, score] of Object.entries({ '戴': 3, '李': 3, '沈': -3, '范': -3 }))
    await setScore(page, name, score);
  await page.waitForTimeout(300);
  await page.click('button:has-text("确认记分")');
  await page.waitForSelector('.modal-content', { timeout: 5000 });
  assert((await page.textContent('.modal-content p')).includes('记分成功'), '第1局');
  await page.click('.modal-content .btn-primary');
  await page.waitForSelector('.modal-content', { state: 'detached', timeout: 3000 }).catch(() => {});

  // R2
  for (const [name, score] of Object.entries({ '戴': 2, '李': 2, '沈': -2, '范': -2 }))
    await setScore(page, name, score);
  await page.waitForTimeout(300);
  await page.click('button:has-text("确认记分")');
  await page.waitForSelector('.modal-content', { timeout: 5000 });
  assert((await page.textContent('.modal-content p')).includes('记分成功'), '第2局');
  await page.click('.modal-content .btn-primary');
  await page.waitForSelector('.modal-content', { state: 'detached', timeout: 3000 }).catch(() => {});

  // ==============================
  // 3. Daily settlement
  // ==============================
  console.log('\n=== 日结 ===');
  await page.click('button:has-text("📅 日结")');
  await page.waitForTimeout(500);
  assert((await page.textContent('h1')).includes('日结'), '日结页');

  await page.click('button:has-text("确认日结")');
  await page.waitForSelector('.modal-content', { timeout: 3000 });
  assert((await page.textContent('.modal-content p')).includes('确认日结'), '确认弹窗');
  await page.click('.modal-content .btn-primary:has-text("确认")');
  await page.waitForTimeout(500);
  assert((await page.textContent('.modal-content p')).includes('日结成功'), '日结成功');
  await page.click('.modal-content .btn-primary');
  await page.waitForSelector('h1:has-text("掼蛋记分器")', { timeout: 5000 });
  assert(true, '回到主页');

  // ==============================
  // 4. Another 2 rounds (current month)
  // ==============================
  console.log('\n=== 再记 2 局 ===');
  await selectPlayers(page, PLAYERS);
  sel = await page.$$('.player-chip.selected');
  assert(sel.length === 4, `已选 ${sel.length} 人`);

  await page.click('button:has-text("记分")');
  await page.waitForSelector('h1:has-text("地下室记分")', { timeout: 3000 });
  assert(true, '跳到记分页');

  for (const [name, score] of Object.entries({ '戴': 1, '沈': 1, '李': -1, '范': -1 }))
    await setScore(page, name, score);
  await page.waitForTimeout(300);
  await page.click('button:has-text("确认记分")');
  await page.waitForSelector('.modal-content', { timeout: 5000 });
  assert((await page.textContent('.modal-content p')).includes('记分成功'), '第3局');
  await page.click('.modal-content .btn-primary');
  await page.waitForSelector('.modal-content', { state: 'detached', timeout: 3000 }).catch(() => {});

  for (const [name, score] of Object.entries({ '戴': 3, '沈': -3, '李': 3, '范': -3 }))
    await setScore(page, name, score);
  await page.waitForTimeout(300);
  await page.click('button:has-text("确认记分")');
  await page.waitForSelector('.modal-content', { timeout: 5000 });
  assert((await page.textContent('.modal-content p')).includes('记分成功'), '第4局');
  await page.click('.modal-content .btn-primary');
  await page.waitForSelector('.modal-content', { state: 'detached', timeout: 3000 }).catch(() => {});

  // ==============================
  // 5. Home → Monthly settlement
  // ==============================
  console.log('\n=== 进入月结页 ===');
  await page.click('button:has-text("🏠")');
  await page.waitForSelector('h1:has-text("掼蛋记分器")', { timeout: 3000 });
  assert(true, '回到主页');

  await page.click('button:has-text("📆 月结")');
  await page.waitForTimeout(500);
  assert((await page.textContent('h1')).includes('月结'), '月结页');
  assert((await page.textContent('.date-display')).includes('月'), '月份显示');

  // ==============================
  // 6. Verify monthly scores
  // 戴: daily +5 then +4 = +9
  // 李: daily +5 then +2 = +7
  // 沈: daily -5 then -2 = -7
  // 范: daily -5 then -4 = -9
  // ==============================
  console.log('\n=== 验证月积分 ===');
  const monthRows = await page.$$('.score-table tbody tr');
  assert(monthRows.length > 0, `表 ${monthRows.length} 行`);

  let rowText = '';
  for (const row of monthRows) {
    const cells = await row.$$('td');
    rowText += (await cells[1].textContent()).trim() + ':' + (await cells[2].textContent()).trim() + ' ';
  }
  assert(rowText.includes('戴:+9'), '戴 +9');
  assert(rowText.includes('李:+7'), '李 +7');
  assert(rowText.includes('沈:-7'), '沈 -7');
  assert(rowText.includes('范:-9'), '范 -9');
  assert(rowText.includes('胡:0') || rowText.includes('max:0'), '未参与玩家 0');

  const firstCells = await monthRows[0].$$('td');
  assert((await firstCells[1].textContent()).trim() === '戴', '月榜第1');

  // Champion
  const champName = await page.textContent('.month-champion .name');
  assert(champName.trim() === '戴', `冠军: "${champName.trim()}"`);
  assert((await page.textContent('.month-champion div:last-child')).includes('+9'), '冠军 +9');

  // ==============================
  // 7. Confirm monthly settlement
  // ==============================
  console.log('\n=== 确认月结 ===');
  await page.click('button:has-text("确认月结")');
  await page.waitForSelector('.modal-content', { timeout: 3000 });
  assert((await page.textContent('.modal-content p')).includes('确认月结'), '月结弹窗');

  await page.click('.modal-content .btn-primary:has-text("确认")');
  await page.waitForTimeout(500);

  // Token expires → PinGate appears
  const pinBoxes = await page.$$('.pin-box');
  if (pinBoxes.length > 0) {
    console.log('  ↪ Token过期，重新认证');
    for (let i = 0; i < pinBoxes.length; i++) await pinBoxes[i].fill(PIN[i]);
    await page.waitForSelector('h1:has-text("掼蛋记分器")', { timeout: 5000 });
    assert(true, '月结后重新认证');
  }

  // ==============================
  // 8. Verify scores reset
  // ==============================
  console.log('\n=== 结算后验证 ===');
  assert((await page.textContent('h1')).includes('掼蛋记分器'), '回到主页');

  const homeRows = await page.$$('.score-table tbody tr');
  let monthlyAllZero = true;
  for (const row of homeRows) {
    const cells = await row.$$('td');
    if (cells.length < 4) continue;
    if ((await cells[3].textContent()).trim() !== '0') { monthlyAllZero = false; break; }
  }
  assert(monthlyAllZero, '本月积分归零');

  await page.screenshot({ path: shot('scene5-monthly.png'), fullPage: true });
  console.log('\n📸 截图:', shot('scene5-monthly.png'));

} catch (e) {
  console.error('\n💥 异常:', e.message);
  await page.screenshot({ path: shot('scene5-error.png'), fullPage: true }).catch(() => {});
  getResults().failed++;
} finally {
  await browser.close();
}

const { passed, failed } = getResults();
console.log(`\n=== 结果: ${passed} 通过, ${failed} 失败 ===`);
process.exit(failed > 0 ? 1 : 0);
