// Use the native sequencer's checkpoint recovery to generate its own genesis
// DA diff and sparse openings. Never fabricate PostgreSQL binary records.
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, renameSync, writeFileSync } from 'node:fs';
function run(command, args, capture = false) {
  const result = spawnSync(command, args, { stdio: capture ? 'pipe' : 'inherit', encoding: 'utf8' });
  if (result.error || result.status !== 0) throw result.error ?? new Error(`${command} failed: ${result.stderr ?? result.status}`);
  return result.stdout;
}
const compose = ['compose', '-f', 'zeko-localnet/compose.yaml'];
const count = run('docker', [...compose, 'exec', '-T', 'postgres', 'psql', '-U', 'research', '-d', 'sequencer', '-Atc', 'SELECT count(*) FROM da_diff'], true).trim();
if (Number(count) > 0) { console.log('Existing native DA history retained'); process.exit(0); }
if (existsSync('.local/zeko/config/bootstrap.json')) throw new Error('Checkpoint bootstrap incomplete; inspect Zeko logs before retrying');
const response = await fetch(process.env.LOCAL_ZEKO_GRAPHQL ?? 'http://127.0.0.1:19230/graphql', { method: 'POST', headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ query: '{stateHashes{unprovedLedgerHash}}' }), signal: AbortSignal.timeout(10000) });
const ledgerRoot = (await response.json()).data?.stateHashes?.unprovedLedgerHash;
if (!/^\d+$/.test(ledgerRoot)) throw new Error('Native ledger root unavailable');
run('docker', [...compose, 'stop', 'sequencer']);
mkdirSync('.local/zeko/checkpoints', { recursive: true, mode: 0o700 });
const checkpoint = `.local/zeko/checkpoints/${ledgerRoot}`;
if (existsSync(checkpoint)) throw new Error('Checkpoint already exists; refusing overwrite');
renameSync('.local/zeko/ledger', checkpoint);
mkdirSync('.local/zeko/ledger', { mode: 0o700 });
writeFileSync('.local/zeko/config/bootstrap.json', JSON.stringify({ ledgerRoot, developmentMetadata: true }), { mode: 0o600 });
run('docker', [...compose, 'up', '-d']);
run(process.execPath, ['zeko-localnet/ready.mjs']);
const after = run('docker', [...compose, 'exec', '-T', 'postgres', 'psql', '-U', 'research', '-d', 'sequencer', '-Atc', 'SELECT count(*) FROM da_diff'], true).trim();
if (!(Number(after) > 0)) throw new Error('Native genesis DA diff missing');
console.log('Native checkpoint recovery initialized genesis DA history');
