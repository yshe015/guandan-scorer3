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
  console.log('\n=== 记分 2 局 ===');
  await selectPlayers(page, PLAYERS);
  await page.click('button:has-text("开始记分")');
  await page.waitForSelector('h1:has-text("地下室记分")', { timeout: 3000 });
  assert(true, '跳到记分页');

  // Round 1
  for (const [name, score] of Object.entries({ '戴': 3, '李': 3, '沈': -3, '范': -3 }))
    await setScore(page, name, score);
  await page.waitForTimeout(300);
  await page.click('button:has-text("确认记分")');
  await page.waitForSelector('.modal-content', { timeout: 5000 });
  assert((await page.textContent('.modal-content p')).includes('记分成功'), '第1局');
  await page.click('.modal-content .btn-primary');

  // Round 2
  for (const [name, score] of Object.entries({ '戴': 2, '李': 2, '沈': -2, '范': -2 }))
    await setScore(page, name, score);
  await page.waitForTimeout(300);
  await page.click('button:has-text("确认记分")');
  await page.waitForSelector('.modal-content', { timeout: 5000 });
  assert((await page.textContent('.modal-content p')).includes('记分成功'), '第2局');
  await page.click('.modal-content .btn-primary');

  // ==============================
  // 3. History - current records
  // ==============================
  console.log('\n=== 查看历史（当前记录） ===');
  await page.click('button:has-text("🏠")');
  await page.waitForSelector('h1:has-text("掼蛋记分器")', { timeout: 3000 });
  await page.click('button:has-text("📜 历史")');
  await page.waitForTimeout(500);
  assert((await page.textContent('h1')).includes('历史记录'), '历史页');

  // Current records section
  const currentSection = await page.textContent('.expander.open .expander-header');
  assert(currentSection.includes('当前记录') && currentSection.includes('2局'), `当前: "${currentSection}"`);

  // Verify scores
  const expanderText = await page.textContent('.expander.open');
  for (const [name, s] of Object.entries({ '戴': 3, '李': 3, '沈': -3, '范': -3 }))
    assert(expanderText.includes(`${name} ${s > 0 ? '+' + s : s}`), `R1 ${name} ${s}`);
  for (const [name, s] of Object.entries({ '戴': 2, '李': 2, '沈': -2, '范': -2 }))
    assert(expanderText.includes(`${name} ${s > 0 ? '+' + s : s}`), `R2 ${name} ${s}`);

  // Totals
  assert(expanderText.includes('戴: +5'), '总计 戴+5');
  assert(expanderText.includes('李: +5'), '总计 李+5');
  assert(expanderText.includes('沈: -5'), '总计 沈-5');
  assert(expanderText.includes('范: -5'), '总计 范-5');

  // ==============================
  // 4. Daily settlement
  // ==============================
  console.log('\n=== 日结 ===');
  await page.click('button:has-text("🏠")');
  await page.waitForSelector('h1:has-text("掼蛋记分器")', { timeout: 3000 });
  await page.click('button:has-text("记分")');
  await page.waitForTimeout(500);
  await page.click('button:has-text("📅 日结")');
  await page.waitForTimeout(500);
  await page.click('button:has-text("确认日结")');
  await page.waitForSelector('.modal-content', { timeout: 3000 });
  assert((await page.textContent('.modal-content p')).includes('确认日结'), '日结确认');
  await page.click('.modal-content .btn-primary:has-text("确认")');
  await page.waitForTimeout(500);
  const successText = await page.textContent('.modal-content p');
  assert(successText.includes('日结成功'), '日结成功');
  await page.click('.modal-content .btn-primary');
  await page.waitForSelector('h1:has-text("掼蛋记分器")', { timeout: 5000 });
  assert(true, '回到主页');

  // ==============================
  // 5. History after settlement
  // ==============================
  console.log('\n=== 查看历史（日结后） ===');
  await page.click('button:has-text("📜 历史")');
  await page.waitForTimeout(500);

  const afterSettlementText = await page.textContent('.expander.open');
  assert(afterSettlementText.includes('暂无记录'), '当前记录清空');
  assert((await page.textContent('.section')).includes('未月结'), '显示未月结');

  await page.screenshot({ path: shot('scene6-history.png'), fullPage: true });
  console.log('\n📸 截图:', shot('scene6-history.png'));

} catch (e) {
  console.error('\n💥 异常:', e.message);
  await page.screenshot({ path: shot('scene6-error.png'), fullPage: true }).catch(() => {});
  getResults().failed++;
} finally {
  await browser.close();
}

const { passed, failed } = getResults();
console.log(`\n=== 结果: ${passed} 通过, ${failed} 失败 ===`);
process.exit(failed > 0 ? 1 : 0);
