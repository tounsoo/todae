#!/usr/bin/env node
import { execFile, spawn } from 'node:child_process';
import { closeSync, existsSync, openSync, readFileSync, readdirSync } from 'node:fs';
import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import net from 'node:net';
import path from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { promisify } from 'node:util';

const exec = promisify(execFile);

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const scratchDir = path.join(root, '.verify/scratch');
const evidenceRoot = path.join(root, '.verify/evidence');
const pidPath = path.join(scratchDir, 'claude-server.json');
const serverLogPath = path.join(scratchDir, 'claude-docs.log');
const latestPath = path.join(evidenceRoot, 'latest-claude');
const SELF = '.claude/skills/verify/verify.mjs';
const DEFAULT_PORT = 3322;
const LAUNCH_TIMEOUT_MS = 240_000;
const REQUEST_TIMEOUT_MS = 120_000;
const MAX_REDIRECTS = 5;
const REDIRECT_STATUSES = new Set([301, 302, 303, 307, 308]);
const STAMP_PATTERN = /^claude-\d{8}T\d{6}Z$/;
const SHA_PATTERN = /^[0-9a-f]{40}$/;
const TOKEN_NAMES = ['VERCEL_AUTOMATION_BYPASS_SECRET', 'VERCEL_OIDC_TOKEN'];
const PREVIEW_HOST = /^todae-[a-z0-9-]+-ben-eunsoo-hos-projects\.vercel\.app$/;

export const EXIT = { PASS: 0, FAIL: 1, BLOCKED: 2, USAGE: 64 };

export class UsageError extends Error {}
export class Blocked extends Error {}

const under = (prefix) => (file) => file.startsWith(prefix);
const oneOf = (...names) => (file) => names.includes(file);
const anyOf = (...matchers) => (file) => matchers.some((match) => match(file));

export const CHANGE_TYPES = [
  {
    id: 'tokens',
    label: 'Design tokens',
    match: under('packages/design-system/tokens/'),
    steps: ['tokens-check', 'tokens-api-check', 'unit'],
    proof: "token checks and unit tests; the token change needs Ben's approval",
  },
  {
    id: 'component',
    label: 'Design system package',
    match: under('packages/design-system/'),
    steps: ['typecheck', 'lint', 'stylelint', 'schema', 'unit', 'browser', 'build-ds', 'size', 'publish-check'],
    proof: 'unit and browser tests, schema with no diff, build, size and publish checks',
  },
  {
    id: 'docs',
    label: 'Docs app',
    match: under('apps/docs/'),
    steps: ['typecheck', 'lint', 'docs-unit', 'docs-build', 'drive'],
    proof: 'docs typecheck, tests and build, and the touched routes driven in English and Korean',
  },
  {
    id: 'example',
    label: 'Examples',
    match: under('examples/'),
    steps: ['build-ds', 'fernway'],
    proof: 'the design system builds and the Fernway example builds against it',
  },
  {
    id: 'agent',
    label: 'Agent instructions and skills',
    match: anyOf(under('.claude/'), under('.agents/'), oneOf('CLAUDE.md', 'AGENTS.md')),
    steps: ['verify-self-test', 'verify-tests'],
    proof: 'the verify self-test and its tests; the rest is review',
  },
  {
    id: 'ci',
    label: 'Repo tooling and CI',
    match: anyOf(
      under('.github/'),
      under('eslint/'),
      under('stylelint/'),
      under('scripts/'),
      oneOf(
        'package.json',
        'pnpm-lock.yaml',
        'pnpm-workspace.yaml',
        'eslint.config.mjs',
        'stylelint.config.mjs',
        'tsconfig.base.json',
        '.nvmrc',
        'vitest.locale.ts',
        '.changeset/config.json',
      ),
    ),
    steps: ['check', 'unit'],
    proof: 'pnpm check and unit tests here; the CI run on the pull request head is the rest of the proof',
  },
  {
    id: 'prose',
    label: 'Prose',
    match: (file) => /\.mdx?$/.test(file),
    steps: [],
    proof: 'review only; no command proves prose',
  },
  {
    id: 'other',
    label: 'Everything else',
    match: () => true,
    steps: ['check', 'unit'],
    proof: 'pnpm check and unit tests; nothing narrower proves an unclassified file',
  },
];

export const STEPS = {
  typecheck: { id: 'typecheck', label: 'Typecheck every package', cmd: ['pnpm', 'typecheck'] },
  lint: { id: 'lint', label: 'ESLint', cmd: ['pnpm', 'lint'] },
  stylelint: { id: 'stylelint', label: 'Stylelint', cmd: ['pnpm', 'stylelint'] },
  check: { id: 'check', label: 'Lint, typecheck, stylelint and the Cursor self-test', cmd: ['pnpm', 'check'] },
  unit: { id: 'unit', label: 'Unit tests', cmd: ['pnpm', 'test'], needs: ['build-ds'] },
  'docs-unit': { id: 'docs-unit', label: 'Docs unit tests', cmd: ['pnpm', '--filter', 'docs', 'test'], needs: ['build-ds'] },
  schema: {
    id: 'schema',
    label: 'Regenerate the schema and require no diff',
    cmd: ['pnpm', 'schema'],
    afterCmd: ['git', 'status', '--porcelain', '--', 'packages/design-system/schema'],
    afterReason: 'pnpm schema changed packages/design-system/schema; commit the regenerated files and run verify again',
  },
  'tokens-check': { id: 'tokens-check', label: 'Token check', cmd: ['pnpm', 'tokens:check'] },
  'tokens-api-check': { id: 'tokens-api-check', label: 'Token API check', cmd: ['pnpm', 'tokens:api:check'] },
  browser: {
    id: 'browser',
    label: 'Browser tests',
    cmd: ['pnpm', 'test:browser'],
    needs: ['build-ds'],
    blockedWhen: /Executable doesn't exist|playwright install|browserType\.launch/i,
    blockedReason:
      'Playwright Chromium is not installed. Run pnpm --filter @tounsoo/todae exec playwright install --with-deps chromium.',
  },
  'build-ds': { id: 'build-ds', label: 'Build the design system', cmd: ['pnpm', 'build:ds'] },
  size: { id: 'size', label: 'Bundle size budget', cmd: ['pnpm', 'size:check'], needs: ['build-ds'] },
  'publish-check': { id: 'publish-check', label: 'Publish checks', cmd: ['pnpm', 'publish:check'], needs: ['build-ds'] },
  'docs-build': { id: 'docs-build', label: 'Build the docs site', cmd: ['pnpm', '--filter', 'docs', 'build'], needs: ['build-ds'] },
  fernway: {
    id: 'fernway',
    label: 'Build the Fernway example',
    cmd: ['pnpm', '--filter', 'fernway-example', 'build'],
    needs: ['build-ds'],
  },
  'verify-self-test': {
    id: 'verify-self-test',
    label: 'Verify helper self-test',
    cmd: ['node', SELF, 'self-test'],
  },
  'verify-tests': {
    id: 'verify-tests',
    label: 'Verify helper tests',
    cmd: ['node', '--test', '.claude/skills/verify/verify.test.mjs'],
  },
  drive: { id: 'drive', label: 'Drive the touched docs routes in English and Korean', drive: true },
};

