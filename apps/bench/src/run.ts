/**
 * Runs the benchmark page in Playwright Chromium.
 *
 * With two sides (this checkout and an older ref), each case opens one page
 * per side and alternates their runs, so drift in the machine during a run
 * hits both sides alike.
 */
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { chromium, type BrowserContext, type Page } from 'playwright';
import { APP_DIR } from './app.ts';
import { toCase } from './metrics.ts';
import { matchesCase, type CaseResult } from './record.ts';

export type Side = { label: string; url: string };

export type ScenarioMeta = { id: string; title: string; copies?: readonly number[] };

export type RunOptions = {
  sides: readonly Side[];
  sizes: readonly number[];
  runs: number;
  warmups: number;
  /** Keeps cases whose id starts with one of these. Empty keeps every case. */
  only: readonly string[];
  log: (line: string) => void;
};

export type RunOutput = { browserVersion: string; results: CaseResult[][] };

const ITERATE_TIMEOUT_MS = 120_000;

function withTimeout<T>(promise: Promise<T>, what: string): Promise<T> {
  let timer: NodeJS.Timeout | undefined;
  const limit = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`${what} took over ${ITERATE_TIMEOUT_MS / 1000} s`)), ITERATE_TIMEOUT_MS);
  });
  return Promise.race([promise, limit]).finally(() => clearTimeout(timer));
}

async function openPage(context: BrowserContext, url: string): Promise<{ page: Page; errors: string[] }> {
  const page = await context.newPage();
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  const cdp = await context.newCDPSession(page);
  await cdp.send('Performance.enable');
  await page.exposeFunction('__benchEngine', async () => {
    const { metrics } = await cdp.send('Performance.getMetrics');
    return Object.fromEntries(metrics.map((entry) => [entry.name, entry.value]));
  });
  await page.exposeFunction('__benchGc', async () => {
    await cdp.send('HeapProfiler.collectGarbage');
  });
  await page.goto(url);
  await page.waitForFunction(() => window.__bench !== undefined, undefined, { timeout: 30_000 });
  return { page, errors };
}

const message = (error: unknown) => (error instanceof Error ? error.message : String(error)).split('\n')[0] ?? 'failed';

export function selectJobs(scenarios: readonly ScenarioMeta[], sizes: readonly number[], only: readonly string[]) {
  const jobs: { id: string; scenario: ScenarioMeta; copies: number }[] = [];
  for (const scenario of scenarios) {
    for (const copies of scenario.copies ?? sizes) {
      const id = `${scenario.id}/${copies}`;
      if (only.length > 0 && !only.some((entry) => matchesCase(id, entry))) continue;
      jobs.push({ id, scenario, copies });
    }
  }
  return jobs;
}

export async function runBrowser(options: RunOptions): Promise<RunOutput> {
  const probe = await readFile(join(APP_DIR, 'probe.js'), 'utf8');
  const browser = await chromium.launch({ headless: true });
  try {
    const context = await browser.newContext({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 });
    await context.addInitScript({ content: probe });
    const first = options.sides[0];
    if (!first) throw new Error('no side to run');
    const lister = await openPage(context, first.url);
    const scenarios = await lister.page.evaluate(() => window.__bench!.list());
    await lister.page.close();

    const jobs = selectJobs(scenarios, options.sizes, options.only);
    const results: CaseResult[][] = options.sides.map(() => []);

    for (const [done, job] of jobs.entries()) {
      options.log(`[${done + 1}/${jobs.length}] ${job.id}`);
      const pages = await Promise.all(options.sides.map((side) => openPage(context, side.url)));
      const samples: Record<string, number>[][] = options.sides.map(() => []);
      const failed: (string | undefined)[] = options.sides.map(() => undefined);
      const step = async (index: number, keep: boolean) => {
        const entry = pages[index];
        if (!entry || failed[index]) return;
        try {
          await entry.page.bringToFront();
          const sample = await withTimeout(entry.page.evaluate(() => window.__bench!.iterate()), job.id);
          if (keep) samples[index]!.push(sample);
        } catch (error) {
          failed[index] = entry.errors[0] ?? message(error);
        }
      };
      await Promise.all(
        pages.map(async (entry, index) => {
          try {
            await entry.page.evaluate(([id, copies]) => window.__bench!.prepare(id, copies), [job.scenario.id, job.copies] as const);
          } catch (error) {
            failed[index] = message(error);
          }
        }),
      );
      for (let run = 0; run < options.warmups; run += 1) {
        for (const index of options.sides.keys()) await step(index, false);
      }
      for (let run = 0; run < options.runs; run += 1) {
        // Alternate which side goes first.
        const order = [...options.sides.keys()];
        if (run % 2 === 1) order.reverse();
        for (const index of order) await step(index, true);
      }
      for (const [index, entry] of pages.entries()) {
        await entry.page.close();
        const title = `${job.scenario.title}, ${job.copies} ${job.copies === 1 ? 'copy' : 'copies'}`;
        const error = failed[index];
        results[index]!.push(error ? { id: job.id, title, metrics: {}, error } : toCase(job.id, title, samples[index]!));
        if (error) options.log(`  ${options.sides[index]!.label}: failed: ${error}`);
      }
    }
    return { browserVersion: browser.version(), results };
  } finally {
    await browser.close();
  }
}
