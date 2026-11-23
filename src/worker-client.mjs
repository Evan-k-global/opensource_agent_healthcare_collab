import { sshWorkerArgs } from './remote-worker.mjs';
import { fork, spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { createInterface } from 'node:readline';
import { resolve } from 'node:path';
import { mkdirSync, readFileSync } from 'node:fs';
export function startCompany(org, options = {}) {
  const remote = process.env.COMPANY_REMOTE_CONFIG ? JSON.parse(readFileSync(process.env.COMPANY_REMOTE_CONFIG))[org] : null;
  if (process.env.COMPANY_REMOTE_CONFIG && !remote) throw new Error(`remote_company_${org}_missing`);
  const docker = process.env.WORKER_ISOLATION === 'docker';
  const output = resolve(`.local/company-${org}`), cache = resolve(`.cache/company-${org}`);
  mkdirSync(output, { recursive: true, mode: 0o700 }); mkdirSync(cache, { recursive: true });
  if (remote && docker) throw new Error('choose_remote_or_docker_workers');
  if (docker && process.env.AGENT_INTELLIGENCE && process.env.AGENT_INTELLIGENCE !== 'off') throw new Error('network_disabled_worker_requires_intelligence_off; use company-local SSH workers for Gemma');
  const child = remote ? spawn('ssh', [...(process.env.COMPANY_SSH_CONFIG ? ['-F', resolve(process.env.COMPANY_SSH_CONFIG)] : []), ...sshWorkerArgs(org, remote)], { stdio: ['pipe', 'pipe', 'inherit'] }) : docker ? spawn('docker', [
    'run', '--rm', '-i', '--network', 'none', '--cap-drop', 'ALL', '--security-opt', 'no-new-privileges', '--memory', '5g',
    '--read-only', '--tmpfs', '/tmp:rw,nosuid,size=256m',
    '--mount', `type=bind,src=${resolve(`fixtures/company-${org}`)},dst=/company,readonly`,
    '--mount', `type=bind,src=${output},dst=/output`,
    '--mount', `type=bind,src=${cache},dst=/app/.cache`,
    '-e', `COMPANY=${org}`, '-e', 'COMPANY_DATA=/company', '-e', 'COMPANY_OUTPUT=/output',
    'research-collab-demo:local',
  ], { stdio: ['pipe', 'pipe', 'inherit'] }) : fork(new URL('./company-worker.mjs', import.meta.url), [], {
    env: { ...process.env, COMPANY: org, ...options.env }, stdio: ['ignore', 'ignore', 'inherit', 'ipc'],
  });
  const waiting = new Map();
  let stopped;
  const receive = m => {
    const pending = waiting.get(m.id); if (!pending) return;
    waiting.delete(m.id); clearTimeout(pending.timer);
    if (m.error) pending.reject(new Error(m.error)); else pending.resolve(m.result);
  };
  if (docker || remote) createInterface({ input: child.stdout }).on('line', line => { try { receive(JSON.parse(line)); } catch { /* Nonprotocol diagnostic. */ } });
  else child.on('message', receive);
  const fail = error => {
    stopped = error;
    for (const p of waiting.values()) { clearTimeout(p.timer); p.reject(error); }
    waiting.clear();
  };
  child.on('error', fail);
  child.on('exit', code => fail(new Error(`company_${org}_exited:${code}`)));
  child.stdin?.on('error', fail);
  return {
    call(method, params = {}) {
      if (stopped) return Promise.reject(stopped);
      const id = randomUUID();
      return new Promise((resolve, reject) => {
        const timer = setTimeout(() => { waiting.delete(id); reject(new Error(`company_${org}_${method}_timeout`)); }, 20 * 60 * 1000);
        waiting.set(id, { resolve, reject, timer });
        if (docker || remote) child.stdin.write(JSON.stringify({ id, method, params }) + '\n');
        else child.send({ id, method, params });
      });
    },
    close() { if (docker || remote) child.stdin.end(); child.kill('SIGTERM'); },
  };
}
