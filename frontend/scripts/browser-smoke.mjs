// Runs against the production frontend with canned HTTP responses, never production data.
// Node 22+ and Chromium are required. Set CHROME_PATH if it is not installed here.
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { spawn } from 'node:child_process';
import { readFile, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { demoNodes, demoSummary, demoAuditLogs } from '../artifacts/api-server/src/data/demo-grid.ts';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
let outcome = 'COMMITTED', demo = false, lastRequest, summary = demoSummary;
const server = createServer(async (req, res) => {
  const json = (status, data) => { res.writeHead(status, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(data)); };
  if (req.url === '/api/healthz') return json(200, { status: demo ? 'demo' : 'ok' });
  if (req.url === '/api/grid/summary') return json(200, summary);
  if (req.url === '/api/nodes' && req.method === 'GET') return json(200, demoNodes);
  if (req.url === '/api/audit-logs') return json(200, demoAuditLogs);
  if (req.method === 'POST') {
    let body = ''; for await (const chunk of req) body += chunk;
    lastRequest = JSON.parse(body);
    if (req.url === '/api/nodes') return json(201, { ...demoNodes[0], ...lastRequest });
    if (outcome === 'UNKNOWN') return json(503, { error: 'Database service unavailable', code: 'UNAVAILABLE' });
    const trade = { id: 'TX-1021', sellerNodeId: 'NODE-SOLAR-01', buyerNodeId: 'NODE-CONS-01', energyAmount: 20, pricePerKwh: 6, totalCost: 120, settledAt: '2026-09-06T10:00:00Z', status: outcome, message: outcome === 'COMMITTED' ? 'Trade committed' : 'Buyer has insufficient balance' };
    return outcome === 'COMMITTED' ? json(201, trade) : json(400, { error: trade.message, code: 'INSUFFICIENT_BALANCE', trade });
  }
  try {
    const urlPath = new URL(req.url, 'http://localhost').pathname;
    const asset = urlPath.startsWith('/assets/') || urlPath === '/favicon.svg' ? urlPath : '/index.html';
    const file = path.join(root, 'artifacts/microgrid-trading-engine/dist/public', asset);
    const data = await readFile(file);
    res.setHeader('Content-Type', asset.endsWith('.js') ? 'text/javascript' : asset.endsWith('.css') ? 'text/css' : asset.endsWith('.svg') ? 'image/svg+xml' : 'text/html');
    res.end(data);
  } catch { res.writeHead(404); res.end(); }
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const origin = `http://127.0.0.1:${server.address().port}`;
const profile = await mkdtemp(path.join(tmpdir(), 'microgrid-smoke-'));
const browser = spawn(process.env.CHROME_PATH ?? 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', ['--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check', '--remote-debugging-port=0', `--user-data-dir=${profile}`, 'about:blank'], { windowsHide: true, stdio: 'ignore' });
let socket;
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
try {
  let port;
  for (let i = 0; i < 100; i++) {
    try { port = (await readFile(path.join(profile, 'DevToolsActivePort'), 'utf8')).split('\n')[0]; break; } catch { await delay(100); }
  }
  assert.ok(port, 'Chromium must start');
  const targets = await (await fetch(`http://127.0.0.1:${port}/json`, { signal: AbortSignal.timeout(10000) })).json();
  socket = new WebSocket(targets.find(t => t.type === 'page').webSocketDebuggerUrl);
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('CDP connection timed out')), 10000);
    socket.addEventListener('open', () => { clearTimeout(timer); resolve(); }, { once: true });
    socket.addEventListener('error', () => { clearTimeout(timer); reject(new Error('CDP connection failed')); }, { once: true });
  });
  let id = 0; const pending = new Map(), exceptions = [];
  socket.addEventListener('message', event => {
    const msg = JSON.parse(event.data);
    if (msg.method === 'Runtime.exceptionThrown') exceptions.push(msg.params.exceptionDetails);
    if (msg.id) { const task = pending.get(msg.id); pending.delete(msg.id); msg.error ? task.reject(msg.error) : task.resolve(msg.result); }
  });
  const call = (method, params = {}) => new Promise((resolve, reject) => { pending.set(++id, { resolve, reject }); socket.send(JSON.stringify({ id, method, params })); });
  const evaluate = async expression => { const result = await call('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true }); assert.ok(!result.exceptionDetails, JSON.stringify(result.exceptionDetails)); return result.result.value; };
  const waitFor = async expression => { for (let i = 0; i < 100; i++) { if (await evaluate(expression)) return; await delay(100); } throw new Error(`Timed out: ${expression}`); };
  const click = selector => evaluate(`document.querySelector(${JSON.stringify(selector)}).click()`);
  const set = (selector, value) => evaluate(`(() => { const e = document.querySelector(${JSON.stringify(selector)}); Object.getOwnPropertyDescriptor(e.tagName === 'SELECT' ? HTMLSelectElement.prototype : HTMLInputElement.prototype, 'value').set.call(e, ${JSON.stringify(value)}); e.dispatchEvent(new Event(e.tagName === 'SELECT' ? 'change' : 'input', { bubbles: true })); })()`);
  await call('Runtime.enable');
  await call('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1000, deviceScaleFactor: 1, mobile: false });
  await call('Page.navigate', { url: origin });
  await waitFor("document.querySelectorAll('[data-testid^=row-node-]').length === 7");
  assert.ok(await evaluate("document.documentElement.classList.contains('dark')"));
  assert.ok(await evaluate("document.body.innerText.includes('GRID DEFICIT DETECTED') && document.body.innerText.includes('₹8.25') && document.body.innerText.includes('684.2 kWh')"));
  await set('[aria-label="Filter node type"]', 'BATTERY_STORAGE');
  await waitFor("document.querySelectorAll('[data-testid^=row-node-]').length === 1");
  await set('[aria-label="Filter node type"]', '');
  await set('[aria-label="Filter node priority"]', '1');
  await waitFor("document.querySelectorAll('[data-testid^=row-node-]').length === 1");
  await set('[aria-label="Filter node priority"]', '');
  await set('[aria-label="Search nodes"]', 'no-match');
  await waitFor("document.body.innerText.includes('No nodes match these filters.')");
  await set('[aria-label="Search nodes"]', '');
  await click('[data-testid="button-add-node"]');
  await set('[data-testid="input-node-name"]', 'Test battery');
  await set('[data-testid="select-node-type"]', 'BATTERY_STORAGE');
  await set('[data-testid="input-node-capacity"]', '100');
  await set('[role="dialog"] input[maxlength="200"]', 'Test location');
  await click('[data-testid="button-submit-node"]');
  await waitFor("!document.querySelector('[role=dialog]')");
  assert.deepEqual(lastRequest, { name: 'Test battery', type: 'BATTERY_STORAGE', location: 'Test location', capacity: 100, priority: 3 });
  await set('[data-testid="select-seller-node"]', 'NODE-SOLAR-01');
  await set('[data-testid="select-buyer-node"]', 'NODE-CONS-01');
  await set('[data-testid="input-trade-energy"]', '20');
  await waitFor("document.querySelector('#market-execution').innerText.includes('₹165')");
  await click('[data-testid="button-execute-trade"]');
  await waitFor("document.querySelector('[data-testid=card-trade-result]')?.innerText.includes('TX-1021')");
  assert.deepEqual(lastRequest, { sellerNodeId: 'NODE-SOLAR-01', buyerNodeId: 'NODE-CONS-01', energyAmount: 20 });
  assert.ok(await evaluate("document.querySelector('[data-testid=card-trade-result]').innerText.includes('₹120')"));
  outcome = 'ROLLED_BACK';
  await click('[data-testid="button-execute-trade"]');
  await waitFor("document.querySelector('[data-testid=card-trade-result]')?.innerText.includes('ROLLED BACK')");
  assert.ok(await evaluate("document.querySelector('[data-testid=card-trade-result]').innerText.includes('Buyer has insufficient balance')"));
  outcome = 'UNKNOWN';
  await click('[data-testid="button-execute-trade"]');
  await waitFor("document.querySelector('#market-execution').innerText.includes('No transaction outcome was confirmed')");
  assert.equal(await evaluate("document.querySelector('[data-testid=card-trade-result]') === null"), true);
  for (const status of ['STABLE', 'WARNING']) {
    summary = { ...demoSummary, systemStatus: status, totalGenerationKw: 70, netReserveKw: 10 };
    await click('[data-testid="button-refresh-grid"]');
    await waitFor(`document.querySelector('[data-testid="text-stat-grid-status"]').innerText === ${JSON.stringify(status)}`);
    assert.equal(await evaluate("document.body.innerText.includes('GRID DEFICIT DETECTED')"), false);
  }
  demo = true;
  await call('Page.reload');
  await waitFor("document.body.innerText.includes('Read-only demo data.')");
  assert.ok(await evaluate("document.querySelector('[data-testid=button-add-node]').disabled && document.querySelector('[data-testid=button-execute-trade]').disabled"));
  await call('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
  await click('[data-testid="button-open-navigation"]');
  await click('[data-testid="button-nav-node-registry"]');
  assert.ok(await evaluate("document.documentElement.scrollWidth <= window.innerWidth"), 'No mobile page overflow');
  assert.deepEqual(exceptions, [], 'No unhandled browser exceptions');
  console.log('PASS: dashboard, statuses, filters, registration payload, estimate, backend success/rollback, unknown outcome, demo protection, mobile navigation.');
} finally {
  socket?.close(); browser.kill(); server.closeAllConnections(); server.close();
  await delay(500);
  // Only delete the directory returned by mkdtemp for this isolated browser profile.
  await rm(profile, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
}
