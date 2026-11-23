import { PublicKey } from 'o1js';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, chmodSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
const image = 'zekolabs/zeko@sha256:ba52e5eeadeb6b96417e3284aae07352f08efd652dd8a5fe60b58476d006046e';
const dir = resolve('.local/zeko');
mkdirSync(`${dir}/config`, { recursive: true, mode: 0o700 });
function run(command, args) {
  const result = spawnSync(command, args, { stdio: 'inherit' });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`${command} failed (${result.status})`);
}
function native(args) {
  run('docker', ['run', '--rm', '--platform', 'linux/amd64', '--network', 'none', '--memory', '1g',
    ...(process.platform === 'linux' ? ['--user', `${process.getuid()}:${process.getgid()}`] : []),
    '-v', `${dir}:/local`, '--entrypoint', '/bin/zeko-cli', image, ...args]);
}
if (!existsSync(`${dir}/config/circuits.json`)) {
  native(['generate-circuits-config', '--circuits-config-output', '/local/config/circuits.json', '--deploy-config-output', '/local/config/deploy.json']);
}
run(process.execPath, ['zeko-localnet/init.mjs']);
if (!existsSync(`${dir}/config/metadata.json`)) {
  const key = PublicKey.fromBase58(readFileSync(`${dir}/config/sequencer.pub`, 'utf8'));
  writeFileSync(`${dir}/config/metadata.json`, JSON.stringify({ mode: 'local-execution-only', genesisTimestamp: new Date().toISOString(), sequencerX: key.x.toString() }), { mode: 0o600 });
}
for (const name of ['circuits.json', 'deploy.json']) chmodSync(`${dir}/config/${name}`, 0o600);
const ledgerExists = existsSync(`${dir}/ledger/ledger`);
const indexExists = existsSync(`${dir}/ledger/imt`);
if (ledgerExists !== indexExists) throw new Error('Partial ledger found; refusing to overwrite it');
if (!ledgerExists && !existsSync(`${dir}/config/bootstrap.json`)) native(['load-db', '--dump-path', '/local/genesis', '--db-path', '/local/ledger']);
console.log('Native Zeko identities and ledger ready; existing state retained.');
