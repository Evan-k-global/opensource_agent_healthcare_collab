import { setTimeout } from 'node:timers/promises';
const endpoint = process.env.LOCAL_ZEKO_GRAPHQL ?? 'http://127.0.0.1:19230/graphql';
if (!['127.0.0.1', 'localhost'].includes(new URL(endpoint).hostname)) throw new Error('local_node_required');
const deadline = Date.now() + 5 * 60 * 1000;
console.error('Waiting for native Zeko GraphQL');
while (Date.now() < deadline) {
  try {
    const response = await fetch(endpoint, { method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ query: '{ sequencerPk signatureKind }' }), signal: AbortSignal.timeout(5000) });
    const { data } = await response.json();
    if (data?.sequencerPk && data.signatureKind === 'testnet') { console.log(JSON.stringify({ endpoint, ...data }, null, 2)); process.exit(0); }
  } catch {}
  await setTimeout(3000);
}
throw new Error('Zeko not ready after five minutes; inspect npm run zeko:logs');
