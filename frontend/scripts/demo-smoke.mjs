import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const processHandle = spawn(process.execPath, ['dist/index.mjs'], {
  cwd: path.join(root, 'artifacts/api-server'),
  env: { ...process.env, PORT: '18082' }, windowsHide: true, stdio: 'ignore',
});
const origin = 'http://127.0.0.1:18082/api';
const get = async route => {
  const response = await fetch(origin + route);
  assert.equal(response.status, 200);
  return response.json();
};
try {
  let ready = false;
  for (let i = 0; i < 100; i++) {
    try { assert.equal((await get('/healthz')).status, 'demo'); ready = true; break; }
    catch { await new Promise(resolve => setTimeout(resolve, 100)); }
  }
  assert.ok(ready, 'Demo server starts');
  const before = await Promise.all(['/nodes', '/grid/summary', '/audit-logs'].map(get));
  assert.equal(before[0].length, 7);
  assert.equal(before[1].netReserveKw, -10);
  assert.equal(before[2][0].status, 'ROLLED_BACK');
  for (const route of ['/trades', '/nodes']) {
    const response = await fetch(origin + route, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ sellerNodeId: 'NODE-SOLAR-01', buyerNodeId: 'NODE-CONS-01', energyAmount: 20 }) });
    assert.equal(response.status, 503);
    const error = await response.json();
    assert.equal(error.code, 'JAVA_BACKEND_REQUIRED');
    assert.equal(error.trade, undefined, 'Demo must not claim a recorded transaction');
  }
  const after = await Promise.all(['/nodes', '/grid/summary', '/audit-logs'].map(get));
  assert.deepEqual(after, before, 'Write requests do not mutate fixtures');
  console.log('PASS: demo GET schemas, explicit demo health, both writes rejected, balances/energy/audit unchanged.');
} finally { processHandle.kill(); }
