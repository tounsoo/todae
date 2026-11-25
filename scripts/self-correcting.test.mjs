import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';
import { checkRepository, formatReport } from './self-correcting.mjs';

const NOW = new Date('2026-11-16T12:00:00.000Z');
const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dirs = [];

function lineComment(body) {
  return '// ' + body;
}

function eslintNext(rest) {
  return 'eslint-disable-next-line ' + rest;
}

function tempRepo(files) {
  const dir = mkdtempSync(path.join(tmpdir(), 'self-'));
  dirs.push(dir);
  for (const [name, text] of Object.entries(files)) {
    const full = path.join(dir, name);
    mkdirSync(path.dirname(full), { recursive: true });
    writeFileSync(full, text);
  }
  return dir;
}

function validFiles() {
  return {
    'package.json': `${JSON.stringify({ scripts: { 'check:sample': 'node -e 0' } })}\n`,
    'tools/sample.mjs': 'export {}\n',
    'AGENTS.md': [
      '## Rule table',
      '',
      'Tier: T0',
      '',
      '| ID | Rule | Enforcer | Evidence | Status |',
      '| --- | --- | --- | --- | --- |',
      '| sample-rule | The sample check passes. | `npm run check:sample`, `tools/sample.mjs#usage` | #1 | enforced |',
      '',
    ].join('\n'),
    '.agents/weeds.tsv': 'date\tclass\tref\tcaught_by\tnote\n2026-11-01\tother-class\t#2\treview\tA review found it.\n',
    '.agents/suppression-baseline.json': '{"total":0,"unannotated":0}\n',
    'src/mention.ts': `const label = ${JSON.stringify(lineComment(eslintNext('no-console')))};\n`,
  };
}

