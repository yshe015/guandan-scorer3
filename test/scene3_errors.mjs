import { TMP, shot, BASE, PIN, getResults, assert, launchBrowser, auth, selectPlayers } from './helpers.mjs';

const PLAYERS = ['戴', '李', '沈', '范'];

async function setScoreByOption(page, playerName, score) {
  const rows = await page.$$('.score-table tbody tr');
  for (const row of rows) {
    const nameText = await row.$eval('td:first-child', e => e.textContent.trim());
    if (nameText === playerName) {
      const select = await row.$('select.score-select');
      if (!select) return false;
      await select.selectOption(score.toString());
      return true;
    }
  }
  return false;
}

const { browser, page } = await launchBrowser();

try {
  // ====================================
  // 0. Data reset
  // ====================================
  console.log('=== 数据重置 ===');
  await page.goto(BASE, { waitUntil: 'networkidle' });
  const tokenRes = await page.evaluate(async () => {
    const r = await fetch('/api/auth', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pin: '1234' })
    });
    return await r.json();
  });
  assert(!!tokenRes.token, '获取 token');

  const resetRes = await page.evaluate(async (t) => {
    return await (await fetch('/api/reset', {
      method: 'POST', headers: { 'Content-Type': 'application/json', 'x-auth-token': t },
      body: JSON.stringify({ password: '8dm1n' })
    })).json();
  }, tokenRes.token);
  assert(resetRes.success === true, '数据重置');

  // ====================================
  // 1. PIN auth + select 4 + start game
  // ====================================
  console.log('\n=== 准备 ===');
  await auth(page);
  assert(true, 'PIN 认证');

  await selectPlayers(page, PLAYERS);
  let sel = await page.$$('.player-chip.selected');
  assert(sel.length === 4, `已选 ${sel.length} 人`);

  await page.click('button:has-text("开始记分")');
  await page.waitForSelector('h1:has-text("地下室记分")', { timeout: 3000 });
  assert(true, '跳到记分页');

  // ====================================
  // 2. Invalid combo: +3,+2,-2,-3
  // ====================================
  console.log('\n=== 无效组合 +3,+2,-2,-3 ===');
  for (const [name, score] of Object.entries({ '李': 3, '戴': 2, '沈': -2, '范': -3 }))
    await setScoreByOption(page, name, score);
  await page.waitForTimeout(500);
  await page.click('button:has-text("确认记分")');
  await page.waitForSelector('.modal-content', { timeout: 3000 });
  const invalidMsg = await page.textContent('.modal-content p');
  assert(invalidMsg.includes('记分组合无效'), `提示: "${invalidMsg}"`);
  await page.click('.modal-content .btn-primary');
  await page.waitForSelector('.modal-content', { state: 'detached', timeout: 3000 }).catch(() => {});

  // Reset scores
  for (const name of PLAYERS) await setScoreByOption(page, name, 0);
  await page.waitForTimeout(300);

  // ====================================
  // 3. Only 3 non-zero scores
  // ====================================
  console.log('\n=== 仅3个非零分数 ===');
  await setScoreByOption(page, '戴', 3);
  await setScoreByOption(page, '李', 3);
  await setScoreByOption(page, '沈', -3);
  // 范 stays 0
  await page.waitForTimeout(500);
  const hint = await page.textContent('.score-hint');
  assert(hint.includes('3人'), `提示: "${hint}"`);

  await page.click('button:has-text("确认记分")');
  await page.waitForSelector('.modal-content', { timeout: 3000 });
  const threeMsg = await page.textContent('.modal-content p');
  assert(threeMsg.includes('仅限4位玩家记分'), `提示: "${threeMsg}"`);
  await page.click('.modal-content .btn-primary');
  await page.waitForSelector('.modal-content', { state: 'detached', timeout: 3000 }).catch(() => {});

  for (const name of PLAYERS) await setScoreByOption(page, name, 0);
  await page.waitForTimeout(300);

  // ====================================
  // 4. Sum not zero: +3,+3,+3,-3
  // ====================================
  console.log('\n=== 总和不为 0 (+3,+3,+3,-3) ===');
  for (const [name, score] of Object.entries({ '戴': 3, '李': 3, '沈': 3, '范': -3 }))
    await setScoreByOption(page, name, score);
  await page.waitForTimeout(500);

  await page.click('button:has-text("确认记分")');
  await page.waitForSelector('.modal-content', { timeout: 3000 });
  const sumMsg = await page.textContent('.modal-content p');
  assert(sumMsg.includes('记分组合无效') || sumMsg.includes('总和'), `提示: "${sumMsg}"`);
  await page.click('.modal-content .btn-primary');
  await page.waitForSelector('.modal-content', { state: 'detached', timeout: 3000 }).catch(() => {});

  for (const name of PLAYERS) await setScoreByOption(page, name, 0);
  await page.waitForTimeout(300);

  // ====================================
  // 5. Submit + advance + submit again
  // ====================================
  console.log('\n=== 重复提交 ===');
  for (const [name, score] of Object.entries({ '戴': 3, '李': 3, '沈': -3, '范': -3 }))
    await setScoreByOption(page, name, score);
  await page.waitForTimeout(500);

  await page.click('button:has-text("确认记分")');
  await page.waitForSelector('.modal-content', { timeout: 5000 });
  assert((await page.textContent('.modal-content p')).includes('记分成功'), '首次提交');
  await page.click('.modal-content .btn-primary');
  await page.waitForSelector('.modal-content', { state: 'detached', timeout: 3000 }).catch(() => {});
  await page.waitForTimeout(500);

  // Round advances, submit different scores
  for (const [name, score] of Object.entries({ '戴': 2, '李': 2, '沈': -2, '范': -2 }))
    await setScoreByOption(page, name, score);
  await page.waitForTimeout(500);

  await page.click('button:has-text("确认记分")');
  await page.waitForSelector('.modal-content', { timeout: 5000 });
  const dupMsg = await page.textContent('.modal-content p');
  console.log(`  结果: "${dupMsg}"`);
  await page.click('.modal-content .btn-primary');
  await page.waitForSelector('.modal-content', { state: 'detached', timeout: 3000 }).catch(() => {});

  // ====================================
  // 6. Final hint check
  // ====================================
  console.log('\n=== 分数提示检查 ===');
  for (const [name, score] of Object.entries({ '戴': 1, '李': 1, '沈': -1, '范': -1 }))
    await setScoreByOption(page, name, score);
  await page.waitForTimeout(500);
  const finalHint = await page.textContent('.score-hint');
  assert(finalHint.includes('4人'), `提示: "${finalHint}"`);

  await page.screenshot({ path: shot('scene3-errors.png'), fullPage: true });
  console.log('\n📸 截图:', shot('scene3-errors.png'));

} catch (e) {
  console.error('\n💥 异常:', e.message);
  await page.screenshot({ path: shot('scene3-error.png'), fullPage: true }).catch(() => {});
  getResults().failed++;
} finally {
  await browser.close();
}

const { passed, failed } = getResults();
console.log(`\n=== 结果: ${passed} 通过, ${failed} 失败 ===`);
process.exit(failed > 0 ? 1 : 0);
