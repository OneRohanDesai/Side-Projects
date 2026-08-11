/**
 * Start ship loop after registering. Assumes shop API + VERITAS are already up.
 */
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const dir = path.dirname(fileURLToPath(import.meta.url));

async function run(script) {
  const p = spawn(process.execPath, [path.join(dir, script)], {
    stdio: 'inherit',
    env: process.env,
  });
  return new Promise((resolve, reject) => {
    p.on('exit', (code) => (code === 0 ? resolve() : reject(new Error(`${script} exit ${code}`))));
  });
}

console.log('1) Register project topology with VERITAS');
await run('register.js');
console.log('2) Ship live telemetry (Ctrl+C to stop)');
await run('ship.js');
