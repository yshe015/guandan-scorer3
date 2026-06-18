import { TMP, shot, BASE, PIN, getResults, assert, launchBrowser } from './helpers.mjs';

const { browser, page } = await launchBrowser();

try {
  // ====================================
  // 1.1 未认证状态显示 PIN 页
  // ====================================
  console.log('\n=== 1.1 未认证显示 PIN 页 ===');
  await page.goto(BASE, { waitUntil: 'networkidle' });

  const pinTitle = await page.textContent('.pin-title').catch(() => null);
  assert(pinTitle === '请输入PIN', `.pin-title = "${pinTitle}"`);

  const pinBoxes = await page.$$('.pin-box');
  assert(pinBoxes.length === 4, `PIN 框数量 = ${pinBoxes.length}`);

  let allNumeric = true;
  for (const box of pinBoxes) {
    if ((await box.getAttribute('inputMode')) !== 'numeric') allNumeric = false;
  }
  assert(allNumeric, '所有 PIN 框 inputMode=numeric');

  // ====================================
  // 1.2 错误 PIN 拒绝
  // ====================================
  console.log('\n=== 1.2 错误 PIN 拒绝 ===');
  for (let i = 0; i < pinBoxes.length; i++) await pinBoxes[i].fill('0');
  await page.waitForTimeout(800);

  const errorText = await page.textContent('.pin-error').catch(() => null);
  assert(errorText?.includes('PIN 错误'), `错误提示: "${errorText || '(无)'}"`);
  assert(await page.$('.pin-section'), '仍在 PIN 页');
  assert(!(await page.$('.player-list, .game-section')), '主页内容未渲染');

  // ====================================
  // 1.3 正确 PIN 通过
  // ====================================
  console.log('\n=== 1.3 正确 PIN 通过 ===');
  const freshBoxes = await page.$$('.pin-box');
  for (const box of freshBoxes) await box.fill('');
  for (let i = 0; i < freshBoxes.length; i++) await freshBoxes[i].fill(PIN[i]);
  await page.waitForSelector('h1', { timeout: 5000 });

  const homeTitle = await page.textContent('h1');
  assert(homeTitle === '🃏 地下室掼蛋记分器', `主页标题 = "${homeTitle}"`);

  const hasToken = await page.evaluate(() => !!localStorage.getItem('pin_token'));
  assert(hasToken, 'localStorage.pin_token 存在');

  // ====================================
  // 1.4 Token 持久化（刷新）
  // ====================================
  console.log('\n=== 1.4 Token 持久化 ===');
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(500);
  const afterReload = await page.textContent('h1').catch(() => null);
  assert(afterReload === '🃏 地下室掼蛋记分器', `刷新后 H1 = "${afterReload}"`);
  assert(!(await page.$('.pin-section')), '刷新后无 PIN 框');

  // ====================================
  // 1.5 清除 token → 回到 PIN 页
  // ====================================
  console.log('\n=== 1.5 清除 token ===');
  await page.evaluate(() => localStorage.removeItem('pin_token'));
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(500);
  assert(await page.$('.pin-section'), '清除 token 后回到 PIN 页');

  await page.screenshot({ path: shot('scene1-pin.png'), fullPage: true });
  console.log('\n📸 截图:', shot('scene1-pin.png'));

} catch (e) {
  console.error('\n💥 异常:', e.message);
  await page.screenshot({ path: shot('scene1-error.png'), fullPage: true }).catch(() => {});
  getResults().failed++;
} finally {
  await browser.close();
}

const { passed, failed } = getResults();
console.log(`\n=== 结果: ${passed} 通过, ${failed} 失败 ===`);
process.exit(failed > 0 ? 1 : 0);
