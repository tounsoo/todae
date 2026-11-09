import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import type { BrowserResults } from './browser-results-reporter.ts';
import { annotations, firefoxBranches, firefoxLines, firefoxQuarantine, judge, summary, type QuarantineEntry } from './firefox-quarantine.ts';

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

describe('Firefox branches in browser tests', () => {
  it('finds every line of code that names Firefox, and none in a comment', () => {
    const source = [
      "const isFirefox = server.browser === 'firefox';",
      "it.skipIf(isFirefox)('through a constant', () => {});",
      "it.skipIf(server.browser === 'chromium')('another engine only', () => {});",
      '// Firefox draws this differently, but a comment changes nothing.',
      "/* it.skipIf(server.browser === 'firefox')('a skip in a block comment', () => {}); */",
      "const images = '**/*.png';",
      "it('in options', { skip: server.browser === 'firefox' }, () => {});",
      "const fonts = '**/*.woff2'; // a URL like 'https://example.com' isn't a comment",
      "it('from the body', ({ skip }) => { if (/Firefox\\//.test(navigator.userAgent)) skip(); });",
      "it.skipIf(server.browser === 'firefox')( // Firefox can't start the drag",
      "  'with a comment after it',",
      ');',
    ].join('\n');
    expect(firefoxLines(source).map(({ line }) => line)).toEqual([1, 2, 7, 9, 10]);
    expect(firefoxLines(source)[4]!.text).toBe("it.skipIf(server.browser === 'firefox')(");
  });

  const root = join(import.meta.dirname, '../src');
  const files = (readdirSync(root, { recursive: true }) as string[]).filter((name) => /\.browser\.test\.tsx?$/.test(name));
  const found = files.flatMap((name) => firefoxLines(readFileSync(join(root, name), 'utf8')).map((line) => ({ file: `src/${name.split('\\').join('/')}`, ...line })));

  it('lists every line of a browser test that treats Firefox apart, so a failure cannot be silenced by a skip', () => {
    expect(found.length).toBeGreaterThan(0);
    const unlisted = found.filter(({ file, text }) => !firefoxBranches.some((branch) => branch.file === file && text.includes(branch.code)));
    expect(
      unlisted.map(({ file, line, text }) => `${file}:${line} ${text}`),
      'These lines treat Firefox apart; add each to firefoxBranches with a reason, or quarantine the test instead',
    ).toEqual([]);
  });

  it('keeps no entry for a line that is gone, none twice, and gives each one a reason', () => {
    const keys = firefoxBranches.map(({ file, code }) => `${file} > ${code}`);
    expect(keys.filter((key, i) => keys.indexOf(key) !== i)).toEqual([]);
    for (const branch of firefoxBranches) {
      expect(
        found.some(({ file, text }) => file === branch.file && text.includes(branch.code)),
        `firefoxBranches lists "${branch.code}" in ${branch.file}, which no line there has any more`,
      ).toBe(true);
      expect(branch.reason.trim()).not.toBe('');
    }
  });
});
