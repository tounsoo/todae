/**
 * `pnpm bench`: the on-demand performance benchmark. See ../README.md.
 */
import { mkdir, mkdtemp, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { BENCH_DIR, buildPage, serve } from './app.ts';
import { measureBundles } from './bundle.ts';
import { compare, format } from './compare.ts';
import { buildCurrent, buildRef, describeCheckout, git, PACKAGE_DIR, packageVersion, type BuiltRef } from './git.ts';
import { describeMachine } from './machine.ts';
import { assertRecord, matchesCase, recordName, slug, type BenchRecord, type CaseResult } from './record.ts';
import { runBrowser, type RunOptions, type RunOutput } from './run.ts';

export const RECORDS_DIR = join(BENCH_DIR, 'records');
export const OUT_DIR = join(BENCH_DIR, 'out');

const HELP = `pnpm bench [options]          Run every case in Chromium and write a record
pnpm bench compare <a> <b>    Compare two saved records (a is before)
pnpm bench list               List saved records and local ones in apps/bench/out

Run options:
  --against <ref>    Also build <ref> (a branch, tag or SHA) and run it beside this checkout,
                     alternating their runs, then print the comparison
  --compare <name>   After the run, compare with a saved record (a name, a path, or a SHA it was taken at)
  --save             Also write the record to apps/bench/records/, to commit
  --name <name>      Record name (default: date, ref and short SHA)
  --runs <n>         Measured runs per case (default 5)
  --warmups <n>      Unmeasured runs first (default 1)
  --sizes <list>     Copies per case (default 10,100,1000)
  --cases <list>     Only these cases: menu picks every case starting with menu, button/100 that size only
  --no-build         Use the package's existing dist/ instead of running pnpm build:ds
  --summary <file>   Append the report to this Markdown file (CI passes $GITHUB_STEP_SUMMARY)
  --all              List unchanged metrics too

Records always land in apps/bench/out/ (not committed). Timings compare only between records
from the same machine type; counts compare against any record.`;

const log = (line: string) => process.stderr.write(`${line}\n`);

const positiveInt = (value: string | undefined, fallback: number, flag: string) => {
  if (value === undefined) return fallback;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 0) throw new Error(`${flag} needs a whole number, not ${value}`);
  return parsed;
};

async function readRecord(file: string): Promise<BenchRecord> {
  const value: unknown = JSON.parse(await readFile(file, 'utf8'));
  assertRecord(value, file);
  return value;
}

async function listRecords(): Promise<{ file: string; record: BenchRecord }[]> {
  const found: { file: string; record: BenchRecord }[] = [];
  for (const dir of [RECORDS_DIR, OUT_DIR]) {
    const names = await readdir(dir).catch(() => [] as string[]);
    for (const name of names.filter((entry) => entry.endsWith('.json')).sort()) {
      const file = join(dir, name);
      found.push({ file, record: await readRecord(file) });
    }
  }
  return found;
}

const savedRecord = async (name: string) => (await listRecords()).some(({ record, file }) => record.name === name && file.startsWith(RECORDS_DIR));

/** pnpm runs the script in apps/bench; a path the user typed is relative to where they ran pnpm. */
const fromUser = (path: string) => resolve(process.env.INIT_CWD ?? process.cwd(), path);

/** Finds a record by path, by name (saved records first) or by the SHA it was taken at. */
export async function findRecord(query: string): Promise<BenchRecord> {
  if (query.endsWith('.json')) return readRecord(fromUser(query));
  const all = await listRecords();
  const name = slug(query);
  const byName = all.find(({ record }) => record.name === query || record.name === name);
  if (byName) return byName.record;
  const sha = await git(['rev-parse', '--verify', '--quiet', `${query}^{commit}`]).catch(() => query);
  const bySha = all.filter(({ record }) => record.todae.sha.startsWith(sha));
  // The newest record with browser cases, before a bundle-only one.
  const browserRun = ({ record }: { record: BenchRecord }) => (record.browser.version === 'not run' ? 1 : 0);
  const newest = bySha.sort((a, b) => browserRun(a) - browserRun(b) || b.record.date.localeCompare(a.record.date))[0];
  if (!newest) throw new Error(`No record named ${query} or taken at ${sha}. pnpm bench list shows them.`);
  log(`Using ${newest.record.name} for ${query}`);
  return newest.record;
}

