#!/usr/bin/env node
import { execFile, spawn } from 'node:child_process';
import { openSync, readFileSync } from 'node:fs';
import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import path from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { setTimeout as delay } from 'node:timers/promises';

const exec = promisify(execFile);

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const scratchDir = path.join(root, '.verify/scratch');
const evidenceRoot = path.join(root, '.verify/evidence');
const pidPath = path.join(scratchDir, 'server.json');
const PORT = 3321;
const WIDE = 1280;
const NARROW = 390;
// apps/docs/app/globals.css hides .top-links at max-width 48rem and the menu trigger at min-width 64rem.
const TOP_LINKS_HIDE_AT = 768;
const MENU_HIDES_FROM = 1024;
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

let localeOf = () => {
  throw new Error('docs config is not loaded');
};
let stripLocale = localeOf;
let localizePath = localeOf;

async function ensureConfig() {
  const config = await loadConfig();
  localeOf = config.localeOf;
  stripLocale = config.stripLocale;
  localizePath = config.localizePath;
}

function countText(template, one, count) {
  if (count === 1) return one;
  return template.replaceAll('{count}', String(count));
}

async function loadSiteGroups() {
  const file = pathToFileURL(path.join(root, 'apps/docs/components/siteGroups.ts')).href;
  const { SITE_GROUPS } = await import(file);
  if (!Array.isArray(SITE_GROUPS) || SITE_GROUPS.length === 0) throw new Error('SITE_GROUPS is empty');
  for (const group of SITE_GROUPS) {
    if (!group.id || !Array.isArray(group.links) || group.links.length === 0) {
      throw new Error(`SITE_GROUPS group ${group.id || '(missing id)'} has no links`);
    }
  }
  return SITE_GROUPS;
}

async function loadConfig() {
  const file = pathToFileURL(path.join(root, 'apps/docs/lib/i18n/config.ts')).href;
  return import(file);
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

async function selfTest() {
  const groups = await loadSiteGroups();
  const { localizePath: localize } = await loadConfig();
  const copy = loadCopy();
  const tools = groups.find((group) => group.id === 'tools');
  const components = groups.find((group) => group.id === 'components');
  if (!tools) throw new Error('tools group missing');
  if (!components?.links[0]?.[0]) throw new Error('components group has no first link');
  const ko = copyFor(copy, 'ko');
  const en = copyFor(copy, 'en');
  if (!ko.groupNames.components || ko.groupNames.components === en.top.components) {
    throw new Error('Korean components label missing');
  }
  if (en.heroTitle.length < 8 || ko.heroTitle.length < 8) throw new Error('hero title missing');
  if (localize('/', 'ko') !== '/ko' || localize('/alert', 'ko') !== '/ko/alert') throw new Error('localizePath drifted');
  await guardTest();
  console.log(`self-test ok groups=${groups.map((group) => `${group.id}:${group.links.length}`).join(',')} guards=ok`);
}

async function refuses(label, attempt) {
  let result;
  try {
    result = await attempt();
  } catch {
    return;
  }
  throw new Error(`self-test accepted ${label}: ${JSON.stringify(result)}`);
}

async function guardTest() {
  const preview = { url: 'https://todae-verify.vercel.app' };
  const targets = async (paths) => (await pathsOf({ ...preview, paths })).map((pathname) => pageUrl(pathname, preview));
  for (const escape of ['https://evil.example/', '//evil.example/', '/\\evil.example/', '/\t/evil.example/', '/ko//evil.example/']) {
    await refuses(`--paths ${JSON.stringify(escape)}`, () => targets(escape));
  }
  const kept = await targets('/button');
  if (kept.join(' ') !== 'https://todae-verify.vercel.app/button https://todae-verify.vercel.app/ko/button') {
    throw new Error(`--paths /button opened ${kept.join(' ')}`);
  }
  for (const host of ['127.evil.example', '127.0.0.1.nip.io']) {
    if (isLoopback(new URL(`http://${host}:${PORT}/`).hostname)) throw new Error(`${host} counted as loopback`);
  }
  for (const host of ['127.0.0.1', 'localhost', '[::1]']) {
    if (!isLoopback(new URL(`http://${host}:${PORT}/`).hostname)) throw new Error(`${host} did not count as loopback`);
  }
  const sha = 'a'.repeat(40);
  await refuses('a preview with no --deployment-id', () =>
    assertSha({ 'expect-sha': sha, 'deployment-sha': sha }, preview.url),
  );
  const asserted = await assertSha({ 'expect-sha': sha, 'deployment-sha': sha, 'deployment-id': 'dpl_verify' }, preview.url);
  if (asserted.deploymentId !== 'dpl_verify') throw new Error(`deployment id not kept: ${JSON.stringify(asserted)}`);
}

function fullSha(value) {
  if (!/^[0-9a-f]{40}$/i.test(value)) throw new Error(`expected a 40-character sha, got ${value}`);
  return value.toLowerCase();
}

async function git(argsList) {
  const { stdout } = await exec('git', argsList, { cwd: root });
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
    const { stdout } = await exec('ps', ['-o', 'args=', '-p', String(pid)]);
    return stdout.trim();
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
    return { url: `http://127.0.0.1:${PORT}`, spawned: false };
  }
  if (await portAnswers()) {
    throw new Error(`port ${PORT} is in use by a process this run did not start`);
  }
  const logPath = path.join(scratchDir, 'server.log');
  const log = openSync(logPath, 'a');
  const child = spawn('pnpm', ['--filter', 'docs', 'exec', 'next', 'dev', '--port', String(PORT)], {
    cwd: root,
    detached: true,
    stdio: ['ignore', log, log],
  });
  child.unref();
  const record = { pid: child.pid, port: PORT };
  const temporary = path.join(scratchDir, 'server.json.tmp');
  await writeFile(temporary, JSON.stringify(record));
  await rename(temporary, pidPath);
  const deadline = Date.now() + 90_000;
  try {
    while (Date.now() < deadline) {
      const status = await portAnswers();
      if (status === 200) {
        const body = await (await fetch(`http://127.0.0.1:${PORT}/`)).text();
        if (body.includes('data-appearance')) {
          console.log(`launch ready http://127.0.0.1:${PORT} pid=${child.pid}`);
          return { url: `http://127.0.0.1:${PORT}`, spawned: true };
        }
      }
      if (!alive(child.pid)) throw new Error(`docs server exited before it was ready. See ${logPath}`);
      await delay(500);
    }
    throw new Error(`docs server was not ready within 90s. See ${logPath}`);
  } catch (error) {
    await cleanup();
    throw error;
  }
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
  if (target.origin !== base.origin) {
    throw new Error(`--paths takes site paths such as /button, and ${JSON.stringify(pathname)} leaves ${base.origin}`);
  }
  const share = base.searchParams.get('_vercel_share');
  if (share) target.searchParams.set('_vercel_share', share);
  return target.toString();
}

