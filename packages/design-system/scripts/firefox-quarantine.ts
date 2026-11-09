#!/usr/bin/env node
import { appendFileSync, readFileSync, realpathSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { parseArgs } from 'node:util';
import type { BrowserResults } from './browser-results-reporter.ts';

const ISSUE = 'https://github.com/tounsoo/todae/issues/367';

export interface QuarantineEntry {
  /** Test file, relative to packages/design-system. */
  file: string;
  /** Vitest's full name for the test: its describe blocks and its own name, joined by " > ". */
  test: string;
  /** The issue that tracks the failure. */
  issue: string;
  reason: string;
}

/**
 * The Firefox quarantine: browser tests whose Firefox failures are known and
 * tracked in issue 367. In the CI Firefox run they still run, and a failure
 * shows as a warning instead of failing the job. Any other Firefox failure
 * still fails it, and Chromium and WebKit treat these tests like any other.
 *
 * An entry comes off when its fix lands, or when the run summary shows it
 * passing run after run. By 1.0 this list must be empty and Firefox
 * fully blocking again.
 */
export const firefoxQuarantine: readonly QuarantineEntry[] = [
  {
    file: 'src/browser/mentions.browser.test.tsx',
    test: 'useMentions in a browser > draws a token behind its own text, wrapped and scrolled like the textarea',
    issue: ISSUE,
    reason: 'Intermittent: the highlight layer keeps its scroll offset after the textarea scrolls back to the top.',
  },
  {
    file: 'src/browser/contents.browser.test.tsx',
    test: 'Contents in a browser > drops a pick once its section has been in view and leaves it',
    issue: ISSUE,
    reason: 'Intermittent: the pick is not dropped when the box scrolls back to the top.',
  },
  {
    file: 'src/browser/motion.browser.test.tsx',
    test: 'A tip opened during an overlay enter motion > stays by its trigger while a Drawer at start slides in, rtl',
    issue: ISSUE,
    reason: 'An anchor-centered tip lands far from its trigger in a right-to-left Drawer.',
  },
  {
    file: 'src/browser/scrollEdges.browser.test.tsx',
    test: 'scroll edge arrows > in a tab list > keep a tab that arrow keys focus in view, clear of the arrows, dir rtl',
    issue: ISSUE,
    reason: 'Arrows go stale after keyboard focus scrolls a right-to-left tab list: back at its start, it still shows only the start arrow.',
  },
];

export interface FirefoxSkip {
  /** Test file, relative to packages/design-system. */
  file: string;
  /** The name the skipped `it` or `describe` is given, as written in the file. */
  name: string;
  reason: string;
}

/**
 * Browser tests that a `skipIf` or `runIf` naming Firefox keeps from running
 * there, because Firefox can't do what they test. A test that fails in
 * Firefox goes on the quarantine above instead, so it still runs and shows.
 * A unit test checks that every skip naming Firefox in a browser test is here.
 */
export const firefoxSkips: readonly FirefoxSkip[] = [
  {
    file: 'src/browser/one-time-code.browser.test.tsx',
    name: 'copies text dragged inside the field to the box it is dropped on',
    reason: "Playwright's Firefox starts no native drag from a text control's selection.",
  },
  {
    file: 'src/browser/fill-feedback-motion.browser.test.tsx',
    name: 'Progress and Meter fill motion',
    reason: 'Firefox draws the fill with no part to transition, and motion only has to work in Chrome.',
  },
];

export interface Verdict {
  /** What fails the job, one line each. */
  blocking: string[];
  /** Quarantined tests that failed this run. */
  quarantinedFailures: { entry: QuarantineEntry; errors: string[] }[];
  /** Quarantined tests that passed this run. */
  quarantinedPasses: QuarantineEntry[];
}

const key = (file: string, name: string) => `${file}\n${name}`;
const label = (file: string, name: string) => `${file} > ${name}`;
const firstLine = (errors: string[]) => (errors[0] ?? 'no error message').split('\n')[0];

/** Splits a Firefox run's results into what blocks the job and what the quarantine covers. */
export function judge(results: BrowserResults, list: readonly QuarantineEntry[], vitestExit: number): Verdict {
  const verdict: Verdict = { blocking: [], quarantinedFailures: [], quarantinedPasses: [] };
  const entries = new Map<string, QuarantineEntry>();
  for (const entry of list) {
    const id = key(entry.file, entry.test);
    if (entries.has(id)) verdict.blocking.push(`The quarantine lists ${label(entry.file, entry.test)} twice.`);
    entries.set(id, entry);
  }

  const seen = new Set<string>();
  let failures = 0;
  for (const test of results.tests) {
    const id = key(test.file, test.name);
    const entry = entries.get(id);
    if (test.state === 'failed') failures++;
    if (!entry) {
      if (test.state === 'failed') verdict.blocking.push(`${label(test.file, test.name)} failed: ${firstLine(test.errors)}`);
      continue;
    }
    seen.add(id);
    if (test.state === 'failed') verdict.quarantinedFailures.push({ entry, errors: test.errors });
    else if (test.state === 'passed') verdict.quarantinedPasses.push(entry);
    // A quarantined test still runs, so a skip would hide what the quarantine is there to show.
    else verdict.blocking.push(`The quarantine lists ${label(entry.file, entry.test)}, which this run ${test.state === 'skipped' ? 'skipped' : 'never finished'}. A quarantined test must run; stop skipping it or take it off the list.`);
  }

  for (const [id, entry] of entries) {
    if (!seen.has(id)) verdict.blocking.push(`The quarantine lists ${label(entry.file, entry.test)}, which this run has no test for. Fix its name or take it off the list.`);
  }
  for (const { file, suite, errors } of results.outside) verdict.blocking.push(`${suite ? label(file, suite) : file} failed outside its tests: ${firstLine(errors)}`);
  for (const error of results.unhandledErrors) verdict.blocking.push(`Unhandled error: ${firstLine([error])}`);
  if (results.reason === 'interrupted') verdict.blocking.push('The run was interrupted before every test finished.');
  if (results.tests.length === 0) verdict.blocking.push('The run reported no tests.');
  // A failure the results don't show still fails the job. Vitest exits with 1 when a test fails, so a
  // quarantined failure can explain a 1, but no other code.
  if (vitestExit !== 0 && verdict.blocking.length === 0 && (failures === 0 || vitestExit !== 1)) {
    verdict.blocking.push(`Vitest exited with ${vitestExit}, which its results don't explain.`);
  }
  return verdict;
}

/** Escapes text for a GitHub Actions workflow command. */
const escape = (text: string) => text.replace(/%/g, '%25').replace(/\r/g, '%0D').replace(/\n/g, '%0A');

export function annotations(verdict: Verdict): string[] {
  return [
    ...verdict.blocking.map((line) => `::error title=Firefox browser tests::${escape(line)}`),
    ...verdict.quarantinedFailures.map(
      ({ entry, errors }) => `::warning title=Quarantined Firefox test failed (${entry.issue})::${escape(`${label(entry.file, entry.test)}: ${firstLine(errors)}`)}`,
    ),
    ...verdict.quarantinedPasses.map(
      (entry) => `::notice title=Quarantined Firefox test passed::${escape(`${label(entry.file, entry.test)} passed. If it keeps passing, take it off the quarantine.`)}`,
    ),
  ];
}

const cell = (text: string) => text.replace(/\|/g, '\\|').replace(/\n/g, ' ');

export function summary(verdict: Verdict): string {
  const rows = [
    ...verdict.quarantinedFailures.map(({ entry, errors }) => [entry, `Failed: ${firstLine(errors)}`] as const),
    ...verdict.quarantinedPasses.map((entry) => [entry, 'Passed; take it off the list if it keeps passing'] as const),
  ];
  const lines = ['## Firefox quarantine', ''];
  lines.push(
    verdict.blocking.length
      ? `${verdict.blocking.length} Firefox ${verdict.blocking.length === 1 ? 'problem fails' : 'problems fail'} the job:`
      : 'No Firefox failure outside the quarantine.',
  );
  if (verdict.blocking.length) lines.push('', ...verdict.blocking.map((line) => `- ${cell(line)}`));
  if (rows.length) {
    lines.push('', 'Quarantined tests warn instead of failing the job. By 1.0 the quarantine must be empty and Firefox fully blocking again.', '');
    lines.push('| Test | This run | Why |', '| --- | --- | --- |');
    for (const [entry, result] of rows) lines.push(`| ${cell(label(entry.file, entry.test))} | ${cell(result)} | ${cell(entry.reason)} ([issue](${entry.issue})) |`);
  }
  return `${lines.join('\n')}\n`;
}

const USAGE = `Usage: firefox-quarantine.ts --results <file> --vitest-exit <code> [--summary <file>]

Reads the results browser-results-reporter.ts wrote for a Firefox run and
exits 1 when a test outside the quarantine failed, or the run failed in a way
the quarantine does not cover. Quarantined failures print as warnings.
Appends a report to --summary.
`;

function main(argv: string[]): number {
  const { values } = parseArgs({
    args: argv,
    options: { results: { type: 'string' }, 'vitest-exit': { type: 'string' }, summary: { type: 'string' }, help: { type: 'boolean' } },
  });
  if (values.help) {
    process.stdout.write(USAGE);
    return 0;
  }
  const exit = Number(values['vitest-exit']);
  if (!values.results || !/^\d+$/.test(values['vitest-exit'] ?? '')) {
    process.stderr.write(USAGE);
    return 2;
  }
  let results: BrowserResults;
  try {
    results = JSON.parse(readFileSync(values.results, 'utf8'));
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    process.stdout.write(`::error title=Firefox browser tests::${escape(`No results to read (Vitest exited with ${exit}): ${reason}`)}\n`);
    return 1;
  }
  const verdict = judge(results, firefoxQuarantine, exit);
  const report = summary(verdict);
  process.stdout.write(`${annotations(verdict).join('\n')}\n${report}`);
  if (values.summary) appendFileSync(values.summary, report);
  return verdict.blocking.length ? 1 : 0;
}

const invoked = process.argv[1] && pathToFileURL(realpathSync(resolve(process.argv[1]))).href === import.meta.url;
if (invoked) process.exitCode = main(process.argv.slice(2));
