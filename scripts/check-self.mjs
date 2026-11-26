import { checkDecisions } from './decision-paths.mjs';
import { checkRepository, formatReport } from './self-correcting.mjs';

const report = checkRepository(process.cwd());
process.stdout.write(`${formatReport(report)}\n`);
if (report.problems.length > 0) {
  console.error('self: the rule table, weeds log or suppressions are not valid:');
  for (const problem of report.problems) console.error(`- ${problem}`);
}

const decisions = checkDecisions(process.cwd());
if (decisions.length > 0) {
  console.error('decision-paths: a live decision names a repo path that does not exist:');
  for (const problem of decisions) console.error(`- ${problem}`);
}

if (report.problems.length > 0 || decisions.length > 0) process.exit(1);
