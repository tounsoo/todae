#!/usr/bin/env node
import { spawn } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { setTimeout as delay } from 'node:timers/promises';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const scratchDir = path.join(root, '.verify/scratch');
const evidenceRoot = path.join(root, '.verify/evidence');
const pidPath = path.join(scratchDir, 'server.json');
const PORT = 3321;
const WIDE = 1280;
const NARROW = 390;
const REPO = 'https://github.com/tounsoo/todae';

const docsRequire = createRequire(path.join(root, 'apps/docs/package.json'));

function args(argv) {
  const out = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const token = argv[i];
    if (!token.startsWith('--')) {
      out._.push(token);
      continue;
    }
    const key = token.slice(2);
    const next = argv[i + 1];
    if (next === undefined || next.startsWith('--')) out[key] = true;
    else {
      out[key] = next;
      i += 1;
    }
  }
  return out;
}

function publicUrl(value) {
  const url = new URL(value);
  url.searchParams.delete('_vercel_share');
  if ([...url.searchParams.keys()].length === 0) url.search = '';
  return url.toString();
}

function redact(text) {
  return String(text).replaceAll(/_vercel_share=[^&\s)"']+/g, '_vercel_share=redacted');
}

function localeOf(pathname) {
  if (pathname === '/ko' || pathname.startsWith('/ko/')) return 'ko';
  return 'en';
}

function stripLocale(pathname) {
  if (localeOf(pathname) === 'en') return pathname;
  const rest = pathname.slice(3);
  return rest === '' ? '/' : rest;
}

function localizePath(href, locale) {
  if (locale === 'en') return href;
  if (href === '/') return '/ko';
  return `/ko${href}`;
}

function countText(template, one, count) {
  if (count === 1) return one;
  return template.replaceAll('{count}', String(count));
}

function loadSiteGroups() {
  const source = readFileSync(path.join(root, 'apps/docs/components/siteGroups.ts'), 'utf8');
  const cut = source.indexOf('type SiteGroupLink');
  if (cut < 0) throw new Error('siteGroups.ts has no SiteGroupLink marker');
  let js = source.slice(0, cut).replace('export const SITE_GROUPS', 'const SITE_GROUPS');
  if (!js.includes('const SITE_GROUPS')) throw new Error('SITE_GROUPS export missing');
  js = js.replace(/\]\s*as const\s*;\s*$/, '];');
  // The file's imports omit `.ts`, so Node cannot load it. Evaluate the array instead.
  const groups = new Function(`${js}\nreturn SITE_GROUPS;`)();
  if (!Array.isArray(groups) || groups.length !== 5) throw new Error('SITE_GROUPS did not evaluate to 5 groups');
  return groups;
}

function scanBlock(source, openIndex) {
  let depth = 0;
  let quote = '';
  for (let i = openIndex; i < source.length; i++) {
    const char = source[i];
    if (quote) {
      if (char === '\\') {
        i += 1;
        continue;
      }
      if (char === quote) quote = '';
      continue;
    }
    if (char === "'" || char === '"') {
      quote = char;
      continue;
    }
    if (char === '{') depth += 1;
    else if (char === '}') {
      depth -= 1;
      if (depth === 0) return source.slice(openIndex, i + 1);
    }
  }
  throw new Error('unbalanced brace while reading dictionaries.ts');
}

function objectsNamed(source, key) {
  const marker = `${key}: {`;
  const blocks = [];
  let from = 0;
  while (from < source.length) {
    const at = source.indexOf(marker, from);
    if (at < 0) break;
    const open = at + marker.length - 1;
    blocks.push(scanBlock(source, open));
    from = open + blocks[blocks.length - 1].length;
  }
  return blocks;
}

