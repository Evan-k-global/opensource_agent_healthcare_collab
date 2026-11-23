import { ResearchSession, steps } from './session.mjs';
const session = new ResearchSession({ proofsEnabled: process.argv.includes('--proofs'), lightnet: process.argv.includes('--lightnet'), zeko: process.argv.includes('--zeko') });
try {
  await session.initialize();
  for (const [id, description] of steps) {
    console.error(`[${session.index + 1}/${steps.length}] ${id}: ${description}`);
    await session.takeTurn(id);
  }
  console.log(JSON.stringify(session.report, null, 2));
} finally { session.close(); }
