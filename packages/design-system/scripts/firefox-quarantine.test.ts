import { describe, expect, it } from 'vitest';
import type { BrowserResults } from './browser-results-reporter.ts';
import { annotations, firefoxQuarantine, judge, summary, type QuarantineEntry } from './firefox-quarantine.ts';

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