export function typeOf(file) {
  return CHANGE_TYPES.find((type) => type.match(file));
}

export function classify(files) {
  const hit = new Set(files.map((file) => typeOf(file).id));
  return CHANGE_TYPES.filter((type) => hit.has(type.id)).map((type) => type.id);
}

export function planFor(files) {
  const types = classify(files);
  const wanted = [];
  for (const id of types) {
    for (const step of CHANGE_TYPES.find((type) => type.id === id).steps) {
      if (!wanted.includes(step)) wanted.push(step);
    }
  }
  const steps = [];
  const emit = (id) => {
    if (steps.includes(id)) return;
    for (const need of STEPS[id].needs ?? []) emit(need);
    steps.push(id);
  };
  wanted.forEach(emit);
  return { types, steps };
}

export function pairLocales(paths) {
  const out = [];
  const add = (value) => {
    if (!out.includes(value)) out.push(value);
  };
  for (const value of paths) {
    const english = /^\/ko(?=$|[/?#])/.test(value) ? `/${value.slice(3).replace(/^\//, '')}` : value;
    add(english);
    add(english === '/' ? '/ko' : `/ko${english}`);
  }
  return out;
}

const PAGE_FILE = /^apps\/docs\/app\/(\(en\)|ko)(?:\/(.+))?\/page\.(?:mdx?|[jt]sx?)$/;

function routeOf(file) {
  const match = PAGE_FILE.exec(file);
  if (!match) return null;
  const segments = (match[2] ?? '').split('/').filter((segment) => segment && !/^\(.*\)$/.test(segment));
  if (segments.some((segment) => segment.includes('['))) return null;
  const prefix = match[1] === 'ko' ? '/ko' : '';
  return `${prefix}/${segments.join('/')}`.replace(/\/$/, '') || '/';
}

// Files Next loads for many pages: anything under app/ that is not a page, and the MDX renderers.
const SHARED_ENTRY = /^apps\/docs\/(?:app\/|mdx-components\.[jt]sx?$)/;

export const SHARED_ROUTES = ['/', '/button', '/field/select', '/playground'];

const SOURCE_FILE = /\.(?:mdx?|[cm]?[jt]sx?|css)$/;
const IMPORT_SPEC = /(?:\bfrom|\bimport)\s*\(?\s*['"](\.{1,2}\/[^'"]+)['"]/g;
const RESOLVE_SUFFIXES = ['', '.ts', '.tsx', '.js', '.jsx', '.mjs', '.mdx', '.md', '.css', '/index.ts', '/index.tsx', '/index.js', '/index.jsx'];

// Maps each docs file to the docs files that import it by a relative path.
export function importGraph(sources) {
  const known = new Set(sources.map((source) => source.file));
  const importers = new Map();
  for (const { file, text } of sources) {
    for (const match of String(text).matchAll(IMPORT_SPEC)) {
      const joined = path.posix.normalize(path.posix.join(path.posix.dirname(file), match[1]));
      const target = RESOLVE_SUFFIXES.map((suffix) => joined + suffix).find((candidate) => known.has(candidate));
      if (!target || target === file) continue;
      if (!importers.has(target)) importers.set(target, []);
      if (!importers.get(target).includes(file)) importers.get(target).push(file);
    }
  }
  return importers;
}

// A page file gives its route. Any other docs file gives the routes of the pages that import it,
// directly or through other files. When nothing maps it to a page, or a layout or another
// shared entry imports it, it can break any page, so it also gives the shared set.
export function routesFor(files, exists = () => true, importers = new Map()) {
  const routes = [];
  for (const file of files) {
    if (!file.startsWith('apps/docs/')) continue;
    const route = exists(file) && routeOf(file);
    if (route) {
      routes.push(route);
      continue;
    }
    const seen = new Set([file]);
    const queue = [file];
    let shared = !exists(file);
    const found = [];
    while (queue.length) {
      for (const parent of importers.get(queue.shift()) ?? []) {
        if (seen.has(parent)) continue;
        seen.add(parent);
        const parentRoute = routeOf(parent);
        // A page is where the change shows. What imports a page, such as the page registry, is not.
        if (parentRoute) {
          found.push(parentRoute);
          continue;
        }
        const test = /\.test\.[cm]?[jt]sx?$/.test(parent);
        // A file under app/ that is not a page, such as a layout, or a non-test file nothing imports,
        // such as mdx-components.tsx, is an entry Next loads for many pages.
        if (!test && (SHARED_ENTRY.test(parent) || !importers.get(parent)?.length)) shared = true;
        queue.push(parent);
      }
    }
    routes.push(...found);
    if (shared || found.length === 0) routes.push(...SHARED_ROUTES);
  }
  return pairLocales(routes);
}

async function docsImporters() {
  const listing = await gitTry(['-c', 'core.quotePath=false', 'ls-files', '--', 'apps/docs']);
  const sources = [];
  for (const file of (listing ?? '').split('\n')) {
    if (!SOURCE_FILE.test(file)) continue;
    try {
      sources.push({ file, text: readFileSync(path.join(root, file), 'utf8') });
    } catch {
      // A file that can't be read imports nothing.
    }
  }
  return importGraph(sources);
}

export function verdictOf(results) {
  if (results.some((result) => result.status === 'failed')) return 'FAIL';
  if (results.some((result) => result.status === 'blocked')) return 'BLOCKED';
  return 'PASS';
}

export function redact(text, env = process.env) {
  let out = String(text);
  for (const name of TOKEN_NAMES) {
    const secret = env[name];
    if (!secret) continue;
    for (const form of new Set([secret, JSON.stringify(secret).slice(1, -1)])) {
      out = out.split(form).join('[redacted]');
    }
  }
  return out;
}

export function bypassHeaders(env = process.env) {
  const headers = {};
  if (env.VERCEL_AUTOMATION_BYPASS_SECRET) headers['x-vercel-protection-bypass'] = env.VERCEL_AUTOMATION_BYPASS_SECRET;
  if (env.VERCEL_OIDC_TOKEN) headers['x-vercel-trusted-oidc-idp-token'] = env.VERCEL_OIDC_TOKEN;
  return headers;
}

export function parseBase(value) {
  let url;
  try {
    url = new URL(value);
  } catch {
    throw new UsageError(`--url ${value} is not a URL`);
  }
  if (url.username || url.password || url.search || url.hash || url.pathname !== '/') {
    throw new UsageError('--url must be a bare origin such as http://127.0.0.1:3322');
  }
  const local = url.protocol === 'http:' && ['127.0.0.1', 'localhost'].includes(url.hostname) && url.port !== '';
  const remote = url.protocol === 'https:' && url.port === '' && PREVIEW_HOST.test(url.hostname);
  if (!local && !remote) {
    throw new UsageError(
      '--url must be http://127.0.0.1:<port>, http://localhost:<port> or a todae preview, https://todae-<id>-ben-eunsoo-hos-projects.vercel.app',
    );
  }
  return { url, remote };
}

export function checkPath(base, value) {
  if (typeof value !== 'string' || !value.startsWith('/') || value.startsWith('//') || /[\\\s\u0000-\u001f]/.test(value)) {
    throw new UsageError(`path ${JSON.stringify(value)} must start with a single / and hold no backslash or whitespace`);
  }
  const origin = new URL(base).origin;
  const url = new URL(value, origin);
  if (url.origin !== origin) throw new UsageError(`path ${JSON.stringify(value)} leaves ${origin}`);
  return url;
}

export async function sameSiteFetch(base, url, headers = {}, options = {}) {
  const { fetchImpl = fetch, timeoutMs = REQUEST_TIMEOUT_MS, maxRedirects = MAX_REDIRECTS } = options;
  const origin = new URL(base).origin;
  let current = new URL(url);
  if (current.origin !== origin) throw new UsageError(`${current.origin} is not ${origin}`);
  for (let hop = 0; hop <= maxRedirects; hop++) {
    const response = await fetchImpl(current, {
      redirect: 'manual',
      headers,
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!REDIRECT_STATUSES.has(response.status)) {
      return { status: response.status, url: current.href, body: await response.text() };
    }
    await response.body?.cancel();
    const location = response.headers.get('location');
    const fail = (reason) => ({ status: response.status, url: current.href, body: '', reason });
    if (!location) return fail('redirect without a Location header');
    let next;
    try {
      next = new URL(location, current);
    } catch {
      return fail('redirect to an invalid Location');
    }
    if (next.origin !== origin) return fail(`redirected off the site to ${next.origin}`);
    current = next;
  }
  return { status: 0, url: current.href, body: '', reason: `more than ${maxRedirects} redirects` };
}

const localeOfPath = (value) => (/^\/ko(?=$|[/?#])/.test(value) ? 'ko' : 'en');

function firstHeading(html) {
  for (const match of html.matchAll(/<h1\b[^>]*>([\s\S]*?)<\/h1>/gi)) {
    const text = match[1].replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
    if (text) return text;
  }
  return '';
}

export async function checkPage(base, value, headers = {}, options = {}) {
  const url = checkPath(base, value);
  const locale = localeOfPath(value);
  const record = { path: value, locale, status: 0, lang: null, h1: '', ok: false };
  const response = await sameSiteFetch(base, url, headers, options);
  record.status = response.status;
  if (response.reason) {
    const wall = options.remote && /^redirected off the site/.test(response.reason);
    return wall ? { ...record, blocked: `${response.reason}, likely the Vercel sign-in; set VERCEL_AUTOMATION_BYPASS_SECRET or drive the local app` } : { ...record, reason: response.reason };
  }
  const html = response.body;
  const landed = new URL(response.url).pathname.replace(/(.)\/$/, '$1');
  const asked = url.pathname.replace(/(.)\/$/, '$1');
  record.lang = /<html\b[^>]*\blang=["']?([^"'\s>]+)/i.exec(html)?.[1] ?? null;
  record.h1 = firstHeading(html);
  const reasons = [];
  if (landed !== asked) reasons.push(`redirected to ${landed}, so ${asked} itself was not shown`);
  if (response.status !== 200) reasons.push(`returned ${response.status}, expected 200`);
  if (options.remote && [401, 403].includes(response.status)) {
    return { ...record, blocked: `the preview answered ${response.status}; set VERCEL_AUTOMATION_BYPASS_SECRET or drive the local app` };
  }
  if (!html.includes('data-appearance')) reasons.push('no data-appearance, so this is not the docs site (login wall?)');
  if (record.lang !== locale) reasons.push(`html lang is ${record.lang ?? 'missing'}, expected ${locale}`);
  if (!record.h1) reasons.push('no non-empty h1');
  record.ok = reasons.length === 0;
  return reasons.length ? { ...record, reason: reasons.join('; ') } : record;
}

function describeNetworkError(error) {
  return error?.cause?.code ?? error?.code ?? error?.name ?? 'network error';
}

export async function driveSite(base, paths, headers = {}, options = {}) {
  for (const value of paths) checkPath(base, value);
  const pages = [];
  const all = pairLocales(paths);
  for (const [index, value] of all.entries()) {
    try {
      pages.push(await checkPage(base, value, headers, options));
    } catch (error) {
      if (error instanceof UsageError) throw error;
      const reason = `could not reach ${new URL(base).origin}: ${describeNetworkError(error)}`;
      const unreached = { paths: all.slice(index), reason };
      // A page that already answered and failed still proves a failure.
      const failed = pages.some((page) => !page.ok && !page.blocked);
      return { pages, unreached, blocked: failed ? null : reason };
    }
  }
  // A page that answered and failed proves a failure, so a wall on another page doesn't hide it.
  const failed = pages.some((page) => !page.ok && !page.blocked);
  const wall = pages.find((page) => page.blocked);
  return { pages, blocked: wall && !failed ? `${wall.path}: ${wall.blocked}` : null };
}

const oneLine = (value) => String(value).replace(/\s+/g, ' ').trim();

export function renderBody(report, head) {
  if (report.head !== head) {
    throw new Error(`the report is for ${report.head}, but HEAD is ${head}. Run verify again.`);
  }
  const lines = [`Tested commit: \`${report.head}\``, report.base ? `Base: \`${report.base}\`` : 'Base: not resolved', `Verdict: ${report.verdict}`, ''];
  for (const result of report.results) {
    if (result.id === 'drive') {
      lines.push(...driveLines(result, report.drive));
      continue;
    }
    const reason = result.reason ? `. ${oneLine(result.reason)}` : '';
    lines.push(`- \`${result.command}\`: ${result.status}${reason}`);
  }
  if (report.results.length === 0) {
    lines.push('- No command ran. ' + (report.proof ? oneLine(report.proof) : 'Nothing was planned.'));
  }
  return `${lines.join('\n')}\n`;
}

function driveLines(result, drive) {
  const pages = drive?.pages ?? [];
  const good = pages.filter((page) => page.ok).map((page) => `\`${page.path}\``);
  const lines = [];
  const caller = drive?.source === 'caller-asserted' ? ' The preview commit is caller-asserted.' : '';
  if (good.length) lines.push(`- Drive: ${good.join(', ')} returned 200 with their h1.${caller}`);
  for (const page of pages.filter((item) => !item.ok)) {
    const status = page.blocked ? 'blocked' : 'failed';
    lines.push(`- Drive: \`${page.path}\` ${status}. ${oneLine(page.blocked ?? page.reason ?? 'unknown')}`);
  }
  if (drive?.unreached) {
    lines.push(`- Drive: ${drive.unreached.paths.map((item) => `\`${item}\``).join(', ')} not reached. ${oneLine(drive.unreached.reason)}`);
    return lines;
  }
  if (!pages.length || (result.status !== 'passed' && !pages.some((page) => !page.ok))) {
    lines.push(`- Drive: ${result.status}. ${oneLine(result.reason ?? '')}`.trimEnd());
  }
  return lines;
}

async function git(argv, options = {}) {
  const { stdout } = await exec('git', argv, { cwd: root, maxBuffer: 64 * 1024 * 1024, ...options });
  return stdout.trim();
}

async function gitTry(argv) {
  try {
    return await git(argv);
  } catch {
    return null;
  }
}

export function childEnv() {
  const env = { ...process.env };
  for (const name of TOKEN_NAMES) delete env[name];
  return env;
}

function capture(cmd) {
  return new Promise((resolve) => {
    let output = '';
    const child = spawn(cmd[0], cmd.slice(1), { cwd: root, env: childEnv(), stdio: ['ignore', 'pipe', 'pipe'] });
    for (const stream of [child.stdout, child.stderr]) {
      stream.setEncoding('utf8');
      stream.on('data', (chunk) => {
        output += chunk;
      });
    }
    child.on('error', (error) => resolve({ exit: null, output, missing: error.code === 'ENOENT', error }));
    child.on('close', (code, signal) => resolve({ exit: code, signal, output }));
  });
}

function say(line = '') {
  console.log(redact(line));
}

async function resolveBase(ref) {
  if (ref !== undefined) {
    if (ref.startsWith('-')) throw new UsageError(`--base ${ref} is not a ref`);
    const sha = await gitTry(['rev-parse', '--verify', '--quiet', `${ref}^{commit}`]);
    if (!sha) throw new Blocked(`base ${ref} does not resolve to a commit; fetch it first`);
    // The plan diffs base...HEAD, which starts at their merge base, so that is the real base.
    const merge = await gitTry(['merge-base', sha, 'HEAD']);
    if (!merge) throw new Blocked(`no merge base between ${ref} and HEAD in this clone; fetch more history (git fetch --unshallow origin), or pick a base that shares history with HEAD`);
    return merge;
  }
  if (!(await gitTry(['rev-parse', '--verify', '--quiet', 'origin/main^{commit}']))) {
    throw new Blocked('origin/main is missing: fetch origin main first');
  }
  const sha = await gitTry(['merge-base', 'origin/main', 'HEAD']);
  if (!sha) throw new Blocked('no merge base between origin/main and HEAD; fetch more history of origin main first');
  return sha;
}

async function computePlan(ref) {
  const base = await resolveBase(ref);
  const head = await gitTry(['rev-parse', 'HEAD']);
  if (!head || !SHA_PATTERN.test(head)) throw new Blocked('HEAD does not resolve to a commit');
  const listing = await git(['-c', 'core.quotePath=false', 'diff', '--name-only', '--no-renames', `${base}...HEAD`]);
  const files = listing.split('\n').filter(Boolean);
  const { types, steps } = planFor(files);
  const docsChanged = files.some((file) => file.startsWith('apps/docs/'));
  const routes = routesFor(files, (file) => existsSync(path.join(root, file)), docsChanged ? await docsImporters() : new Map());
  return { base, head, files, types, steps, routes };
}

function printPlan(plan) {
  say(`base ${plan.base}`);
  say(`head ${plan.head}`);
  say(`files ${plan.files.length}`);
  say('');
  if (plan.types.length === 0) {
    say('No committed changes against the base, so no change type is hit and nothing is planned.');
    return;
  }
  say('Change types');
  for (const id of plan.types) {
    const type = CHANGE_TYPES.find((item) => item.id === id);
    say(`- ${type.id}: ${type.proof}`);
  }
  say('');
  say('Steps');
  if (plan.steps.length === 0) say('- none; review only');
  plan.steps.forEach((id, index) => say(`${index + 1}. ${id}: ${commandText(STEPS[id])}`));
  if (plan.steps.includes('drive')) {
    say('');
    say('Routes to drive');
    for (const route of plan.routes) say(`- ${route}`);
  }
}

const commandText = (step) => (step.drive ? 'text-only HTTP drive of the routes below' : step.cmd.join(' '));

async function doctor() {
  const checks = [];
  const record = (name, ok, detail) => checks.push({ name, ok, detail });
  const read = (file) => readFile(path.join(root, file), 'utf8').catch(() => '');

  const wantNode = /\d+/.exec(await read('.nvmrc'))?.[0];
  const haveNode = process.versions.node.split('.')[0];
  record('node', Boolean(wantNode) && wantNode === haveNode, `running ${process.versions.node}, .nvmrc wants ${wantNode ?? 'a number'}`);

  let packageManager = '';
  try {
    packageManager = JSON.parse(await read('package.json')).packageManager ?? '';
  } catch {}
  const wantPnpm = /^pnpm@([^+]+)/.exec(packageManager)?.[1];
  const pnpm = await capture(['pnpm', '--version']);
  const havePnpm = pnpm.exit === 0 ? pnpm.output.trim() : null;
  record(
    'pnpm',
    Boolean(wantPnpm) && wantPnpm === havePnpm,
    `${havePnpm ? `running ${havePnpm}` : 'pnpm did not run'}, packageManager wants ${wantPnpm ?? 'pnpm@<version>'}`,
  );

  record('node_modules', existsSync(path.join(root, 'node_modules')), 'node_modules at the repo root; run pnpm install --frozen-lockfile if missing');

  const dirty = await gitTry(['status', '--porcelain']);
  record('clean tree', dirty === '', dirty === '' ? 'git status --porcelain is empty' : 'commit or stash first; the tested commit must be the code that ran');

  const head = await gitTry(['rev-parse', 'HEAD']);
  record('HEAD', SHA_PATTERN.test(head ?? ''), head ?? 'HEAD does not resolve');

  return {
    checks,
    head: SHA_PATTERN.test(head ?? '') ? head : null,
    pnpm: havePnpm,
    problems: checks.filter((check) => !check.ok),
  };
}

function printDoctor(result) {
  for (const check of result.checks) say(`${check.ok ? 'ok     ' : 'PROBLEM'} ${check.name}: ${check.detail}`);
}

function alive(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

export async function startTime(pid) {
  try {
    const { stdout } = await exec('ps', ['-o', 'lstart=', '-p', String(pid)]);
    return stdout.trim();
  } catch {
    return '';
  }
}

async function commandLine(pid) {
  try {
    const { stdout } = await exec('ps', ['-o', 'args=', '-p', String(pid)]);
    return stdout.trim();
  } catch {
    return '';
  }
}

async function readPidRecord() {
  try {
    return JSON.parse(await readFile(pidPath, 'utf8'));
  } catch (error) {
    if (error.code === 'ENOENT') return null;
    throw error;
  }
}

export async function isOurServer(record) {
  if (!record || !alive(record.pid)) return false;
  const args = (await commandLine(record.pid)).split(/\s+/);
  const at = args.indexOf('--port');
  const launched = args.includes('next') && args.includes('dev') && at > 0 && args[at + 1] === String(record.port);
  return launched && Boolean(record.started) && (await startTime(record.pid)) === record.started;
}

function portInUse(port) {
  return new Promise((resolve) => {
    const socket = net.connect({ port, host: '127.0.0.1' });
    socket.once('connect', () => {
      socket.destroy();
      resolve(true);
    });
    socket.once('error', () => resolve(false));
  });
}

async function logTail(lines = 15) {
  try {
    return (await readFile(serverLogPath, 'utf8')).trimEnd().split('\n').slice(-lines).join('\n');
  } catch {
    return '(no server log)';
  }
}

async function answer(port) {
  try {
    const response = await fetch(`http://127.0.0.1:${port}/`, { signal: AbortSignal.timeout(120_000) });
    const html = await response.text();
    return { status: response.status, home: response.status === 200 && html.includes('data-appearance') };
  } catch {
    return null;
  }
}

async function launch(port = DEFAULT_PORT, { onSpawn } = {}) {
  await mkdir(scratchDir, { recursive: true });
  const existing = await readPidRecord();
  if (await isOurServer(existing)) {
    throw new Blocked(`a verify docs server is already running (pid ${existing.pid}, port ${existing.port}). Run cleanup first.`);
  }
  if (await portInUse(port)) {
    throw new Blocked(`port ${port} is answered by a process this helper did not start`);
  }
  const fd = openSync(serverLogPath, 'w');
  let child;
  try {
    child = spawn('pnpm', ['--filter', 'docs', 'exec', 'next', 'dev', '--port', String(port)], {
      cwd: root,
      env: childEnv(),
      detached: true,
      stdio: ['ignore', fd, fd],
    });
  } finally {
    closeSync(fd);
  }
  let spawnError = null;
  child.on('error', (error) => {
    spawnError = error;
  });
  child.unref();
  await delay(50);
  if (spawnError || !child.pid) {
    throw new Blocked(`could not start the docs server: ${spawnError?.code === 'ENOENT' ? 'pnpm was not found' : (spawnError?.message ?? 'no pid')}`);
  }
  const record = { pid: child.pid, port, startedAt: new Date().toISOString(), started: await startTime(child.pid) };
  const temporary = `${pidPath}.tmp`;
  await writeFile(temporary, JSON.stringify(record));
  await rename(temporary, pidPath);
  onSpawn?.();
  const deadline = Date.now() + LAUNCH_TIMEOUT_MS;
  try {
    while (Date.now() < deadline) {
      const reply = await answer(port);
      if (reply) return { url: `http://127.0.0.1:${port}`, port, pid: child.pid, home: reply };
      if (!alive(child.pid)) throw new Blocked(`the docs server exited before it was ready. Log tail:\n${await logTail()}`);
      await delay(1000);
    }
    throw new Blocked(`the docs server was not ready within ${LAUNCH_TIMEOUT_MS / 1000}s. Log tail:\n${await logTail()}`);
  } catch (error) {
    await cleanup().catch(() => {});
    throw error;
  }
}

async function cleanup() {
  const record = await readPidRecord();
  if (!record) {
    say('cleanup: nothing was running');
    return;
  }
  if (!alive(record.pid)) {
    await rm(pidPath, { force: true });
    say(`cleanup: pid ${record.pid} was already gone; removed the pid file`);
    return;
  }
  if (!(await isOurServer(record))) {
    await rm(pidPath, { force: true });
    say(`cleanup: pid ${record.pid} is not the verify docs server; removed the stale pid file and signalled nothing`);
    return;
  }
  const signal = (name) => {
    try {
      process.kill(-record.pid, name);
    } catch {
      try {
        process.kill(record.pid, name);
      } catch {}
    }
  };
  signal('SIGTERM');
  for (let i = 0; i < 50 && alive(record.pid); i++) await delay(100);
  if (alive(record.pid)) signal('SIGKILL');
  await rm(pidPath, { force: true });
  say(`cleanup: stopped the docs server, pid ${record.pid}`);
}

async function testedCommit(baseInfo, flags, head) {
  if (!baseInfo.remote) {
    const record = await readPidRecord();
    if (!(await isOurServer(record)) || String(record.port) !== (baseInfo.url.port || '80')) {
      throw new Blocked(`${baseInfo.url.origin} is not the docs server this checkout started; run launch here, or let run start it`);
    }
    if ((await gitTry(['status', '--porcelain'])) !== '') {
      throw new Blocked('the tree has uncommitted changes, so the local server is not showing HEAD; commit or stash first');
    }
    return { mode: 'local', source: 'git-head', sha: head };
  }
  const expect = flags['expect-sha'];
  const deployment = flags['deployment-sha'];
  const valid = (value) => typeof value === 'string' && SHA_PATTERN.test(value.toLowerCase());
  if (!valid(expect) || !valid(deployment) || expect.toLowerCase() !== deployment.toLowerCase()) {
    throw new Blocked('the preview is not the tested commit: pass --expect-sha and --deployment-sha as the same 40-character sha');
  }
  if (expect.toLowerCase() !== head) {
    throw new Blocked(`the preview is not the tested commit: it is ${expect.toLowerCase()}, but HEAD is ${head}`);
  }
  return { mode: 'preview', source: 'caller-asserted', sha: head };
}

async function driveCommand(flags, routes) {
  const baseInfo = parseBase(flags.url);
  for (const route of routes) checkPath(baseInfo.url.origin, route);
  const head = await gitTry(['rev-parse', 'HEAD']);
  if (!head || !SHA_PATTERN.test(head)) throw new Blocked('HEAD does not resolve to a commit');
  const commit = await testedCommit(baseInfo, flags, head);
  const headers = baseInfo.remote ? bypassHeaders() : {};
  const outcome = await driveSite(baseInfo.url.origin, routes, headers, { remote: baseInfo.remote });
  return { base: baseInfo.url.origin, ...commit, ...outcome };
}

function driveSummary(drive) {
  const unreached = drive.unreached ? [`NOT REACHED ${drive.unreached.paths.join(' ')} ${drive.unreached.reason}`] : [];
  return [...drive.pages.map(
    (page) =>
      `${page.ok ? 'ok  ' : page.blocked ? 'BLKD' : 'FAIL'} ${page.path} status=${page.status} lang=${page.lang ?? '-'} h1=${JSON.stringify(page.h1)}${page.reason ? ` ${page.reason}` : ''}${page.blocked ? ` ${page.blocked}` : ''}`,
  ), ...unreached];
}

function stampNow() {
  return new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+/, '');
}

async function executeStep(step, number, dir) {
  const started = Date.now();
  const command = step.cmd.join(' ');
  const logFile = path.join(dir, `${String(number).padStart(2, '0')}-${step.id}.log`);
  const result = { id: step.id, label: step.label, command, status: 'failed', exit: null, ms: 0, log: path.relative(root, logFile) };
  const run = await capture(step.cmd);
  let transcript = `$ ${command}\n${run.output}`;
  result.exit = run.exit;
  if (run.missing || run.exit === 127) {
    result.status = 'blocked';
    result.reason = `${step.cmd[0]} was not found`;
  } else if (run.exit === 0) {
    result.status = 'passed';
    if (step.afterCmd) {
      const after = await capture(step.afterCmd);
      transcript += `\n$ ${step.afterCmd.join(' ')}\n${after.output}`;
      if (after.output.trim() !== '' || after.exit !== 0) {
        result.status = 'failed';
        result.reason = step.afterReason;
      }
    }
  } else if (step.blockedWhen?.test(run.output)) {
    result.status = 'blocked';
    result.reason = step.blockedReason;
  } else {
    result.reason = run.signal ? `killed by ${run.signal}` : `exited with code ${run.exit}`;
  }
  result.ms = Date.now() - started;
  await writeFile(logFile, redact(`${transcript.trimEnd()}\n\n[${result.status}, exit ${result.exit}, ${result.ms} ms]\n`));
  return result;
}

async function executeDrive(step, number, dir, flags, routes) {
  const started = Date.now();
  const logFile = path.join(dir, `${String(number).padStart(2, '0')}-${step.id}.log`);
  const result = { id: step.id, label: step.label, command: '', status: 'failed', exit: null, ms: 0, log: path.relative(root, logFile) };
  let drive = null;
  let spawned = false;
  const lines = [];
  const onSignal = () => {
    cleanup().finally(() => process.exit(130));
  };
  try {
    if (!flags.url) {
      process.once('SIGINT', onSignal);
      process.once('SIGTERM', onSignal);
      const server = await launch(DEFAULT_PORT, {
        onSpawn: () => {
          spawned = true;
        },
      });
      flags = { ...flags, url: server.url };
      lines.push(`launched ${server.url} pid=${server.pid}`);
    }
    result.command = `node ${SELF} drive --url ${flags.url} --paths ${routes.join(',')}`;
    drive = await driveCommand(flags, routes);
    lines.push(`base ${drive.base} mode=${drive.mode} source=${drive.source} tested=${drive.sha}`, ...driveSummary(drive));
    if (drive.blocked) {
      result.status = 'blocked';
      result.reason = drive.blocked;
    } else if (drive.pages.every((page) => page.ok)) {
      result.status = 'passed';
    } else {
      result.reason = `${drive.pages.filter((page) => !page.ok && !page.blocked).length} of ${drive.pages.length} pages failed`;
    }
  } catch (error) {
    if (error instanceof Blocked) {
      result.status = 'blocked';
    }
    result.reason = error.message;
    lines.push(`${result.status}: ${error.message}`);
  } finally {
    process.off('SIGINT', onSignal);
    process.off('SIGTERM', onSignal);
    if (spawned) {
      try {
        await cleanup();
        lines.push('cleaned up the docs server this run started');
      } catch (error) {
        lines.push(`cleanup failed: ${error.message}`);
        result.status = 'failed';
        result.reason = result.reason ?? `cleanup failed: ${error.message}`;
      }
    }
  }
  result.command ||= `node ${SELF} drive --paths ${routes.join(',')}`;
  result.ms = Date.now() - started;
  await writeFile(logFile, redact(`${lines.join('\n')}\n\n[${result.status}, ${result.ms} ms]\n`));
  return { result, drive };
}

function reportMarkdown(report) {
  const lines = [
    '# Verification report',
    '',
    `Verdict: ${report.verdict}`,
    `Tested commit: \`${report.head}\``,
    report.base ? `Base: \`${report.base}\`` : 'Base: not resolved',
    `Started: ${report.startedAt}`,
    `Finished: ${report.finishedAt}`,
    `Node ${report.node}, pnpm ${report.pnpm}`,
    '',
    '## Change types',
    '',
  ];
  for (const id of report.types) lines.push(`- \`${id}\`: ${CHANGE_TYPES.find((type) => type.id === id).proof}`);
  if (report.types.length === 0) lines.push('- none');
  lines.push('', '## Steps', '');
  for (const result of report.results) {
    lines.push(`- \`${result.command}\`: ${result.status}, exit ${result.exit}, ${result.ms} ms, log \`${result.log ?? 'none'}\`${result.reason ? `. ${oneLine(result.reason)}` : ''}`);
  }
  if (report.results.length === 0) lines.push('- none');
  if (report.drive) {
    lines.push('', '## Drive', '', `Base ${report.drive.base}, ${report.drive.mode}, commit source ${report.drive.source}`, '');
    for (const line of driveSummary(report.drive)) lines.push(`- ${line}`);
  }
  return `${lines.join('\n')}\n`;
}

const blockedResult = (id, command, reason) => ({ id, label: id, command, status: 'blocked', exit: null, ms: 0, reason });

export function skippedResults(planned, ran) {
  return planned
    .filter((id) => !ran.includes(id))
    .map((id) => blockedResult(id, STEPS[id].drive ? 'drive' : STEPS[id].cmd.join(' '), 'not run: --only left it out of this run'));
}

async function run(flags) {
  if (flags.url) parseBase(flags.url);
  if (flags.only !== undefined && !String(flags.only).split(',').some((item) => item.trim())) throw new UsageError('--only names no step');
  const startedAt = new Date().toISOString();
  const stamp = `claude-${stampNow()}`;
  const dir = path.join(evidenceRoot, stamp);
  await mkdir(dir, { recursive: true });
  const results = [];
  let drive = null;
  let plan = { base: null, head: null, types: [], steps: [], routes: [] };
  let pnpm = null;
  let proof = '';

  const diagnosis = await doctor();
  printDoctor(diagnosis);
  pnpm = diagnosis.pnpm;
  plan.head = diagnosis.head;
  if (diagnosis.problems.length) {
    results.push(
      blockedResult('doctor', `node ${SELF} doctor`, diagnosis.problems.map((check) => `${check.name}: ${check.detail}`).join('; ')),
    );
  } else {
    try {
      plan = await computePlan(flags.base);
      proof = plan.types.map((id) => CHANGE_TYPES.find((type) => type.id === id).proof).join('; ');
      let steps = plan.steps;
      if (flags.only) {
        const only = flags.only.split(',').map((item) => item.trim()).filter(Boolean);
        for (const id of [...only]) for (const need of STEPS[id]?.needs ?? []) if (!only.includes(need)) only.push(need);
        const unknown = only.filter((id) => !steps.includes(id));
        if (unknown.length) throw new UsageError(`--only names steps that are not in the plan: ${unknown.join(', ')}`);
        steps = steps.filter((id) => only.includes(id));
        results.push(...skippedResults(plan.steps, steps));
      }
      if (flags.base !== undefined) {
        const merge = await gitTry(['merge-base', 'origin/main', 'HEAD']);
        if (merge !== plan.base) {
          results.push(blockedResult('plan', `node ${SELF} plan --base ${flags.base}`, `the base ${plan.base} is not the merge base with origin/main, so the plan may miss changed files`));
        }
      }
      if (plan.files.length === 0) {
        results.push(blockedResult('plan', `node ${SELF} plan`, `no committed changes against ${plan.base}; there is nothing to verify`));
      }
      let number = 0;
      for (const id of steps) {
        number += 1;
        const step = STEPS[id];
        say(`step ${number}/${steps.length}: ${step.drive ? 'drive' : step.cmd.join(' ')}`);
        let result;
        if (step.drive) {
          const driven = await executeDrive(step, number, dir, flags, plan.routes);
          result = driven.result;
          drive = driven.drive;
        } else {
          result = await executeStep(step, number, dir);
        }
        say(`  ${result.status}${result.reason ? `: ${oneLine(result.reason)}` : ''} (${result.ms} ms)`);
        results.push(result);
      }
      const headNow = await gitTry(['rev-parse', 'HEAD']);
      const dirty = await gitTry(['status', '--porcelain']);
      if (headNow !== plan.head || dirty !== '') {
        results.push(blockedResult('tree', 'git status --porcelain', 'the tree changed during the run'));
      }
    } catch (error) {
      if (!(error instanceof Blocked)) throw error;
      results.push(blockedResult('plan', `node ${SELF} plan`, error.message));
    }
  }

  const verdict = verdictOf(results);
  const report = {
    verdict,
    head: plan.head,
    base: plan.base,
    startedAt,
    finishedAt: new Date().toISOString(),
    node: process.version,
    pnpm,
    types: plan.types,
    proof,
    results,
    routes: plan.routes,
    drive,
  };
  await writeFile(path.join(dir, 'report.json'), redact(`${JSON.stringify(report, null, 2)}\n`));
  await writeFile(path.join(dir, 'report.md'), redact(reportMarkdown(report)));
  await writeFile(latestPath, `${stamp}\n`);
  say('');
  say(`evidence ${path.relative(root, dir)}`);
  for (const result of results.filter((item) => item.status !== 'passed')) {
    say(`${result.status} ${result.id}: ${oneLine(result.reason ?? '')}`);
  }
  say(`VERDICT: ${verdict}`);
  return EXIT[verdict];
}

async function bodyCommand(flags) {
  let stamp = flags.stamp;
  if (!stamp) {
    try {
      stamp = (await readFile(latestPath, 'utf8')).trim();
    } catch {
      throw new Blocked('no report yet; run verify first');
    }
  }
  if (!STAMP_PATTERN.test(stamp)) throw new UsageError(`--stamp ${stamp} is not a claude-<UTC stamp> name`);
  let report;
  try {
    report = JSON.parse(await readFile(path.join(evidenceRoot, stamp, 'report.json'), 'utf8'));
  } catch {
    throw new Blocked(`no report.json under ${path.relative(root, path.join(evidenceRoot, stamp))}`);
  }
  const head = await gitTry(['rev-parse', 'HEAD']);
  try {
    process.stdout.write(renderBody(report, head));
    return 0;
  } catch (error) {
    console.error(redact(error.message));
    return 1;
  }
}

function workspacePackages() {
  const packages = new Map();
  for (const group of ['apps', 'examples', 'packages']) {
    const groupDir = path.join(root, group);
    if (!existsSync(groupDir)) continue;
    for (const entry of readdirSync(groupDir, { withFileTypes: true })) {
      const file = path.join(groupDir, entry.name, 'package.json');
      if (!entry.isDirectory() || !existsSync(file)) continue;
      const manifest = JSON.parse(readFileSync(file, 'utf8'));
      packages.set(manifest.name, manifest);
    }
  }
  return packages;
}

function selfTest() {
  const problems = [];
  const expect = (ok, message) => {
    if (!ok) problems.push(message);
  };
  const readJson = (file) => {
    try {
      return JSON.parse(readFileSync(path.join(root, file), 'utf8'));
    } catch (error) {
      problems.push(`${file} could not be read: ${error.message}`);
      return {};
    }
  };

  let nvmrc = '';
  try {
    nvmrc = readFileSync(path.join(root, '.nvmrc'), 'utf8');
  } catch {}
  expect(/^v?\d+/.test(nvmrc.trim()), '.nvmrc does not hold a node major number');

  const rootManifest = readJson('package.json');
  expect(/^pnpm@\d/.test(rootManifest.packageManager ?? ''), 'package.json packageManager is not pnpm@<version>');
  const docsManifest = readJson('apps/docs/package.json');
  for (const script of ['test', 'dev']) expect(docsManifest.scripts?.[script], `apps/docs/package.json has no ${script} script`);
  for (const dir of ['apps/docs/app/(en)', 'apps/docs/app/ko', 'packages/design-system/tokens']) {
    expect(existsSync(path.join(root, dir)), `${dir} does not exist`);
  }

  const packages = workspacePackages();
  for (const [id, step] of Object.entries(STEPS)) {
    expect(step.id === id, `STEPS.${id} has id ${step.id}`);
    for (const need of step.needs ?? []) expect(STEPS[need], `STEPS.${id} needs unknown step ${need}`);
    if (step.drive) continue;
    expect(Array.isArray(step.cmd) && step.cmd.every((part) => typeof part === 'string') && step.cmd.length > 0, `STEPS.${id} has no cmd`);
    const [program, ...rest] = step.cmd;
    if (program === 'node') {
      const script = rest.find((part) => !part.startsWith('-'));
      expect(script && existsSync(path.join(root, script)), `STEPS.${id} runs ${script}, which does not exist`);
    } else if (program === 'pnpm' && rest[0] === '--filter') {
      const manifest = packages.get(rest[1]);
      expect(manifest, `STEPS.${id} filters on ${rest[1]}, which is not a workspace package`);
      if (rest[2] !== 'exec') expect(manifest?.scripts?.[rest[2]], `${rest[1]} has no ${rest[2]} script, which STEPS.${id} runs`);
    } else if (program === 'pnpm') {
      expect(rootManifest.scripts?.[rest[0]], `package.json has no ${rest[0]} script, which STEPS.${id} runs`);
    }
  }
  for (const type of CHANGE_TYPES) {
    expect(typeof type.match === 'function', `CHANGE_TYPES.${type.id} has no match function`);
    for (const id of type.steps) expect(STEPS[id], `CHANGE_TYPES.${type.id} names unknown step ${id}`);
  }
  expect(CHANGE_TYPES.at(-1).match('anything'), 'the last change type must catch every file');
  const { steps } = planFor(['packages/design-system/src/x.ts', 'examples/fernway/x.ts']);
  expect(steps.indexOf('build-ds') < steps.indexOf('size'), 'build-ds must precede size');
  expect(steps.indexOf('build-ds') < steps.indexOf('fernway'), 'build-ds must precede fernway');

  if (problems.length) {
    for (const problem of problems) console.error(`verify self-test: ${problem}`);
    return 1;
  }
  say('verify self-test passed');
  return 0;
}

const FLAGS = {
  plan: { base: 'string', json: 'boolean' },
  doctor: {},
  run: { base: 'string', url: 'string', only: 'string', 'expect-sha': 'string', 'deployment-sha': 'string' },
  body: { stamp: 'string' },
  launch: { port: 'string' },
  cleanup: {},
  drive: { url: 'string', paths: 'string', 'expect-sha': 'string', 'deployment-sha': 'string' },
  'self-test': {},
};

const USAGE = `usage: node ${SELF} <command> [flags]
  plan [--base <ref>] [--json]
  doctor
  run [--base <ref>] [--url <docs base>] [--only <step,...>] [--expect-sha <sha> --deployment-sha <sha>]
  body [--stamp <name>]
  launch [--port 3322]
  cleanup
  drive --url <base> --paths </a,/b> [--expect-sha <sha> --deployment-sha <sha>]
  self-test`;

export function parseArgs(argv) {
  const [command, ...rest] = argv;
  if (!command || !Object.hasOwn(FLAGS, command)) throw new UsageError(USAGE);
  const spec = FLAGS[command];
  const flags = {};
  for (let i = 0; i < rest.length; i++) {
    const token = rest[i];
    const name = token.startsWith('--') ? token.slice(2) : null;
    if (!name || !Object.hasOwn(spec, name)) throw new UsageError(`${command}: unexpected argument ${token}\n${USAGE}`);
    if (spec[name] === 'boolean') {
      flags[name] = true;
      continue;
    }
    const value = rest[i + 1];
    if (value === undefined || value.startsWith('--')) throw new UsageError(`${command}: --${name} needs a value`);
    flags[name] = value;
    i += 1;
  }
  return { command, flags };
}

async function main(argv) {
  const { command, flags } = parseArgs(argv);
  if (command === 'self-test') return selfTest();
  if (command === 'cleanup') {
    await cleanup();
    return 0;
  }
  if (command === 'launch') {
    const port = flags.port === undefined ? DEFAULT_PORT : Number(flags.port);
    if (!Number.isInteger(port) || port < 1024 || port > 65535) throw new UsageError('--port must be an integer from 1024 to 65535');
    const server = await launch(port);
    say(`launch ready ${server.url} pid=${server.pid}`);
    if (!server.home.home) say(`warning: / returned ${server.home.status} without the docs page, so a drive of it will fail`);
    return 0;
  }
  if (command === 'doctor') {
    const result = await doctor();
    printDoctor(result);
    if (result.problems.length) {
      say(`VERDICT: BLOCKED`);
      return EXIT.BLOCKED;
    }
    say('VERDICT: PASS');
    return 0;
  }
  if (command === 'plan') {
    const plan = await computePlan(flags.base);
    if (flags.json) say(JSON.stringify(plan, null, 2));
    else printPlan(plan);
    return 0;
  }
  if (command === 'body') return bodyCommand(flags);
  if (command === 'run') return run(flags);
  if (command === 'drive') {
    if (!flags.url || !flags.paths) throw new UsageError('drive needs --url and --paths');
    const routes = flags.paths.split(',').map((item) => item.trim()).filter(Boolean);
    if (routes.length === 0) throw new UsageError('--paths holds no path');
    const drive = await driveCommand(flags, routes);
    say(`base ${drive.base} mode=${drive.mode} source=${drive.source} tested=${drive.sha}`);
    for (const line of driveSummary(drive)) say(line);
    if (drive.blocked) throw new Blocked(drive.blocked);
    const verdict = drive.pages.every((page) => page.ok) ? 'PASS' : 'FAIL';
    say(`VERDICT: ${verdict}`);
    return EXIT[verdict];
  }
  throw new UsageError(USAGE);
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  main(process.argv.slice(2)).then(
    (code) => {
      process.exitCode = code;
    },
    (error) => {
      if (error instanceof UsageError) {
        console.error(redact(error.message));
        process.exitCode = EXIT.USAGE;
      } else if (error instanceof Blocked) {
        say(`BLOCKED: ${error.message}`);
        say('VERDICT: BLOCKED');
        process.exitCode = EXIT.BLOCKED;
      } else {
        console.error(redact(error.stack ?? error.message));
        process.exitCode = 1;
      }
    },
  );
}
