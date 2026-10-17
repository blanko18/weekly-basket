// Build-time check that the bundled receipt reader works from www/ exactly as the app loads it.
// Serves www/ locally, opens it in headless Chrome, draws a sample receipt and reads it back.
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join, extname, dirname } from 'node:path';
import { chromium } from 'playwright-core';

const root = join(dirname(new URL(import.meta.url).pathname), '..', 'www');
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.woff2': 'font/woff2',
  '.wasm': 'application/wasm', '.gz': 'application/gzip', '.json': 'application/json', '.png': 'image/png' };
const server = createServer(async (req, res) => {
  const p = join(root, decodeURIComponent(new URL(req.url, 'http://x').pathname));
  try { const b = await readFile(p.endsWith('/') ? join(p, 'index.html') : p); res.writeHead(200, { 'content-type': types[extname(p)] || 'application/octet-stream' }); res.end(b); }
  catch { res.writeHead(404); res.end(); }
}).listen(8765);

const exe = [process.env.CHROME_PATH, '/usr/bin/google-chrome', '/usr/bin/google-chrome-stable', '/usr/bin/chromium', '/usr/bin/chromium-browser'].find(p => p && existsSync(p));
if (!exe) { console.error('No Chrome found for the receipt reader test'); process.exit(1); }
const browser = await chromium.launch({ executablePath: exe, args: ['--no-sandbox'] });
const page = await browser.newPage();
const logs = [];
page.on('console', m => logs.push(m.text()));
page.on('pageerror', e => logs.push('pageerror: ' + e.message));
let code = 1;
try {
  await page.goto('http://localhost:8765/index.html');
  await page.waitForFunction(() => typeof window.__wbOcrSelfTest === 'function');
  const result = await page.evaluate(async () => {
    const lines = ['SUPERMART GROCERY', 'TIN 000-111-222-000', '',
      'LUCKY ME PANCIT CANTON     15.50', 'CHEESE WHIZ 220G          112.00', 'DOVE CONDITIONER 340ML    245.00',
      'SUMO COOKIES               35.50', 'PIATTOS CHEESE 85G         38.00', '',
      'TOTAL                     446.00', 'CASH                      500.00', 'CHANGE                     54.00'];
    const c = document.createElement('canvas'); c.width = 900; c.height = 70 + lines.length * 44;
    const x = c.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, c.width, c.height);
    x.fillStyle = '#111'; x.font = '30px monospace'; x.textBaseline = 'top';
    lines.forEach((l, i) => x.fillText(l, 40, 35 + i * 44));
    const t0 = performance.now();
    const r = await window.__wbOcrSelfTest(c);
    return { ...r, ms: Math.round(performance.now() - t0) };
  });
  console.log('--- OCR text ---\n' + result.text + '\n--- parsed ---');
  console.log(JSON.stringify(result.parsed, null, 1), '\n', result.ms, 'ms');
  const names = result.parsed.items.map(i => i.name.toLowerCase()).join(' | ');
  const ok = result.parsed.items.length >= 4 && /cheese whiz/.test(names) && result.parsed.total === 446;
  if (!ok) throw new Error('Receipt reader self-test did not find the expected items/total');
  console.log('Receipt reader self-test passed');
  code = 0;
} catch (e) {
  console.error(e.message);
  console.error('Page log:\n' + logs.join('\n'));
} finally {
  await browser.close();
  server.close();
  process.exit(code);
}
