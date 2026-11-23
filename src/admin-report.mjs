import { readFileSync } from 'node:fs';
const org=process.argv[2];
if(!['a','b'].includes(org))throw new Error('Usage: npm run admin:report -- a|b (run on the company host for SSH workers)');
const report=JSON.parse(readFileSync(`.local/company-${org}/admin-report.json`));
console.log(`Company ${org.toUpperCase()} administrator — synthetic case ${report.caseId}`);
console.log(`Identity: ${report.identityHandshake}`);
for(const [name,messages] of Object.entries(report.rooms)) {
  console.log(`\n${name} (${messages.length} local send/receive records)`);
  for(const m of messages)console.log(`  ${m.direction}: ${m.sender} → ${m.recipient}: ${m.summary}`);
}
console.log('\nPrivate model advice');
for(const a of report.modelAdvice)console.log(`  ${a.role}/${a.action} [${a.mode}, ${a.decision}]: ${a.rationale}`);