async function pathsOf(flags) {
  await ensureConfig();
  const raw = flags.paths ?? '/,/ko';
  const given = raw.split(',').map((item) => item.trim()).filter(Boolean);
  const out = [];
  for (const pathname of given) {
    const bare = stripLocale(pathname);
    for (const locale of ['en', 'ko']) {
      const next = localizePath(bare, locale);
      if (!out.includes(next)) out.push(next);
    }
  }
  return out;
}

function isLoopback(hostname) {
  if (['localhost', 'localhost.', '0.0.0.0', '[::1]', '[::ffff:7f00:1]'].includes(hostname)) return true;
  return /^127\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(hostname);
}

async function assertSha(flags, origin) {
  const expectSha = fullSha(flags['expect-sha']);
  const originUrl = new URL(origin);
  if (process.env.VERIFY_URL && flags.url && new URL(process.env.VERIFY_URL).origin !== new URL(flags.url).origin) {
    throw new Error('VERIFY_URL origin does not match --url');
  }
  if (isLoopback(originUrl.hostname)) {
    if (originUrl.port !== String(PORT)) throw new Error(`local verify only drives port ${PORT}`);
    const record = await readPid();
    if (!(await ownedServer(record))) throw new Error(`refusing ${origin} because this run does not own the docs server on port ${PORT}`);
    const head = fullSha(await git(['rev-parse', 'HEAD']));
    if (head !== expectSha) throw new Error(`local HEAD ${head} does not match ${expectSha}`);
    const dirty = await git(['status', '--porcelain', '--', 'apps/docs', 'packages/design-system']);
    if (dirty) throw new Error('local docs or package tree is dirty, so the server is not that sha');
    return { expectSha, deploymentSha: head, mode: 'local', source: 'git-head' };
  }
  if (originUrl.protocol !== 'https:' || !originUrl.hostname.endsWith('.vercel.app')) {
    throw new Error('pass http://127.0.0.1:3321 or an https://*.vercel.app deployment URL');
  }
  if (!flags['deployment-sha']) throw new Error('pass --deployment-sha from the preview deployment meta.githubCommitSha');
  const deploymentSha = fullSha(flags['deployment-sha']);
  if (deploymentSha !== expectSha) throw new Error(`deployment ${deploymentSha} does not match ${expectSha}`);
  const deploymentId = flags['deployment-id'];
  if (typeof deploymentId !== 'string' || !/^dpl_[A-Za-z0-9]+$/.test(deploymentId)) {
    throw new Error('pass --deployment-id, the dpl_ id of the READY deployment you read');
  }
  return { expectSha, deploymentSha, deploymentId, mode: 'preview', source: 'caller-asserted' };
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
  const origin = new URL(target).origin;
  const context = await browser.newContext({
    viewport: { width, height },
    reducedMotion: 'reduce',
  });
  try {
    const token = process.env.VERCEL_OIDC_TOKEN;
    if (token) {
      await context.route('**/*', async (route) => {
        const headers = { ...route.request().headers() };
        if (new URL(route.request().url()).origin === origin) {
          headers['x-vercel-trusted-oidc-idp-token'] = token;
        }
        await route.continue({ headers });
      });
    }
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
  } catch (error) {
    await context.close();
    throw error;
  }
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
    if (width > TOP_LINKS_HIDE_AT && !shown) throw new Error(`${label} hidden at ${width}`);
    if (width <= TOP_LINKS_HIDE_AT && shown) throw new Error(`${label} visible at ${width}`);
    if ((await link.getAttribute('href')) !== href) throw new Error(`${label} href mismatch`);
  }
  const menu = page.getByRole('button', { name: copy.openMenu, exact: true });
  const menuShown = width < MENU_HIDES_FROM || bare === '/playground';
  if ((await menu.isVisible()) !== menuShown) throw new Error(`menu button ${menuShown ? 'hidden' : 'visible'} at ${width} on ${pathname}`);
  if (width <= TOP_LINKS_HIDE_AT) {
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
  const found = await page.locator('.home-group').count();
  if (found !== groups.length) throw new Error(`home groups ${found} !== ${groups.length}`);
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
  await ensureConfig();
  const groups = await loadSiteGroups();
  const copy = loadCopy();
  const origin = new URL(openUrl(flags)).origin;
  const stamp = new Date().toISOString().replaceAll(':', '').replaceAll('.', '');
  const dir = path.join(evidenceRoot, stamp);
  await mkdir(dir, { recursive: true });
  await rm(path.join(evidenceRoot, 'latest'), { force: true });
  const lines = [];
  const note = (line) => {
    const safe = redact(line);
    lines.push(safe);
    console.log(safe);
  };
  let failed = null;
  try {
    const sha = await assertSha(flags, origin);
    const deployment = sha.deploymentId ? ` deployment-id=${sha.deploymentId}` : '';
    note(`doctor mode=${sha.mode} source=${sha.source}${deployment} expect-sha=${sha.expectSha} compared-sha=${sha.deploymentSha}`);
    note(`doctor url=${publicUrl(openUrl(flags))}`);
    for (const pathname of await pathsOf(flags)) {
      for (const width of [WIDE, NARROW]) {
        const target = pageUrl(pathname, flags);
        let opened;
        try {
          opened = await openPage(browser, width, target);
          const { page, status } = opened;
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
        } catch (error) {
          failed = error;
          note(`FAIL ${pathname} ${width} ${error.message}`);
        } finally {
          if (opened) await opened.context.close();
        }
      }
    }
    if (!failed) note('drive ok');
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
    await selfTest();
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
    if (!flags['expect-sha']) throw new Error('pass --expect-sha');
    let spawned = false;
    try {
      if (flags.launch) {
        const started = await launch();
        spawned = started.spawned;
        if (!flags.url && !process.env.VERIFY_URL) flags.url = started.url;
      }
      if (!flags.url && !process.env.VERIFY_URL) flags.url = `http://127.0.0.1:${PORT}`;
      await assertSha(flags, new URL(openUrl(flags)).origin);
      await withBrowser(async (browser) => {
        await drive(flags, browser);
      });
    } finally {
      if (spawned) {
        try {
          await cleanup();
        } catch (error) {
          console.error(redact(error.message));
          process.exitCode = 1;
        }
      }
    }
    return;
  }
  throw new Error('usage: verify.mjs self-test|launch|cleanup|doctor|drive|run [--launch] [--url URL] --expect-sha SHA [--deployment-sha SHA --deployment-id ID] [--paths /,/ko]');
}

main().catch((error) => {
  console.error(redact(error.message));
  process.exit(1);
});
