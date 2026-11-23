// SSH encrypts and authenticates the existing JSON-line company RPC stream.
// Use SSH host aliases with pinned known_hosts and independent OS accounts.
const quote = value => "'" + value.replaceAll("'", "'\\''") + "'";
export function sshWorkerArgs(org, entry) {
  if (!['a','b'].includes(org) || !/^[A-Za-z0-9][A-Za-z0-9_.@-]*$/.test(entry.host ?? '') || !entry.directory?.startsWith('/') || /[\r\n\0]/.test(entry.directory)) throw new Error('invalid_remote_worker_configuration');
  if (!['off','gemma','mock',undefined].includes(entry.intelligence)) throw new Error('invalid_remote_intelligence');
  const env = [`COMPANY=${org}`, `AGENT_INTELLIGENCE=${entry.intelligence ?? 'off'}`];
  if (entry.model) env.push(`GEMMA_MODEL=${quote(entry.model)}`);
  if (entry.modelBaseUrl) {
    const url = new URL(entry.modelBaseUrl);
    if (!['localhost','127.0.0.1'].includes(url.hostname) || url.protocol !== 'http:') throw new Error('remote_model_must_be_company_local');
    env.push(`GEMMA_BASE_URL=${quote(entry.modelBaseUrl)}`);
  }
  const command = `cd ${quote(entry.directory)} && exec env ${env.join(' ')} node src/company-worker.mjs`;
  return ['-T','-o','BatchMode=yes','-o','StrictHostKeyChecking=yes','-o','ConnectTimeout=10',entry.host,command];
}