function parseObjectLiteral(body) {
  const entries = {};
  for (const match of body.matchAll(/(\w+)\s*:\s*'((?:\\'|[^'])*)'/g)) {
    entries[match[1]] = match[2].replaceAll("\\'", "'");
  }
  return entries;
}

function pair(source, key) {
  const values = [...source.matchAll(new RegExp(`\\b${key}:\\s*'((?:\\\\'|[^'])*)'`, 'g'))].map((match) =>
    match[1].replaceAll("\\'", "'"),
  );
  if (values.length !== 2) throw new Error(`${key} appeared ${values.length} times in dictionaries.ts, expected 2`);
  return { en: values[0], ko: values[1] };
}

function loadCopy() {
  const source = readFileSync(path.join(root, 'apps/docs/lib/i18n/dictionaries.ts'), 'utf8');
  const config = readFileSync(path.join(root, 'apps/docs/lib/i18n/config.ts'), 'utf8');
  const heroes = objectsNamed(source, 'hero')
    .map(parseObjectLiteral)
    .filter((entry) => entry.title);
  const tops = objectsNamed(source, 'topLinks')
    .map(parseObjectLiteral)
    .filter((entry) => entry.start && entry.components && entry.playground);
  const groupNames = objectsNamed(source, 'groups').map(parseObjectLiteral);
  if (heroes.length !== 2) throw new Error(`expected 2 hero titles, found ${heroes.length}`);
  if (tops.length !== 2) throw new Error(`expected 2 topLinks objects, found ${tops.length}`);
  if (groupNames.length < 2) throw new Error(`expected en and ko groups objects, found ${groupNames.length}`);
  const names = [...config.matchAll(/\b(en|ko):\s*'((?:\\'|[^'])*)'/g)];
  const localeNames = Object.fromEntries(names.map((match) => [match[1], match[2]]));
  if (localeNames.en !== 'English' || !localeNames.ko) throw new Error('LOCALE_NAMES did not parse');
  return {
    heroes,
    tops,
    groupNames,
    localeNames,
    mainNav: pair(source, 'mainNav'),
    openMenu: pair(source, 'openMenu'),
    closeMenu: pair(source, 'closeMenu'),
    github: pair(source, 'github'),
    languageNav: pair(source, 'languageNav'),
    groupCount: pair(source, 'groupCount'),
    groupCountOne: pair(source, 'groupCountOne'),
  };
}

function copyFor(copy, locale) {
  const index = locale === 'ko' ? 1 : 0;
  return {
    locale,
    heroTitle: copy.heroes[index].title,
    top: copy.tops[index],
    groupNames: copy.groupNames[index] ?? {},
    mainNav: copy.mainNav[locale],
    openMenu: copy.openMenu[locale],
    closeMenu: copy.closeMenu[locale],
    github: copy.github[locale],
    languageNav: copy.languageNav[locale],
    groupCount: copy.groupCount[locale],
    groupCountOne: copy.groupCountOne[locale],
    localeNames: copy.localeNames,
  };
}

function selfTest() {
  const groups = loadSiteGroups();
  const copy = loadCopy();
  const tools = groups.find((group) => group.id === 'tools');
  const components = groups.find((group) => group.id === 'components');
  if (!tools || tools.links.length < 1) throw new Error('tools group missing');
  if (!components || components.links[0][0] !== '/alert') throw new Error('first component is not /alert');
  const ko = copyFor(copy, 'ko');
  const en = copyFor(copy, 'en');
  if (ko.groupNames.components === en.top.components) throw new Error('Korean group label matched the English top link');
  if (en.heroTitle.length < 8 || ko.heroTitle.length < 8) throw new Error('hero title missing');
  if (localizePath('/', 'ko') !== '/ko' || localizePath('/alert', 'ko') !== '/ko/alert') throw new Error('localizePath drifted');
  console.log(
    `self-test ok groups=${groups.map((group) => `${group.id}:${group.links.length}`).join(',')}`,
  );
}

function fullSha(value) {
  if (!/^[0-9a-f]{40}$/i.test(value)) throw new Error(`expected a 40-character sha, got ${value}`);
  return value.toLowerCase();
}

async function git(argsList) {
  const { execFile } = await import('node:child_process');
  const { promisify } = await import('node:util');
  const run = promisify(execFile);
  const { stdout } = await run('git', argsList, { cwd: root });
  return stdout.trim();
}

async function readPid() {
  try {
    return JSON.parse(await readFile(pidPath, 'utf8'));
  } catch (error) {
    if (error.code === 'ENOENT') return null;
    throw error;
  }
}

function alive(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

async function cmdline(pid) {
  try {
    const raw = await readFile(`/proc/${pid}/cmdline`);
    return raw.toString('utf8').replaceAll('\0', ' ');
  } catch {
    return '';
  }
}

async function ownedServer(record) {
  if (!record || !alive(record.pid)) return false;
  const line = await cmdline(record.pid);
  return line.includes('next') && line.includes(String(PORT));
}

async function portAnswers() {
  try {
    const response = await fetch(`http://127.0.0.1:${PORT}/`, { signal: AbortSignal.timeout(1500) });
    return response.status;
  } catch {
    return 0;
  }
}

async function launch() {
  await mkdir(scratchDir, { recursive: true });
  const existing = await readPid();
  if (await ownedServer(existing)) {
    console.log(`launch reuse http://127.0.0.1:${PORT} pid=${existing.pid}`);
    return `http://127.0.0.1:${PORT}`;
  }
  if (await portAnswers()) {
    throw new Error(`port ${PORT} is in use by a process this run did not start`);
  }
  const logPath = path.join(scratchDir, 'server.log');
  const { openSync } = await import('node:fs');
  const log = openSync(logPath, 'a');
  const child = spawn('pnpm', ['--filter', 'docs', 'exec', 'next', 'dev', '--port', String(PORT)], {
    cwd: root,
    detached: true,
    stdio: ['ignore', log, log],
  });
  child.unref();
  const record = { pid: child.pid, port: PORT };
  const temporary = path.join(tmpdir(), `todae-verify-${child.pid}.json`);
  await writeFile(temporary, JSON.stringify(record));
  await rename(temporary, pidPath);
  const deadline = Date.now() + 90_000;
  while (Date.now() < deadline) {
    const status = await portAnswers();
    if (status === 200) {
      const body = await (await fetch(`http://127.0.0.1:${PORT}/`)).text();
      if (body.includes('data-appearance')) {
        console.log(`launch ready http://127.0.0.1:${PORT} pid=${child.pid}`);
        return `http://127.0.0.1:${PORT}`;
      }
    }
    if (!alive(child.pid)) throw new Error(`docs server exited before it was ready. See ${logPath}`);
    await delay(500);
  }
  throw new Error(`docs server was not ready within 90s. See ${logPath}`);
}

async function cleanup() {
  const record = await readPid();
  if (!record) {
    console.log('cleanup no server');
    return;
  }
  if (alive(record.pid)) {
    const line = await cmdline(record.pid);
    if (!line.includes('next') || !line.includes(String(PORT))) {
      throw new Error(`refusing to kill pid ${record.pid} because its command is not the verify docs server`);
    }
    try {
      process.kill(-record.pid, 'SIGTERM');
    } catch {
      process.kill(record.pid, 'SIGTERM');
    }
    for (let i = 0; i < 20 && alive(record.pid); i++) await delay(100);
    if (alive(record.pid)) process.kill(record.pid, 'SIGKILL');
  }
  await rm(pidPath, { force: true });
  console.log(`cleanup stopped pid=${record.pid}`);
}

function openUrl(flags) {
  return process.env.VERIFY_URL || flags.url;
}

function pageUrl(pathname, flags) {
  const base = new URL(openUrl(flags));
  const target = new URL(pathname, `${base.origin}/`);
  const share = base.searchParams.get('_vercel_share');
  if (share) target.searchParams.set('_vercel_share', share);
  return target.toString();
}

function authHeaders() {
  if (!process.env.VERCEL_OIDC_TOKEN) return {};
  return { 'x-vercel-trusted-oidc-idp-token': process.env.VERCEL_OIDC_TOKEN };
}

function pathsOf(flags) {
  const raw = flags.paths ?? '/,/ko';
  return raw.split(',').map((item) => item.trim()).filter(Boolean);
}

async function assertSha(flags, origin) {
  const expectSha = fullSha(flags['expect-sha']);
  if (origin.startsWith('http://127.0.0.1:') || origin.startsWith('http://localhost:')) {
    const record = await readPid();
    if (!(await ownedServer(record))) throw new Error(`refusing ${origin} because this run does not own the docs server on port ${PORT}`);
    const head = fullSha(await git(['rev-parse', 'HEAD']));
    if (head !== expectSha) throw new Error(`local HEAD ${head} does not match ${expectSha}`);
    const dirty = await git(['status', '--porcelain', '--', 'apps/docs', 'packages/design-system']);
    if (dirty) throw new Error('local docs or package tree is dirty, so the server is not that sha');
    return { expectSha, deploymentSha: head, mode: 'local' };
  }
  if (!flags['deployment-sha']) throw new Error('pass --deployment-sha from the preview deployment meta.githubCommitSha');
  const deploymentSha = fullSha(flags['deployment-sha']);
  if (deploymentSha !== expectSha) throw new Error(`deployment ${deploymentSha} does not match ${expectSha}`);
  return { expectSha, deploymentSha, mode: 'preview' };
}

async function withBrowser(callback) {
  const { chromium } = docsRequire('playwright');
  const browser = await chromium.launch({ headless: true });
  try {
    return await callback(browser);
  } finally {
    await browser.close();
  }
}

async function openPage(browser, width, target) {
  const height = width === NARROW ? 844 : 800;
  const context = await browser.newContext({
    viewport: { width, height },
    extraHTTPHeaders: authHeaders(),
    reducedMotion: 'reduce',
  });
  const page = await context.newPage();
  page.setDefaultTimeout(20_000);
  const response = await page.goto(target, { waitUntil: 'domcontentloaded' });
  const status = response?.status() ?? 0;
  const html = await page.content();
  if (!response || status !== 200 || !html.includes('data-appearance')) {
    throw new Error(`${publicUrl(target)} returned ${status} and was not the docs site`);
  }
  await page.getByRole('heading', { level: 1 }).waitFor();
  await page.evaluate(() => document.fonts.ready);
  return { context, page, status };
}

async function headerCheck(page, copy, groups, pathname, width) {
  const banner = page.getByRole('banner');
  const brand = banner.getByRole('link', { name: 'Todae', exact: true });
  if ((await brand.count()) !== 1) throw new Error(`expected one Todae brand link, found ${await brand.count()}`);
  const brandHref = await brand.getAttribute('href');
  const expectedBrand = localizePath('/', copy.locale);
  if (brandHref !== expectedBrand) throw new Error(`brand href ${brandHref} !== ${expectedBrand}`);
  const github = banner.getByRole('link', { name: copy.github, exact: true });
  if ((await github.getAttribute('href')) !== REPO) throw new Error('GitHub header link href mismatch');
  const languages = banner.getByRole('navigation', { name: copy.languageNav });
  const bare = stripLocale(pathname);
  const english = languages.getByRole('link', { name: copy.localeNames.en, exact: true });
  const korean = languages.getByRole('link', { name: copy.localeNames.ko, exact: true });
  if ((await english.getAttribute('href')) !== bare) throw new Error(`English switcher href mismatch on ${pathname}`);
  if ((await korean.getAttribute('href')) !== localizePath(bare, 'ko')) throw new Error(`Korean switcher href mismatch on ${pathname}`);
  if (!(await english.isVisible()) || !(await korean.isVisible())) throw new Error('language links hidden');

  const firstComponent = groups.find((group) => group.id === 'components').links[0][0];
  const tops = [
    [localizePath('/guides/get-started', copy.locale), copy.top.start],
    [localizePath(firstComponent, copy.locale), copy.top.components],
    [localizePath('/playground', copy.locale), copy.top.playground],
  ];
  const main = page.locator('nav.top-links');
  if ((await main.count()) !== 1) throw new Error('top links nav missing');
  const mainName = await main.getAttribute('aria-label');
  if (mainName !== copy.mainNav) throw new Error(`top links name ${mainName} !== ${copy.mainNav}`);
  for (const [href, label] of tops) {
    const link = main.locator('a', { hasText: label });
    if ((await link.count()) !== 1) throw new Error(`top link ${label} count ${await link.count()}`);
    const shown = await link.isVisible();
    if (width >= 768 && !shown) throw new Error(`${label} hidden at ${width}`);
    if (width < 768 && shown) throw new Error(`${label} visible at ${width}`);
    if ((await link.getAttribute('href')) !== href) throw new Error(`${label} href mismatch`);
  }
  const menu = page.getByRole('button', { name: copy.openMenu, exact: true });
  const playground = bare === '/playground';
  if (width >= 1024 && !playground && (await menu.isVisible())) throw new Error('menu button visible on a wide page');
  if (width < 768) {
    if (!(await menu.isVisible())) throw new Error('menu button hidden on a narrow page');
    await menu.click();
    const dialog = page.getByRole('dialog');
    await dialog.waitFor({ state: 'visible' });
    const start = dialog.getByRole('link', { name: copy.top.start, exact: true });
    if (!(await start.isVisible())) throw new Error('drawer is missing the Get started link');
    await dialog.getByRole('button', { name: copy.closeMenu, exact: true }).click();
    await dialog.waitFor({ state: 'hidden' });
  }
}

async function homeCheck(page, copy, groups) {
  const title = (await page.getByRole('heading', { level: 1 }).innerText()).trim();
  if (title !== copy.heroTitle) throw new Error(`h1 ${JSON.stringify(title)} !== ${JSON.stringify(copy.heroTitle)}`);
  const lines = [`h1 ${title}`];
  if ((await page.locator('.home-group').count()) === 0) return lines;
  for (const group of groups) {
    const label = copy.groupNames[group.id] ?? group.label;
    const section = page.locator(`section[aria-labelledby="home-${group.id}"]`);
    const heading = (await section.getByRole('heading', { level: 2 }).innerText()).trim();
    const count = (await section.locator('.home-group-count').innerText()).trim();
    const expected = countText(copy.groupCount, copy.groupCountOne, group.links.length);
    if (heading !== label) throw new Error(`group ${group.id} heading ${JSON.stringify(heading)}`);
    if (count !== expected) throw new Error(`group ${group.id} count ${JSON.stringify(count)} !== ${JSON.stringify(expected)}`);
    lines.push(`${group.id} ${heading} ${count}`);
  }
  return lines;
}

async function drive(flags, browser) {
  const groups = loadSiteGroups();
  const copy = loadCopy();
  const origin = new URL(openUrl(flags)).origin;
  const stamp = new Date().toISOString().replaceAll(':', '').replaceAll('.', '');
  const dir = path.join(evidenceRoot, stamp);
  await mkdir(dir, { recursive: true });
  const lines = [];
  const note = (line) => {
    const safe = redact(line);
    lines.push(safe);
    console.log(safe);
  };
  let failed = null;
  try {
    const sha = await assertSha(flags, origin);
    note(`doctor mode=${sha.mode} sha=${sha.expectSha} deployment=${sha.deploymentSha}`);
    note(`doctor url=${publicUrl(flags.url || openUrl(flags))}`);
    for (const pathname of pathsOf(flags)) {
      for (const width of [WIDE, NARROW]) {
        const target = pageUrl(pathname, flags);
        const { context, page, status } = await openPage(browser, width, target);
        try {
          const locale = localeOf(pathname);
          const words = copyFor(copy, locale);
          note(`route ${status} ${pathname} ${locale} ${width}`);
          await headerCheck(page, words, groups, pathname, width);
          note(`header ok ${pathname} ${width}`);
          if (stripLocale(pathname) === '/') {
            for (const line of await homeCheck(page, words, groups)) note(`home ${locale} ${width} ${line}`);
          } else {
            const title = (await page.getByRole('heading', { level: 1 }).innerText()).trim();
            note(`heading ${locale} ${width} ${pathname} ${title}`);
          }
          const slug = pathname === '/' ? 'root' : pathname.replaceAll('/', '_').replace(/^_/, '');
          const shot = path.join(dir, `${localeOf(pathname)}-${width}-${slug}.png`);
          await page.screenshot({ path: shot, fullPage: true });
          note(`screenshot ${shot}`);
        } finally {
          await context.close();
        }
      }
    }
    note('drive ok');
  } catch (error) {
    failed = error;
    note(`FAIL ${error.message}`);
  }
  const report = path.join(dir, 'report.txt');
  await writeFile(report, `${lines.join('\n')}\n`);
  await writeFile(path.join(evidenceRoot, 'latest'), `${dir}\n`);
  if (failed) process.exitCode = 1;
  return dir;
}

async function main() {
  const flags = args(process.argv.slice(2));
  const command = flags._[0];
  if (command === 'self-test') {
    selfTest();
    return;
  }
  if (command === 'launch') {
    await launch();
    return;
  }
  if (command === 'cleanup') {
    await cleanup();
    return;
  }
  if (command === 'doctor' || command === 'drive' || command === 'run') {
    if (flags.launch) await launch();
    if (!flags.url && !process.env.VERIFY_URL) flags.url = `http://127.0.0.1:${PORT}`;
    if (!flags['expect-sha']) throw new Error('pass --expect-sha');
    try {
      await assertSha(flags, new URL(openUrl(flags)).origin);
      await withBrowser(async (browser) => {
        await drive(flags, browser);
      });
    } finally {
      if (flags.launch) await cleanup();
    }
    return;
  }
  throw new Error('usage: verify.mjs self-test|launch|cleanup|doctor|drive|run [--launch] [--url URL] --expect-sha SHA [--deployment-sha SHA] [--paths /,/ko]');
}

main().catch((error) => {
  console.error(redact(error.message));
  process.exit(1);
});
