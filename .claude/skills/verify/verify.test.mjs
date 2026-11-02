import assert from 'node:assert/strict';
import { execFileSync, spawn, spawnSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import http from 'node:http';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { after, describe, test } from 'node:test';
import { fileURLToPath } from 'node:url';

import {
  CHANGE_TYPES,
  SHARED_ROUTES,
  STEPS,
  UsageError,
  checkPage,
  childEnv,
  checkPath,
  classify,
  driveSite,
  isOurServer,
  pairLocales,
  parseBase,
  planFor,
  redact,
  renderBody,
  routesFor,
  sameSiteFetch,
  skippedResults,
  startTime,
  verdictOf,
} from './verify.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, '../../..');
const SHA = 'a'.repeat(40);
const BASE = 'c'.repeat(40);

const ids = (files) => classify(files);

describe('classification', () => {
  test('each change type is reached by its own files', () => {
    assert.deepEqual(ids(['packages/design-system/tokens/color.json']), ['tokens']);
    assert.deepEqual(ids(['packages/design-system/src/Button/Button.tsx']), ['component']);
    assert.deepEqual(ids(['apps/docs/app/(en)/button/page.mdx']), ['docs']);
    assert.deepEqual(ids(['examples/fernway/src/main.tsx']), ['example']);
    assert.deepEqual(ids(['.claude/skills/verify/verify.mjs']), ['agent']);
    assert.deepEqual(ids(['.agents/x.md']), ['agent']);
    assert.deepEqual(ids(['.github/workflows/ci.yml']), ['ci']);
    assert.deepEqual(ids(['scripts/size-check.mjs']), ['ci']);
    assert.deepEqual(ids(['.changeset/config.json']), ['ci']);
    assert.deepEqual(ids(['LICENSE']), ['other']);
  });

  test('the first matching type wins', () => {
    assert.deepEqual(ids(['packages/design-system/tokens/a.json']), ['tokens']);
    assert.deepEqual(ids(['packages/design-system/README.md']), ['component']);
    assert.deepEqual(ids(['apps/docs/app/(en)/button/page.mdx']), ['docs']);
    assert.deepEqual(ids(['AGENTS.md']), ['agent']);
    assert.deepEqual(ids(['CLAUDE.md']), ['agent']);
    assert.deepEqual(ids(['README.md']), ['prose']);
    assert.deepEqual(ids(['docs/decisions/001.md']), ['prose']);
    assert.deepEqual(ids(['.changeset/brave-owls.md']), ['prose']);
    assert.deepEqual(ids(['scripts/README.md']), ['ci']);
  });

  test('a diff yields each hit type once, in registry order', () => {
    const files = ['README.md', 'apps/docs/a.ts', 'packages/design-system/src/a.ts', 'packages/design-system/tokens/b.json', 'apps/docs/b.ts'];
    assert.deepEqual(ids(files), ['tokens', 'component', 'docs', 'prose']);
    assert.deepEqual(ids([]), []);
  });

  test('every type names only steps that exist', () => {
    for (const type of CHANGE_TYPES) for (const step of type.steps) assert.ok(STEPS[step], `${type.id} -> ${step}`);
  });
});

describe('planFor', () => {
  test('build-ds precedes size and fernway, and steps are de-duplicated across types', () => {
    const { types, steps } = planFor(['examples/fernway/a.ts', 'packages/design-system/src/a.ts', 'apps/docs/lib/a.ts']);
    assert.deepEqual(types, ['component', 'docs', 'example']);
    assert.deepEqual(steps, ['typecheck', 'lint', 'stylelint', 'schema', 'build-ds', 'unit', 'browser', 'size', 'publish-check', 'docs-unit', 'docs-build', 'drive', 'fernway']);
    assert.equal(new Set(steps).size, steps.length);
  });

  test('a lone size need is still ordered after the build it needs', () => {
    const { steps } = planFor(['examples/fernway/a.ts']);
    assert.deepEqual(steps, ['build-ds', 'fernway']);
  });

  test('prose alone plans no steps, and an empty diff plans nothing', () => {
    assert.deepEqual(planFor(['README.md']), { types: ['prose'], steps: [] });
    assert.deepEqual(planFor([]), { types: [], steps: [] });
  });

  test('an agent change runs the verify self-test and its tests', () => {
    assert.deepEqual(planFor(['.claude/skills/verify/verify.mjs']).steps, ['verify-self-test', 'verify-tests']);
  });

  test('tests that import the built package run after the build, even when no type asks for the build', () => {
    assert.deepEqual(planFor(['package.json']).steps, ['check', 'build-ds', 'unit']);
  });

  test('tokens plan the token checks before unit tests', () => {
    assert.deepEqual(planFor(['packages/design-system/tokens/a.json']).steps, ['tokens-check', 'tokens-api-check', 'build-ds', 'unit']);
  });
});

describe('routesFor', () => {
  test('English pages pair with Korean, root with /ko', () => {
    assert.deepEqual(routesFor(['apps/docs/app/(en)/button/page.mdx']), ['/button', '/ko/button']);
    assert.deepEqual(routesFor(['apps/docs/app/(en)/page.tsx']), ['/', '/ko']);
  });

  test('Korean pages pair with their English page, English first', () => {
    assert.deepEqual(routesFor(['apps/docs/app/ko/badge/page.mdx']), ['/badge', '/ko/badge']);
    assert.deepEqual(routesFor(['apps/docs/app/ko/page.tsx']), ['/', '/ko']);
  });

  test('nested segments and route groups', () => {
    assert.deepEqual(routesFor(['apps/docs/app/(en)/field/select/page.mdx']), ['/field/select', '/ko/field/select']);
    assert.deepEqual(routesFor(['apps/docs/app/(en)/(guides)/guides/start/page.mdx']), ['/guides/start', '/ko/guides/start']);
  });

  const shared = ['/', '/ko', '/button', '/ko/button', '/field/select', '/ko/field/select', '/playground', '/ko/playground'];

  test('a dynamic segment or a shared docs file drives the shared set, since it can break any page', () => {
    assert.deepEqual(routesFor(['apps/docs/app/ko/[...slug]/page.tsx']), shared);
    assert.deepEqual(routesFor(['apps/docs/components/PropsTable.tsx']), shared);
    assert.deepEqual(routesFor(['apps/docs/app/(en)/button/layout.tsx']), shared);
  });

  test('each shared route is a real docs page', () => {
    for (const route of SHARED_ROUTES) {
      const dir = path.join(repoRoot, 'apps/docs/app/(en)', route);
      assert.ok(['page.mdx', 'page.tsx'].some((name) => existsSync(path.join(dir, name))), route);
    }
  });

  test('a deleted page drives the shared set, and duplicates collapse after pairing', () => {
    assert.deepEqual(routesFor(['apps/docs/app/(en)/gone/page.mdx'], () => false), shared);
    const files = ['apps/docs/app/(en)/button/page.mdx', 'apps/docs/app/ko/button/page.mdx', 'apps/docs/lib/a.ts'];
    assert.deepEqual(routesFor(files), ['/button', '/ko/button', '/', '/ko', '/field/select', '/ko/field/select', '/playground', '/ko/playground']);
  });

  test('files outside the docs app add no routes', () => {
    assert.deepEqual(routesFor(['packages/design-system/src/a.ts']), []);
  });
});

describe('pairLocales', () => {
  test('pairs both ways and de-duplicates', () => {
    assert.deepEqual(pairLocales(['/button']), ['/button', '/ko/button']);
    assert.deepEqual(pairLocales(['/ko/button']), ['/button', '/ko/button']);
    assert.deepEqual(pairLocales(['/ko']), ['/', '/ko']);
    assert.deepEqual(pairLocales(['/', '/ko', '/a', '/ko/a']), ['/', '/ko', '/a', '/ko/a']);
  });

  test('a path that only starts with the letters ko is English', () => {
    assert.deepEqual(pairLocales(['/koala']), ['/koala', '/ko/koala']);
  });
});

describe('checkPath', () => {
  const base = 'http://127.0.0.1:3322';

  test('accepts a plain path', () => {
    assert.equal(checkPath(base, '/button').href, 'http://127.0.0.1:3322/button');
    assert.equal(checkPath(base, '/').href, 'http://127.0.0.1:3322/');
  });

  for (const bad of ['//evil.example', 'https://evil.example/', '/\\evil', '/a b', 'button', 'http:', '/a\tb', '/a\nb', '']) {
    test(`rejects ${JSON.stringify(bad)}`, () => {
      assert.throws(() => checkPath(base, bad), UsageError);
    });
  }
});

describe('parseBase', () => {
  test('allows loopback with a port and the todae project previews', () => {
    assert.equal(parseBase('http://127.0.0.1:3322').remote, false);
    assert.equal(parseBase('http://localhost:3000').remote, false);
    assert.equal(parseBase('https://todae-glu169ioq-ben-eunsoo-hos-projects.vercel.app').remote, true);
    assert.equal(parseBase('https://todae-git-claude-x-ben-eunsoo-hos-projects.vercel.app').remote, true);
  });

  for (const bad of [
    'https://evil.example',
    'http://127.0.0.1',
    'https://vercel.app',
    'https://x.vercel.app.evil.example',
    'http://x.vercel.app',
    'https://user:pw@x.vercel.app',
    'https://x.vercel.app/path',
    'https://x.vercel.app',
    'https://someone-elses-project.vercel.app',
    'https://todae-abc-another-team.vercel.app',
    'https://todae-abc-ben-eunsoo-hos-projects.vercel.app:8443',
    'https://todae-abc-ben-eunsoo-hos-projects.vercel.app.evil.example',
    'ftp://127.0.0.1:21',
    'not a url',
  ]) {
    test(`rejects ${bad}`, () => {
      assert.throws(() => parseBase(bad), UsageError);
    });
  }
});

describe('verdictOf', () => {
  const result = (status) => ({ status });

  test('failed beats blocked beats passed', () => {
    assert.equal(verdictOf([result('passed'), result('blocked'), result('failed')]), 'FAIL');
    assert.equal(verdictOf([result('passed'), result('blocked')]), 'BLOCKED');
    assert.equal(verdictOf([result('passed'), result('passed')]), 'PASS');
  });

  test('an empty list is PASS', () => {
    assert.equal(verdictOf([]), 'PASS');
  });
});

describe('a partial run', () => {
  test('each planned step that --only left out is blocked, so the verdict is not PASS', () => {
    const skipped = skippedResults(['verify-self-test', 'verify-tests', 'check'], ['verify-tests']);
    assert.deepEqual(skipped.map((result) => [result.id, result.status, result.command]), [
      ['verify-self-test', 'blocked', 'node .claude/skills/verify/verify.mjs self-test'],
      ['check', 'blocked', 'pnpm check'],
    ]);
    assert.equal(verdictOf([{ status: 'passed' }, ...skipped]), 'BLOCKED');
    assert.equal(verdictOf(skippedResults(['check'], [])), 'BLOCKED');
  });
});

describe('childEnv', () => {
  test('steps and the docs server never inherit the Vercel tokens', () => {
    process.env.VERCEL_AUTOMATION_BYPASS_SECRET = 'bypass-for-test';
    process.env.VERCEL_OIDC_TOKEN = 'oidc-for-test';
    try {
      const env = childEnv();
      assert.equal(env.VERCEL_AUTOMATION_BYPASS_SECRET, undefined);
      assert.equal(env.VERCEL_OIDC_TOKEN, undefined);
      assert.equal(env.PATH, process.env.PATH);
    } finally {
      delete process.env.VERCEL_AUTOMATION_BYPASS_SECRET;
      delete process.env.VERCEL_OIDC_TOKEN;
    }
  });
});

describe('isOurServer', () => {
  const children = [];
  after(() => {
    for (const child of children) child.kill('SIGKILL');
  });
  const spawnLike = async (...args) => {
    const child = spawn(process.execPath, ['-e', 'setInterval(() => {}, 1e5)', ...args], { stdio: 'ignore' });
    children.push(child);
    await new Promise((resolve) => setTimeout(resolve, 200));
    return child;
  };

  test('matches only the launched next dev on that port, started at the recorded time', async () => {
    const server = await spawnLike('next', 'dev', '--port', '3399');
    const started = await startTime(server.pid);
    assert.ok(started);
    assert.equal(await isOurServer({ pid: server.pid, port: 3399, started }), true);
    assert.equal(await isOurServer({ pid: server.pid, port: 33, started }), false);
    assert.equal(await isOurServer({ pid: server.pid, port: 3399, started: 'Mon Jan  1 00:00:00 2001' }), false);
    assert.equal(await isOurServer({ pid: server.pid, port: 3399 }), false);
    const lookalike = await spawnLike('nextcloud-sync', '33990');
    assert.equal(await isOurServer({ pid: lookalike.pid, port: 3399, started: await startTime(lookalike.pid) }), false);
  });
});

describe('renderBody', () => {
  const report = {
    verdict: 'BLOCKED',
    head: SHA,
    base: BASE,
    results: [
      { id: 'typecheck', command: 'pnpm typecheck', status: 'passed' },
      { id: 'browser', command: 'pnpm test:browser', status: 'blocked', reason: 'Playwright Chromium is not installed.' },
      { id: 'drive', command: 'node drive', status: 'passed' },
    ],
    drive: { source: 'git-head', pages: [{ path: '/button', ok: true }, { path: '/ko/button', ok: true }] },
  };

  test('prints the tested commit, the verdict and each command with its result', () => {
    assert.equal(
      renderBody(report, SHA),
      [
        `Tested commit: \`${SHA}\``,
        `Base: \`${BASE}\``,
        'Verdict: BLOCKED',
        '',
        '- `pnpm typecheck`: passed',
        '- `pnpm test:browser`: blocked. Playwright Chromium is not installed.',
        '- Drive: `/button`, `/ko/button` returned 200 with their h1.',
        '',
      ].join('\n'),
    );
  });

  test('refuses a report for another commit', () => {
    const other = 'b'.repeat(40);
    assert.throws(() => renderBody(report, other), new RegExp(`the report is for ${SHA}, but HEAD is ${other}. Run verify again.`));
  });

  test('lists a failing drive page with its reason and flags a caller-asserted preview', () => {
    const body = renderBody(
      {
        ...report,
        verdict: 'FAIL',
        results: [{ id: 'drive', status: 'failed', reason: '1 of 2 pages failed' }],
        drive: {
          source: 'caller-asserted',
          pages: [{ path: '/a', ok: true }, { path: '/ko/a', ok: false, reason: 'html lang is en, expected ko' }],
        },
      },
      SHA,
    );
    assert.match(body, /- Drive: `\/a` returned 200 with their h1\. The preview commit is caller-asserted\./);
    assert.match(body, /- Drive: `\/ko\/a` failed\. html lang is en, expected ko/);
  });

  test('a blocked drive with no pages says why', () => {
    const body = renderBody({ ...report, results: [{ id: 'drive', status: 'blocked', reason: 'could not reach http://127.0.0.1:1: ECONNREFUSED' }], drive: null }, SHA);
    assert.match(body, /- Drive: blocked\. could not reach http:\/\/127\.0\.0\.1:1: ECONNREFUSED/);
  });
});

describe('redact', () => {
  test('removes both secrets, including their JSON-escaped form', () => {
    const env = { VERCEL_AUTOMATION_BYPASS_SECRET: 'bypass-s3cret', VERCEL_OIDC_TOKEN: 'oidc"tok.en' };
    const text = `a bypass-s3cret b oidc"tok.en c ${JSON.stringify('oidc"tok.en')}`;
    const clean = redact(text, env);
    assert.ok(!clean.includes('bypass-s3cret'));
    assert.ok(!clean.includes('tok.en'));
    assert.match(clean, /a \[redacted\] b \[redacted\] c "\[redacted\]"/);
  });

  test('leaves text alone when no secret is set', () => {
    assert.equal(redact('hello', {}), 'hello');
  });
});

function listen(handler) {
  return new Promise((resolve) => {
    const seen = [];
    const server = http.createServer((request, response) => {
      seen.push({ url: request.url, headers: request.headers });
      handler(request, response, server);
    });
    server.listen(0, '127.0.0.1', () => resolve({ server, seen, origin: `http://127.0.0.1:${server.address().port}` }));
  });
}

const page = (lang, body = '<h1>Button</h1>') => `<!doctype html><html lang="${lang}" data-appearance="auto"><body>${body}</body></html>`;

describe('sameSiteFetch', () => {
  const servers = [];
  const start = async (handler) => {
    const made = await listen(handler);
    servers.push(made.server);
    return made;
  };
  after(() => {
    for (const server of servers) server.closeAllConnections?.();
    for (const server of servers) server.close();
  });

  test('sends the headers to the base server', async () => {
    const base = await start((_request, response) => response.end('ok'));
    const result = await sameSiteFetch(base.origin, `${base.origin}/x`, { 'x-vercel-protection-bypass': 'secret' });
    assert.equal(result.status, 200);
    assert.equal(base.seen[0].headers['x-vercel-protection-bypass'], 'secret');
  });

  test('does not follow a redirect to another origin, which receives nothing', async () => {
    const other = await start((_request, response) => response.end('other'));
    const base = await start((_request, response) => {
      response.writeHead(302, { location: `${other.origin}/steal` });
      response.end();
    });
    const result = await sameSiteFetch(base.origin, `${base.origin}/x`, { 'x-vercel-protection-bypass': 'secret' });
    assert.equal(result.reason, `redirected off the site to ${other.origin}`);
    assert.equal(other.seen.length, 0);
    assert.equal(base.seen.length, 1);
  });

  test('follows a same-origin redirect and sends the headers again', async () => {
    const base = await start((request, response) => {
      if (request.url === '/old') {
        response.writeHead(308, { location: '/new' });
        response.end();
      } else response.end('landed');
    });
    const result = await sameSiteFetch(base.origin, `${base.origin}/old`, { 'x-vercel-trusted-oidc-idp-token': 'tok' });
    assert.equal(result.status, 200);
    assert.equal(result.body, 'landed');
    assert.equal(new URL(result.url).pathname, '/new');
    assert.deepEqual(
      base.seen.map((hit) => [hit.url, hit.headers['x-vercel-trusted-oidc-idp-token']]),
      [['/old', 'tok'], ['/new', 'tok']],
    );
  });

  test('stops after five redirects', async () => {
    const base = await start((_request, response) => {
      response.writeHead(302, { location: '/again' });
      response.end();
    });
    const result = await sameSiteFetch(base.origin, `${base.origin}/start`);
    assert.equal(result.reason, 'more than 5 redirects');
    assert.equal(base.seen.length, 6);
  });

  test('refuses a first URL that is not on the base origin', async () => {
    const other = await start((_request, response) => response.end('other'));
    const base = await start((_request, response) => response.end('base'));
    await assert.rejects(sameSiteFetch(base.origin, `${other.origin}/x`), UsageError);
    assert.equal(other.seen.length, 0);
  });

  test('page checks pass a docs page and fail a login wall, a wrong lang and a missing h1', async () => {
    const base = await start((request, response) => {
      const routes = {
        '/button': page('en'),
        '/ko/button': page('en'),
        '/wall': '<html lang="en"><body><h1>Sign in</h1></body></html>',
        '/empty': page('en', '<h1> <span></span> </h1>'),
        '/ko': page('ko', '<h1>\n  <span>안녕</span>   하세요 </h1>'),
        '/': page('en'),
        '/trailing/': page('en'),
      };
      if (request.url === '/gone') return response.writeHead(301, { location: '/' }).end();
      if (request.url === '/trailing') return response.writeHead(308, { location: '/trailing/' }).end();
      if (routes[request.url]) response.end(routes[request.url]);
      else response.writeHead(404).end(page('en'));
    });
    const ok = await checkPage(base.origin, '/button');
    assert.deepEqual({ ok: ok.ok, status: ok.status, lang: ok.lang, h1: ok.h1, locale: ok.locale }, { ok: true, status: 200, lang: 'en', h1: 'Button', locale: 'en' });
    assert.match((await checkPage(base.origin, '/ko/button')).reason, /html lang is en, expected ko/);
    assert.match((await checkPage(base.origin, '/wall')).reason, /no data-appearance/);
    assert.match((await checkPage(base.origin, '/empty')).reason, /no non-empty h1/);
    assert.match((await checkPage(base.origin, '/missing')).reason, /returned 404/);
    assert.equal((await checkPage(base.origin, '/ko')).h1, '안녕 하세요');
    assert.match((await checkPage(base.origin, '/gone')).reason, /redirected to \/, so \/gone itself was not shown/);
    assert.equal((await checkPage(base.origin, '/trailing')).ok, true);
  });

  test('a preview that answers 401 or sends the reader to sign in elsewhere is blocked, not failed', async () => {
    const other = await start((_request, response) => response.end('sign in'));
    const base = await start((request, response) => {
      if (request.url === '/sso') return response.writeHead(307, { location: `${other.origin}/login` }).end();
      response.writeHead(401).end('Authentication Required');
    });
    const driven = await driveSite(base.origin, ['/x'], {}, { remote: true });
    assert.match(driven.blocked, /the preview answered 401/);
    assert.match((await checkPage(base.origin, '/sso', {}, { remote: true })).blocked, /likely the Vercel sign-in/);
    assert.equal(other.seen.length, 0);
    assert.match((await checkPage(base.origin, '/x')).reason, /returned 401/);
  });

  test('driveSite drives English then Korean and reports an unreachable server as blocked', async () => {
    const base = await start((request, response) => response.end(page(request.url.startsWith('/ko') ? 'ko' : 'en')));
    const driven = await driveSite(base.origin, ['/button']);
    assert.deepEqual(driven.pages.map((item) => [item.path, item.ok]), [['/button', true], ['/ko/button', true]]);
    assert.equal(driven.blocked, null);

    const closed = await listen((_request, response) => response.end());
    const origin = closed.origin;
    await new Promise((resolve) => closed.server.close(resolve));
    const down = await driveSite(origin, ['/button']);
    assert.match(down.blocked, /could not reach http:\/\/127\.0\.0\.1:\d+: ECONNREFUSED/);
    assert.deepEqual(down.pages, []);
  });
});

describe('command line', () => {
  test('self-test passes in this repo', () => {
    const run = spawnSync(process.execPath, [path.join(here, 'verify.mjs'), 'self-test'], { cwd: repoRoot, encoding: 'utf8' });
    assert.equal(run.status, 0, run.stderr);
    assert.match(run.stdout, /verify self-test passed/);
  });

  test('an unknown command is a usage error', () => {
    const run = spawnSync(process.execPath, [path.join(here, 'verify.mjs'), 'nope'], { cwd: repoRoot, encoding: 'utf8' });
    assert.equal(run.status, 64);
  });

  test('a path that leaves the site is a usage error before any request', () => {
    const run = spawnSync(process.execPath, [path.join(here, 'verify.mjs'), 'drive', '--url', 'http://127.0.0.1:9', '--paths', '//evil.example'], {
      cwd: repoRoot,
      encoding: 'utf8',
    });
    assert.equal(run.status, 64);
  });

  test('run --only with no step is a usage error', () => {
    const run = spawnSync(process.execPath, [path.join(here, 'verify.mjs'), 'run', '--only', ','], { cwd: repoRoot, encoding: 'utf8' });
    assert.equal(run.status, 64);
  });

  test('a local server this checkout did not launch is BLOCKED, and it gets no request', async () => {
    const { server, origin, seen } = await listen((_request, response) => response.end('stale'));
    try {
      const run = await new Promise((resolve) => {
        const child = spawn(process.execPath, [path.join(here, 'verify.mjs'), 'drive', '--url', origin, '--paths', '/button'], { cwd: repoRoot });
        let stdout = '';
        child.stdout.on('data', (chunk) => (stdout += chunk));
        child.on('close', (status) => resolve({ status, stdout }));
      });
      assert.equal(run.status, 2);
      assert.match(run.stdout, /is not the docs server this checkout started/);
      assert.equal(seen.length, 0);
    } finally {
      server.close();
    }
  });

  describe('in a scratch repository', () => {
    const dir = mkdtempSync(path.join(tmpdir(), 'verify-scratch-'));
    after(() => rmSync(dir, { recursive: true, force: true }));
    const git = (...argv) => execFileSync('git', argv, { cwd: dir, encoding: 'utf8' });
    const write = (file, text) => {
      mkdirSync(path.dirname(path.join(dir, file)), { recursive: true });
      writeFileSync(path.join(dir, file), text);
    };
    const helper = path.join(dir, '.claude/skills/verify/verify.mjs');

    git('init', '-q', '-b', 'main');
    git('config', 'user.email', 'test@example.com');
    git('config', 'user.name', 'Test');
    write('README.md', 'x');
    git('add', '.');
    git('commit', '-qm', 'base');
    git('update-ref', 'refs/remotes/origin/main', 'HEAD');
    mkdirSync(path.dirname(helper), { recursive: true });
    cpSync(path.join(here, 'verify.mjs'), helper);
    write('apps/docs/app/(en)/button/page.mdx', '# Button');
    write('packages/design-system/tokens/a.json', '{}');
    git('add', '.');
    git('commit', '-qm', 'change', '--no-verify');

    const plan = (...extra) => spawnSync(process.execPath, [helper, 'plan', '--json', ...extra], { cwd: dir, encoding: 'utf8' });

    test('plan reads the committed diff against the merge base with origin/main', () => {
      const run = plan();
      assert.equal(run.status, 0, run.stderr);
      const out = JSON.parse(run.stdout);
      assert.deepEqual(out.files.sort(), ['.claude/skills/verify/verify.mjs', 'apps/docs/app/(en)/button/page.mdx', 'packages/design-system/tokens/a.json']);
      assert.deepEqual(out.types, ['tokens', 'docs', 'agent']);
      assert.deepEqual(out.routes, ['/button', '/ko/button']);
      assert.equal(out.head, git('rev-parse', 'HEAD').trim());
      assert.equal(out.base, git('rev-parse', 'origin/main').trim());
    });

    test('plan with the head as base finds no types', () => {
      const out = JSON.parse(plan('--base', 'HEAD').stdout);
      assert.deepEqual(out.types, []);
      assert.deepEqual(out.steps, []);
    });

    test('plan is BLOCKED when origin/main is missing', () => {
      git('update-ref', '-d', 'refs/remotes/origin/main');
      const run = plan();
      assert.equal(run.status, 2);
      assert.match(run.stdout, /fetch origin main first/);
    });
  });
});
