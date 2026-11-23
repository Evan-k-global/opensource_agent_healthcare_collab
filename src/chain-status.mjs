import { setTimeout } from 'node:timers/promises';
const endpoint = process.env.MINA_GRAPHQL ?? 'http://127.0.0.1:18080/graphql';
if (!['127.0.0.1', 'localhost'].includes(new URL(endpoint).hostname)) throw new Error('local_node_required');
const deadline = Date.now() + 5 * 60 * 1000;
let previous;
while (Date.now() < deadline) {
  try {
    const response = await fetch(endpoint, { method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ query: '{ syncStatus daemonStatus { blockchainLength } }' }), signal: AbortSignal.timeout(5000) });
    const value = await response.json();
    if (value.data?.syncStatus === 'SYNCED') { console.log(JSON.stringify(value.data, null, 2)); process.exit(0); }
    const status = value.data?.syncStatus ?? 'waiting for GraphQL';
    if (status !== previous) console.error(status); previous = status;
  } catch { if (previous !== 'starting') console.error('Waiting for local node startup'); previous = 'starting'; }
  await setTimeout(5000);
}
throw new Error('local_node_not_ready_after_five_minutes');
