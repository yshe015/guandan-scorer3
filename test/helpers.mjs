import { chromium } from 'playwright';
import { fileURLToPath } from 'url';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const TMP = path.join(__dirname, 'tmp');
export function shot(name) { return path.join(TMP, name); }

export const BASE = process.env.BASE || 'http://localhost:3000';
export const PIN = process.env.PIN || '1234';
export const RESET_PW = process.env.RESET_PW || '8dm1n';
export const PLAYERS = (process.env.PLAYERS || '').split(',').filter(Boolean);

let passed = 0;
let failed = 0;
let step = 0;

export function assert(ok, msg) {
  step++;
  if (ok) { passed++; }
  else { failed++; console.log(`  ❌ [${step}] ${msg}`); }
}

export function getResults() {
  return { passed, failed, step };
}

export async function launchBrowser() {
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await context.newPage();
  return { browser, context, page };
}

export async function resetData(page) {
  await page.goto(BASE, { waitUntil: 'networkidle' });
  const res = await page.evaluate(async ({ p, rpw }) => {
    const a = await (await fetch('/api/auth', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pin: p })
    })).json();
    return await (await fetch('/api/reset', {
      method: 'POST', headers: { 'Content-Type': 'application/json', 'x-auth-token': a.token },
      body: JSON.stringify({ password: rpw })
    })).json();
  }, { p: PIN, rpw: RESET_PW });
  return res;
}

export async function auth(page) {
  const boxes = await page.$$('.pin-box');
  for (let i = 0; i < boxes.length; i++) await boxes[i].fill(PIN[i]);
  await page.waitForSelector('h1:has-text("掼蛋记分器")', { timeout: 5000 });
}

export async function selectPlayers(page, names) {
  if (!names || names.length === 0) return;
  for (const name of names) {
    const chips = await page.$$('.player-chip');
    let found = false;
    for (const chip of chips) {
      if ((await chip.textContent()).includes(name)) {
        const cls = await chip.getAttribute('class');
        if (!cls.includes('selected')) {
          await chip.click();
          await page.waitForTimeout(200);
        }
        found = true;
        break;
      }
    }
    if (!found) console.log(`  ⚠ 未找到玩家: "${name}"`);
  }
}

export async function setScore(page, name, value) {
  const rows = await page.$$('.score-table tbody tr');
  for (const row of rows) {
    if ((await row.$eval('td:first-child', e => e.textContent.trim())) === name) {
      await row.$eval('select', (el, v) => { el.value = v; el.dispatchEvent(new Event('change', { bubbles: true })); }, value.toString());
      return;
    }
  }
}