async function writeRecord(record: BenchRecord, dir: string): Promise<string> {
  await mkdir(dir, { recursive: true });
  const file = join(dir, `${record.name}.json`);
  await writeFile(file, `${JSON.stringify(record, null, 2)}\n`);
  return file;
}

async function report(text: string, summary: string | undefined) {
  process.stdout.write(`${text}\n`);
  if (summary) await writeFile(fromUser(summary), `${text}\n\n`, { flag: 'a' });
}

const wanted = (id: string, only: readonly string[]) => only.length === 0 || only.some((entry) => matchesCase(id, entry));

type Side = { label: string; todaeDir: string; ref: string; sha: string; dirty: boolean };

async function runPages(sides: readonly Side[], options: Omit<RunOptions, 'sides'>): Promise<RunOutput> {
  const pagesDir = await mkdtemp(join(tmpdir(), 'todae-bench-pages-'));
  try {
    const roots: Record<string, string> = {};
    for (const [index, side] of sides.entries()) {
      log(`Building the bench page for ${side.label}`);
      roots[String(index)] = join(pagesDir, String(index));
      await buildPage(side.todaeDir, roots[String(index)]!);
    }
    const server = await serve(roots);
    try {
      return await runBrowser({ ...options, sides: sides.map((side, index) => ({ label: side.label, url: `${server.origin}/${index}/` })) });
    } finally {
      await server.close();
    }
  } finally {
    await rm(pagesDir, { recursive: true, force: true });
  }
}

