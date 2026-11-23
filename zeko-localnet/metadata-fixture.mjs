// Development metadata only: no Mina/Ethereum node, settlement, or outbound HTTP.
// The pinned Zeko executable requires a Mina-shaped bootstrap API even when
// commits are disabled. This fixture does NOT implement a settlement chain.
import http from 'node:http';
import { readFileSync } from 'node:fs';
const configDir = process.env.CONFIG_DIR ?? '/config';
const read = name => JSON.parse(readFileSync(`${configDir}/${name}.json`));
const publicConfig = () => read('metadata');
http.createServer(async (req, res) => {
  res.setHeader('content-type', 'application/json');
  try {
    if (req.method !== 'POST') throw new Error('post_required');
    let body = ''; for await (const chunk of req) { body += chunk; if (Buffer.byteLength(body) > 65536) throw new Error('request_too_large'); }
    const { query = '', variables = {} } = JSON.parse(body);
    if (/\bmutation\b/i.test(query)) throw new Error('settlement_disabled');
    const metadata = publicConfig();
    const anchor = read('circuits').zeko_l1;
    let bootstrap; try { bootstrap = read('bootstrap'); } catch { bootstrap = { ledgerRoot: '0' }; }
    let data;
    if (/\bruntimeConfig\b/.test(query)) data = { runtimeConfig: { proof: { fork: { global_slot_since_genesis: 0 } } } };
    else if (/\bgenesisConstants\b/.test(query)) data = { genesisConstants: { genesisTimestamp: metadata.genesisTimestamp, accountCreationFee: '1000000000' } };
    else if (/\bpooledZkappCommands\b/.test(query)) data = { pooledZkappCommands: [] };
    else if (/\bactions\s*\(/.test(query) && variables.pk === anchor) data = { actions: [] };
    else if (/\baccount\s*\(/.test(query) && variables.pk === anchor) {
      data = { account: { zkappState: [metadata.sequencerX, '0', bootstrap.ledgerRoot, '0', '0', metadata.sequencerX, '0', '0'] } };
    } else throw new Error('unsupported_bootstrap_query');
    res.end(JSON.stringify({ data }));
  } catch (error) { res.writeHead(400); res.end(JSON.stringify({ errors: [{ message: error.message }] })); }
}).listen(Number(process.env.PORT ?? 8080), '0.0.0.0');
