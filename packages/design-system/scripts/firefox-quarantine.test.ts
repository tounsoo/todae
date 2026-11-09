import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import type { BrowserResults } from './browser-results-reporter.ts';
import { annotations, findFirefoxSkips, firefoxQuarantine, firefoxSkips, judge, summary, type QuarantineEntry } from './firefox-quarantine.ts';

const listed: QuarantineEntry = { file: 'src/browser/a.browser.test.tsx', test: 'A > flakes', issue: 'https://github.com/tounsoo/todae/issues/367', reason: 'Known.' };
const other = { file: 'src/browser/a.browser.test.tsx', name: 'A > works' };

function run(tests: BrowserResults['tests'], extra: Partial<BrowserResults> = {}): BrowserResults {
  return { reason: tests.some((test) => test.state === 'failed') ? 'failed' : 'passed', unhandledErrors: [], outside: [], tests, ...extra };
}

describe('the Firefox quarantine gate', () => {
  it('lets a run pass when only a quarantined test failed, and warns about it', () => {
    const verdict = judge(
      run([
        { ...other, state: 'passed', errors: [] },
        { file: listed.file, name: listed.test, state: 'failed', errors: ['AssertionError: expected 62 to be +0\n    at stack'] },
      ]),
      [listed],
      1,
    );
    expect(verdict.blocking).toEqual([]);
    expect(verdict.quarantinedFailures).toEqual([{ entry: listed, errors: ['AssertionError: expected 62 to be +0\n    at stack'] }]);
    expect(annotations(verdict)).toEqual([
      '::warning title=Quarantined Firefox test failed (https://github.com/tounsoo/todae/issues/367)::src/browser/a.browser.test.tsx > A > flakes: AssertionError: expected 62 to be +0',
    ]);
  });

  it('fails the run when a test outside the quarantine fails', () => {
    const verdict = judge(
      run([
        { ...other, state: 'failed', errors: ['Error: boom'] },
        { file: listed.file, name: listed.test, state: 'failed', errors: ['Error: known'] },
      ]),
      [listed],
      1,
    );
    expect(verdict.blocking).toEqual(['src/browser/a.browser.test.tsx > A > works failed: Error: boom']);
  });

  it('matches a quarantined test by its file as well as its name', () => {
    const verdict = judge(
      run([
        { file: 'src/browser/b.browser.test.tsx', name: listed.test, state: 'failed', errors: ['Error: same name'] },
        { file: listed.file, name: listed.test, state: 'passed', errors: [] },
      ]),
      [listed],
      1,
    );
    expect(verdict.blocking).toEqual(['src/browser/b.browser.test.tsx > A > flakes failed: Error: same name']);
  });

  it('flags a quarantined test that passed so it can come off the list', () => {
    const verdict = judge(run([{ file: listed.file, name: listed.test, state: 'passed', errors: [] }]), [listed], 0);
    expect(verdict.blocking).toEqual([]);
    expect(verdict.quarantinedPasses).toEqual([listed]);
    expect(annotations(verdict)[0]).toMatch(/^::notice title=Quarantined Firefox test passed::.*take it off the quarantine\.$/);
    expect(summary(verdict)).toContain('| src/browser/a.browser.test.tsx > A > flakes | Passed; take it off the list if it keeps passing |');
  });

  it('fails the run when a quarantined test is skipped or never finishes, since then nothing shows its failure', () => {
    for (const [state, said] of [['skipped', 'skipped'], ['pending', 'never finished']] as const) {
      const verdict = judge(run([{ file: listed.file, name: listed.test, state, errors: [] }]), [listed], 0);
      expect(verdict.blocking).toEqual([
        `The quarantine lists src/browser/a.browser.test.tsx > A > flakes, which this run ${said}. A quarantined test must run; stop skipping it or take it off the list.`,
      ]);
    }
  });

  it('fails the run when an entry names no test, so a renamed test cannot hide behind a stale entry', () => {
    const verdict = judge(run([{ ...other, state: 'passed', errors: [] }]), [listed], 0);
    expect(verdict.blocking).toEqual([
      'The quarantine lists src/browser/a.browser.test.tsx > A > flakes, which this run has no test for. Fix its name or take it off the list.',
    ]);
  });

  it('fails the run on errors outside any test, even with only quarantined failures', () => {
    const results = run([{ file: listed.file, name: listed.test, state: 'failed', errors: ['Error: known'] }], {
      unhandledErrors: ['TypeError: late\n    at x'],
      outside: [
        { file: 'src/browser/c.browser.test.tsx', suite: '', errors: ['SyntaxError: bad import'] },
        { file: listed.file, suite: 'A', errors: ['Error: afterAll broke'] },
      ],
    });
    expect(judge(results, [listed], 1).blocking).toEqual([
      'src/browser/c.browser.test.tsx failed outside its tests: SyntaxError: bad import',
      'src/browser/a.browser.test.tsx > A failed outside its tests: Error: afterAll broke',
      'Unhandled error: TypeError: late',
    ]);
  });

  it('fails an interrupted run, an empty run, and a failing exit the results do not explain', () => {
    expect(judge(run([{ ...other, state: 'passed', errors: [] }], { reason: 'interrupted' }), [], 1).blocking).toEqual([
      'The run was interrupted before every test finished.',
    ]);
    expect(judge(run([]), [], 0).blocking).toEqual(['The run reported no tests.']);
    expect(judge(run([{ ...other, state: 'passed', errors: [] }]), [], 1).blocking).toEqual(["Vitest exited with 1, which its results don't explain."]);
    const quarantinedFailure = run([{ file: listed.file, name: listed.test, state: 'failed', errors: ['Error: known'] }]);
    expect(judge(quarantinedFailure, [listed], 1).blocking).toEqual([]);
    expect(judge(quarantinedFailure, [listed], 130).blocking).toEqual(["Vitest exited with 130, which its results don't explain."]);
  });

  it('fails a list that names one test twice', () => {
    const verdict = judge(run([{ file: listed.file, name: listed.test, state: 'passed', errors: [] }]), [listed, listed], 0);
    expect(verdict.blocking).toEqual(['The quarantine lists src/browser/a.browser.test.tsx > A > flakes twice.']);
  });

  it('escapes annotation text so a multi-line message stays one annotation', () => {
    const entry = { ...listed, test: 'A > 100% done' };
    const verdict = judge(run([{ file: entry.file, name: entry.test, state: 'failed', errors: ['Error: x'] }]), [entry], 1);
    expect(annotations(verdict)[0]).toContain('A > 100%25 done');
  });
});

