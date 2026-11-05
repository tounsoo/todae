import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, relative, resolve } from 'node:path';
import type { Reporter, SerializedError, TestModule, TestRunEndReason, Vitest } from 'vitest/node';

/** What one browser test run came to, as `scripts/firefox-quarantine.ts` reads it. */
export interface BrowserResults {
  reason: TestRunEndReason;
  /** Errors Vitest caught outside any test. */
  unhandledErrors: string[];
  /** Test files that failed outside their tests, such as on import. */
  modules: { file: string; errors: string[] }[];
  tests: { file: string; name: string; state: 'passed' | 'failed' | 'skipped' | 'pending'; errors: string[] }[];
}

const message = (error: SerializedError) => error.message || error.name || String(error);

/**
 * Writes every test's result to the JSON file `BROWSER_RESULTS` names, with
 * paths relative to the package. Vitest's own JSON reporter leaves out errors
 * raised outside a test, which a gate that reads the results must not miss.
 * Run with `--reporter=default --reporter=./scripts/browser-results-reporter.ts`.
 */
export default class BrowserResultsReporter implements Reporter {
  private root = process.cwd();

  onInit(vitest: Vitest) {
    this.root = vitest.config.root;
  }

  onTestRunEnd(testModules: ReadonlyArray<TestModule>, unhandledErrors: ReadonlyArray<SerializedError>, reason: TestRunEndReason) {
    const out = process.env.BROWSER_RESULTS;
    if (!out) throw new Error('browser-results-reporter: set BROWSER_RESULTS to the file to write.');
    const results: BrowserResults = { reason, unhandledErrors: unhandledErrors.map(message), modules: [], tests: [] };
    for (const module of testModules) {
      const file = relative(this.root, module.moduleId).split('\\').join('/');
      const errors = module.errors().map(message);
      if (errors.length) results.modules.push({ file, errors });
      for (const test of module.children.allTests()) {
        const result = test.result();
        results.tests.push({ file, name: test.fullName, state: result.state, errors: (result.errors ?? []).map(message) });
      }
    }
    const path = resolve(this.root, out);
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, `${JSON.stringify(results, null, 2)}\n`);
  }
}