afterEach(() => {
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

describe('checkRepository', () => {
  it('passes a well-formed repository and prints the machine-caught share', () => {
    const report = checkRepository(tempRepo(validFiles()), NOW);
    assert.deepEqual(report.problems, []);
    assert.match(formatReport(report), /machine-caught: 0% \(0\/1\)/);
    assert.match(formatReport(report), /text: none/);
    assert.match(formatReport(report), /seen twice without enforcement: none/);
  });

  it('counts an enforced weeds class and ignores a seeded row', () => {
    const enforced = validFiles();
    enforced['AGENTS.md'] = (enforced['AGENTS.md'] ?? '').replace('sample-rule', 'other-class');
    assert.match(formatReport(checkRepository(tempRepo(enforced), NOW)), /machine-caught: 100% \(1\/1\)/);

    const seeded = validFiles();
    seeded['AGENTS.md'] = (seeded['AGENTS.md'] ?? '').replace('sample-rule', 'other-class').replace('| enforced |', '| seeded |');
    const seededReport = checkRepository(tempRepo(seeded), NOW);
    assert.deepEqual(seededReport.problems, []);
    assert.match(formatReport(seededReport), /machine-caught: 0% \(0\/1\)/);
  });

  it('accepts pnpm and script enforcers', () => {
    const files = validFiles();
    files['AGENTS.md'] = (files['AGENTS.md'] ?? '').replace('`npm run check:sample`', '`pnpm check:sample`, `script:check:sample`');
    assert.deepEqual(checkRepository(tempRepo(files), NOW).problems, []);
  });

  it('fails a malformed rule table', () => {
    const files = validFiles();
    files['AGENTS.md'] = ['## Rule table', '', 'Tier: T0', '', '| ID | Rule | Enforcer | Status |', '| --- | --- | --- | --- |', ''].join('\n');
    const problems = checkRepository(tempRepo(files), NOW).problems.join('\n');
    assert.match(problems, /rule table header must be/);
  });

  it('fails a row with no evidence and a duplicated id', () => {
    const files = validFiles();
    files['AGENTS.md'] = [
      '## Rule table',
      '',
      'Tier: T0',
      '',
      '| ID | Rule | Enforcer | Evidence | Status |',
      '| --- | --- | --- | --- | --- |',
      '| sample-rule | The sample check passes. | `npm run check:sample` |  | enforced |',
      '| sample-rule | Again. | `npm run check:sample` | #1 | enforced |',
      '',
    ].join('\n');
    const problems = checkRepository(tempRepo(files), NOW).problems.join('\n');
    assert.match(problems, /evidence "" is not a pull request/);
    assert.match(problems, /id "sample-rule" is duplicated/);
  });

  it('fails a bad weeds row', () => {
    const files = validFiles();
    files['.agents/weeds.tsv'] = 'date\tclass\tref\tcaught_by\tnote\nnot-a-date\tBad Class\tnope\tci\t\n';
    const problems = checkRepository(tempRepo(files), NOW).problems.join('\n');
    assert.match(problems, /caught_by "ci"/);
    assert.match(problems, /is not YYYY-MM-DD/);
    assert.match(problems, /note is empty/);
  });

  it('fails a weeds row dated after today in Pacific time', () => {
    const files = validFiles();
    const dir = tempRepo(files);
    const stillToday = new Date('2026-11-17T07:30:00.000Z');
    assert.deepEqual(checkRepository(dir, stillToday).problems, []);
    writeFileSync(
      path.join(dir, '.agents/weeds.tsv'),
      'date\tclass\tref\tcaught_by\tnote\n2026-11-17\tother-class\t#2\treview\tDated tomorrow in Pacific time.\n',
    );
    assert.match(checkRepository(dir, stillToday).problems.join('\n'), /date "2026-11-17" is after today/);
  });

  it('fails a suppression over the baseline', () => {
    const files = validFiles();
    const dir = tempRepo(files);
    assert.deepEqual(checkRepository(dir, NOW).problems, []);
    writeFileSync(path.join(dir, 'src/loose.ts'), `${lineComment(eslintNext('no-console'))}\n`);
    const problems = checkRepository(dir, NOW).problems.join('\n');
    assert.match(problems, /total 1 is above the baseline 0/);
  });

  it('ignores a suppression in generated or vendored output', () => {
    const files = validFiles();
    files['dist/built.ts'] = `${lineComment(eslintNext('no-console'))}\n`;
    files['.claude/vendor.ts'] = `${lineComment('@ts-ignore')}\n`;
    files['src/tokens.generated.ts'] = `${lineComment('biome-ignore lint: x')}\n`;
    const report = checkRepository(tempRepo(files), NOW);
    assert.deepEqual(report.problems, []);
    assert.equal(report.suppressions.total, 0);
  });

  it('fails an unannotated suppression over its baseline', () => {
    const files = validFiles();
    files['.agents/suppression-baseline.json'] = '{"total":1,"unannotated":0}\n';
    const dir = tempRepo(files);
    assert.deepEqual(checkRepository(dir, NOW).problems, []);
    writeFileSync(path.join(dir, 'src/loose.ts'), `${lineComment(eslintNext('no-console'))}\n`);
    const problems = checkRepository(dir, NOW).problems.join('\n');
    assert.match(problems, /unannotated 1 is above the baseline 0/);
    assert.doesNotMatch(problems, /total 1 is above the baseline/);
  });

  it('fails an expired annotated suppression', () => {
    const files = validFiles();
    files['.agents/suppression-baseline.json'] = '{"total":1,"unannotated":0}\n';
    files['src/old.ts'] = `${lineComment(`${eslintNext('no-console')} -- why: waiting on a type; expires: 2020-01-01; approved: #9`)}\n`;
    const problems = checkRepository(tempRepo(files), NOW).problems.join('\n');
    assert.match(problems, /expired on 2020-01-01/);
    assert.doesNotMatch(problems, /above the baseline/);
  });

  it('fails an annotated suppression with no reason', () => {
    const files = validFiles();
    files['.agents/suppression-baseline.json'] = '{"total":1,"unannotated":0}\n';
    files['src/bare.ts'] = `${lineComment(`${eslintNext('no-console')} -- why: ; expires: 2026-12-01; approved: #9`)}\n`;
    assert.match(checkRepository(tempRepo(files), NOW).problems.join('\n'), /has no reason/);
  });

  it('fails an annotated suppression with no approval', () => {
    const files = validFiles();
    files['.agents/suppression-baseline.json'] = '{"total":1,"unannotated":0}\n';
    files['src/unapproved.ts'] = `${lineComment(`${eslintNext('no-console')} -- why: waiting on a type; expires: 2026-12-01`)}\n`;
    const problems = checkRepository(tempRepo(files), NOW).problems.join('\n');
    assert.match(problems, /has no approval/);
    assert.doesNotMatch(problems, /above the baseline/);
  });

  it('fails an annotated suppression that expires more than 90 days out', () => {
    const files = validFiles();
    files['.agents/suppression-baseline.json'] = '{"total":1,"unannotated":0}\n';
    files['src/far.ts'] = `${lineComment(`${eslintNext('no-console')} -- why: a long waiver; expires: 2027-11-16; approved: #9`)}\n`;
    assert.match(checkRepository(tempRepo(files), NOW).problems.join('\n'), /more than 90 days out/);
  });

  it('fails when an enforcer does not resolve', () => {
    const files = validFiles();
    files['AGENTS.md'] = (files['AGENTS.md'] ?? '').replace('`npm run check:sample`, `tools/sample.mjs#usage`', '`pnpm check:missing`');
    assert.match(checkRepository(tempRepo(files), NOW).problems.join('\n'), /enforcer `pnpm check:missing` does not resolve/);

    const missingFile = validFiles();
    missingFile['AGENTS.md'] = (missingFile['AGENTS.md'] ?? '').replace(
      '`npm run check:sample`, `tools/sample.mjs#usage`',
      '`tools/missing.mjs`',
    );
    assert.match(checkRepository(tempRepo(missingFile), NOW).problems.join('\n'), /enforcer `tools\/missing.mjs` does not resolve/);

    const missingRule = validFiles();
    missingRule['eslint.config.mjs'] = 'export default [{ rules: { "no-console": "error" } }];\n';
    missingRule['AGENTS.md'] = (missingRule['AGENTS.md'] ?? '').replace(
      '`npm run check:sample`, `tools/sample.mjs#usage`',
      '`eslint:todae/missing`',
    );
    assert.match(checkRepository(tempRepo(missingRule), NOW).problems.join('\n'), /enforcer `eslint:todae\/missing` does not resolve/);

    const namedRule = validFiles();
    namedRule['eslint.config.mjs'] = "export default [{ rules: { 'todae/layer-imports': 'error' } }];\n";
    namedRule['AGENTS.md'] = (namedRule['AGENTS.md'] ?? '').replace(
      '`npm run check:sample`, `tools/sample.mjs#usage`',
      '`eslint:todae/layer-imports`',
    );
    assert.deepEqual(checkRepository(tempRepo(namedRule), NOW).problems, []);

    const missingOption = validFiles();
    missingOption['tsconfig.json'] = '{"compilerOptions":{"strict":true}}\n';
    missingOption['AGENTS.md'] = (missingOption['AGENTS.md'] ?? '').replace(
      '`npm run check:sample`, `tools/sample.mjs#usage`',
      '`tsconfig:noImplicitAny`',
    );
    assert.match(
      checkRepository(tempRepo(missingOption), NOW).problems.join('\n'),
      /enforcer `tsconfig:noImplicitAny` does not resolve/,
    );

    const strictOption = validFiles();
    strictOption['tsconfig.json'] = '{"compilerOptions":{"strict":true}}\n';
    strictOption['AGENTS.md'] = (strictOption['AGENTS.md'] ?? '').replace(
      '`npm run check:sample`, `tools/sample.mjs#usage`',
      '`tsconfig:strict`',
    );
    assert.deepEqual(checkRepository(tempRepo(strictOption), NOW).problems, []);
  });

  it('fails when a seeded or enforced row has no machine enforcer', () => {
    const seeded = validFiles();
    seeded['AGENTS.md'] = (seeded['AGENTS.md'] ?? '').replace(
      '`npm run check:sample`, `tools/sample.mjs#usage` | #1 | enforced |',
      'text | #1 | seeded |',
    );
    assert.match(checkRepository(tempRepo(seeded), NOW).problems.join('\n'), /status is seeded but the enforcer is text/);

    const enforced = validFiles();
    enforced['AGENTS.md'] = (enforced['AGENTS.md'] ?? '').replace(
      '`npm run check:sample`, `tools/sample.mjs#usage` | #1 | enforced |',
      'text | #1 | enforced |',
    );
    assert.match(checkRepository(tempRepo(enforced), NOW).problems.join('\n'), /status is enforced but the enforcer is text/);

    const textRow = validFiles();
    textRow['AGENTS.md'] = (textRow['AGENTS.md'] ?? '').replace(
      '`npm run check:sample`, `tools/sample.mjs#usage` | #1 | enforced |',
      '`npm run check:sample` | #1 | text |',
    );
    const textProblems = checkRepository(tempRepo(textRow), NOW).problems.join('\n');
    assert.match(textProblems, /status is text but the enforcer is not text/);
  });

  it('fails a repeat of an enforced class at T1 and prints classes seen twice', () => {
    const files = validFiles();
    files['AGENTS.md'] = (files['AGENTS.md'] ?? '').replace('Tier: T0', 'Tier: T1');
    files['.agents/weeds.tsv'] = [
      'date\tclass\tref\tcaught_by\tnote',
      '2026-11-10\tsample-rule\t#3\treview\tThe check missed it once.',
      '2026-11-12\tsample-rule\t#4\treview\tThe check missed it again.',
      '',
    ].join('\n');
    const atT1 = checkRepository(tempRepo(files), NOW);
    assert.ok(atT1.problems.length > 0);
    assert.match(atT1.problems.join('\n'), /T1: enforced class "sample-rule"/);
    assert.match(formatReport(atT1), /repeats: 1/);
    assert.match(formatReport(atT1), /seen twice without enforcement: none/);

    files['AGENTS.md'] = (files['AGENTS.md'] ?? '').replace('Tier: T1', 'Tier: T0');
    const atT0 = checkRepository(tempRepo(files), NOW);
    assert.deepEqual(atT0.problems, []);
    assert.match(formatReport(atT0), /repeats: 1/);

    const seeded = validFiles();
    seeded['AGENTS.md'] = (seeded['AGENTS.md'] ?? '').replace('Tier: T0', 'Tier: T1').replace('| enforced |', '| seeded |');
    seeded['.agents/weeds.tsv'] = files['.agents/weeds.tsv'];
    const seededAtT1 = checkRepository(tempRepo(seeded), NOW);
    assert.deepEqual(seededAtT1.problems, []);
    assert.match(formatReport(seededAtT1), /seen twice without enforcement: sample-rule/);
  });

  it('prints a text row', () => {
    const files = validFiles();
    files['AGENTS.md'] = [
      '## Rule table',
      '',
      'Tier: T0',
      '',
      '| ID | Rule | Enforcer | Evidence | Status |',
      '| --- | --- | --- | --- | --- |',
      '| sample-rule | The sample check passes. | `npm run check:sample` | #1 | enforced |',
      '| ask-before-tokens | Design tokens change only with a yes. | text | #8 | text |',
      '',
    ].join('\n');
    const report = checkRepository(tempRepo(files), NOW);
    assert.deepEqual(report.problems, []);
    assert.match(formatReport(report), /text: ask-before-tokens/);
  });

  it('passes this repository', () => {
    const report = checkRepository(repoRoot);
    assert.deepEqual(report.problems, []);
    assert.match(formatReport(report), /^machine-caught: /);
  });
});