describe('the Firefox quarantine list', () => {
  it('points every entry at a browser test file and an issue, with a reason', () => {
    for (const entry of firefoxQuarantine) {
      expect(entry.file).toMatch(/^src\/browser\/[\w-]+\.browser\.test\.tsx$/);
      expect(entry.test).toContain(' > ');
      expect(entry.issue).toMatch(/^https:\/\/github\.com\/tounsoo\/todae\/issues\/\d+$/);
      expect(entry.reason.trim()).not.toBe('');
    }
  });
});

describe('Firefox skips', () => {
  it('finds a skip naming Firefox however it is written', () => {
    const source = [
      "const notFirefox = server.browser !== 'firefox';",
      'const alsoNot = notFirefox && true;',
      "const firefoxIt = it.skipIf(server.browser === 'firefox');",
      "it.skipIf(server.browser === 'chromium')('not Firefox', () => {});",
      '// Firefox draws this differently, but this comment skips nothing.',
      "// it.skipIf(server.browser === 'firefox')('a skip turned into a comment', () => {});",
      "/* it.skipIf(server.browser === 'firefox')('a skip in a block comment', () => {}); */",
      "describe.skipIf(server.browser === 'firefox')('a group', () => {",
      "  it.runIf(notFirefox)('through a constant', () => {});",
      "  it.runIf(alsoNot)('through a constant of a constant', () => {});",
      "  firefoxIt('through an alias', () => {});",
      "  firefoxIt.each([1])('through an alias with a table %s', () => {});",
      "  it.skipIf(['firefox'].includes(server.browser))('with a call in the condition', () => {});",
      "  it.skipIf(server.browser === 'firefox').each([1])('with a table %s', () => {});",
      '  it.skipIf(server.browser === `firefox`)("in a template", () => {});',
      "  it.skipIf(/Firefox/i.test(server.browser))('by a regex', () => {});",
      "  it('from the test body', ({ skip }) => { skip(server.browser === 'firefox'); });",
      "  it('only an assertion that differs', () => { if (server.browser === 'firefox') expect(1).toBe(1); });",
      "  it.skipIf(server.browser === 'firefox')(name, () => {});",
      '});',
    ].join('\n');
    expect(findFirefoxSkips(source).map(({ name }) => name)).toEqual([
      'a group',
      'through a constant',
      'through a constant of a constant',
      'with a call in the condition',
      'with a table %s',
      'in a template',
      'by a regex',
      '(a test with no literal name, line 19)',
      'through an alias',
      'through an alias with a table %s',
      'from the test body',
    ]);
  });

  const dir = join(import.meta.dirname, '../src/browser');
  const found = readdirSync(dir)
    .filter((name) => name.endsWith('.browser.test.tsx'))
    .flatMap((name) => findFirefoxSkips(readFileSync(join(dir, name), 'utf8')).map((skip) => ({ file: `src/browser/${name}`, ...skip })));

  it('lists every browser test that skips Firefox, so a failure cannot be silenced by a skip', () => {
    expect(found.length).toBeGreaterThan(0);
    // Count by name, so a second skip under a name already listed needs its own entry.
    const listed = new Map<string, number>();
    for (const { file, name } of firefoxSkips) listed.set(`${file} > ${name}`, (listed.get(`${file} > ${name}`) ?? 0) + 1);
    for (const { file, name, line } of found) {
      const left = listed.get(`${file} > ${name}`) ?? 0;
      expect(left, `${file}:${line} skips "${name}" by Firefox; add it to firefoxSkips with a reason, or quarantine it instead`).toBeGreaterThan(0);
      listed.set(`${file} > ${name}`, left - 1);
    }
  });

  it('keeps no entry for a skip that is gone, and gives each one a reason', () => {
    const present = new Set(found.map(({ file, name }) => `${file} > ${name}`));
    for (const entry of firefoxSkips) {
      expect(present, `firefoxSkips lists "${entry.name}" in ${entry.file}, which no longer skips Firefox`).toContain(`${entry.file} > ${entry.name}`);
      expect(entry.reason.trim()).not.toBe('');
    }
  });
});