async function bench(values: Record<string, string | boolean | undefined>) {
  const sizes = String(values.sizes ?? '10,100,1000')
    .split(',')
    .map((size) => positiveInt(size.trim(), 0, '--sizes'))
    .filter((size) => size > 0);
  const runs = Math.max(1, positiveInt(values.runs as string | undefined, 5, '--runs'));
  const warmups = positiveInt(values.warmups as string | undefined, 1, '--warmups');
  const only = String(values.cases ?? '')
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean);
  const summary = values.summary as string | undefined;
  const name = typeof values.name === 'string' ? slug(values.name) : undefined;
  if (name === '') throw new Error(`--name ${values.name} leaves no usable record name; use letters, digits, dots and dashes.`);
  if (values.save && name && (await savedRecord(name))) throw new Error(`A saved record is already named ${name}. Pick another --name.`);

  if (values.build !== false) await buildCurrent(log);
  const checkout = await describeCheckout();
  const sides: Side[] = [{ label: 'current', todaeDir: PACKAGE_DIR, ...checkout }];
  let against: BuiltRef | undefined;
  try {
    if (typeof values.against === 'string') {
      against = await buildRef(values.against, log);
      sides.unshift({ label: values.against, todaeDir: against.todaeDir, ref: against.ref, sha: against.sha, dirty: false });
    }

    // A --cases list of bundle entries only needs no browser.
    const browser = only.length === 0 || only.some((prefix) => !prefix.startsWith('bundle'));
    const output = browser
      ? await runPages(sides, { sizes, runs, warmups, only, log })
      : { browserVersion: 'not run', results: sides.map(() => []) };

    const machine = describeMachine();
    const date = new Date().toISOString();
    const benchSha = checkout.sha;
    const records: BenchRecord[] = [];
    for (const [index, side] of sides.entries()) {
      const bundles = (await measureBundles(side.todaeDir)).filter((entry) => wanted(entry.id, only));
      const cases: CaseResult[] = [...output.results[index]!, ...bundles];
      const base = {
        schema: 1 as const,
        date,
        todae: { version: await packageVersion(side.todaeDir), sha: side.sha, ref: side.ref, dirty: side.dirty },
        bench: { sha: benchSha },
        machine,
        browser: { name: 'chromium', version: output.browserVersion },
        node: process.version,
        settings: { runs, warmups, sizes },
        cases,
      };
      const isCurrent = side.label === 'current';
      records.push({ ...base, name: (isCurrent && name) || recordName(base) });
    }
    // Both sides of --against share a date, so the same ref on both would share a name.
    const [first, last] = [records[0]!, records[records.length - 1]!];
    if (records.length > 1 && first.name === last.name) first.name = `${first.name}-against`;

    const current = records[records.length - 1]!;
    if (current.cases.length === 0) throw new Error(`No case matches --cases ${only.join(',')}.`);
    for (const record of records) log(`Wrote ${await writeRecord(record, OUT_DIR)}`);
    if (values.save) {
      if (current.todae.dirty) log('Warning: todae has local changes, so the saved record is not the commit it names.');
      if (await savedRecord(current.name)) throw new Error(`A saved record is already named ${current.name}. Pick another --name; the new record is in apps/bench/out.`);
      log(`Saved ${await writeRecord(current, RECORDS_DIR)}`);
    }
    if (records.length === 2) {
      await report(format(compare(records[0]!, current), { all: Boolean(values.all), title: `${records[0]!.todae.ref} → ${current.todae.ref}, side by side` }), summary);
    }
    if (typeof values.compare === 'string') {
      const saved = await findRecord(values.compare);
      await report(format(compare(saved, current), { all: Boolean(values.all), title: `${saved.name} → ${current.name}` }), summary);
    }
    if (records.length === 1 && typeof values.compare !== 'string' && summary) {
      await report(`## Benchmark record ${current.name}\n\nRan ${current.cases.length} cases on ${machine.type}, ${current.browser.name} ${current.browser.version}.`, summary);
    }
    process.stdout.write(`RECORD_NAME=${current.name}\n`);
  } finally {
    await against?.cleanup();
  }
}

async function main(argv: string[]) {
  const { values, positionals } = parseArgs({
    args: argv,
    allowPositionals: true,
    allowNegative: true,
    options: {
      against: { type: 'string' },
      compare: { type: 'string' },
      save: { type: 'boolean' },
      name: { type: 'string' },
      runs: { type: 'string' },
      warmups: { type: 'string' },
      sizes: { type: 'string' },
      cases: { type: 'string' },
      build: { type: 'boolean', default: true },
      summary: { type: 'string' },
      all: { type: 'boolean' },
      help: { type: 'boolean', short: 'h' },
    },
  });
  const [command = 'run', ...rest] = positionals;
  if (values.help) {
    process.stdout.write(`${HELP}\n`);
    return;
  }
  if (command === 'run') return bench(values);
  if (command === 'list') {
    for (const { file, record } of await listRecords()) {
      process.stdout.write(`${record.name}\t${record.todae.version}\t${record.todae.sha.slice(0, 7)}\t${record.machine.type}\t${file}\n`);
    }
    return;
  }
  if (command === 'compare') {
    const [a, b] = rest;
    if (!a || !b) throw new Error('compare needs two records: pnpm bench compare <before> <after>');
    const [before, after] = await Promise.all([findRecord(a), findRecord(b)]);
    await report(format(compare(before, after), { all: Boolean(values.all), title: `${before.name} → ${after.name}` }), values.summary);
    return;
  }
  throw new Error(`Unknown command ${command}.\n\n${HELP}`);
}

// pnpm passes a lone `--` through when the caller writes `pnpm bench -- --runs 3`.
main(process.argv.slice(2).filter((arg) => arg !== '--')).catch((error: unknown) => {
  log(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
