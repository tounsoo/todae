import assert from 'node:assert/strict';
import { execFileSync, spawn, spawnSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import http from 'node:http';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { after, describe, test } from 'node:test';
import { fileURLToPath, pathToFileURL } from 'node:url';

import {
  CHANGE_TYPES,
  CI_RUNS,
  SHARED_ROUTES,
  STEPS,
  UsageError,
  blockingRuns,
  ciGaps,
  covers,
  expandNeeds,
  checkPage,
  childEnv,
  checkPath,
  classify,
  driveSite,
  importGraph,
  nodeIcu,
  isOurServer,
  pairLocales,
  parseBase,
  planFor,
  planTypes,
  readWorkflow,
  redact,
  runsPart,
  renderBody,
  routesFor,
  sameSiteFetch,
  skippedResults,
  startTime,
  verdictOf,
  withBase,
  workflowGaps,
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
    assert.deepEqual(ids(['scripts/publish-check.sh']), ['ci']);
    assert.deepEqual(ids(['.changeset/config.json']), ['ci']);
    assert.deepEqual(ids(['LICENSE']), ['other']);
  });

  test('the first matching type wins', () => {
    assert.deepEqual(ids(['packages/design-system/tokens/a.json']), ['tokens']);
    assert.deepEqual(ids(['packages/design-system/README.md']), ['component']);
    assert.deepEqual(ids(['apps/docs/app/(en)/button/page.mdx']), ['docs']);
    assert.deepEqual(ids(['AGENTS.md']), ['agent']);
    assert.deepEqual(ids(['CLAUDE.md']), ['agent']);
    assert.deepEqual(ids(['README.md']), ['markdown']);
    assert.deepEqual(ids(['docs/decisions/001.md']), ['markdown']);
    assert.deepEqual(ids(['scripts/README.md']), ['ci']);
  });

  // CI runs every job on these, so they are not the Markdown that CI's markdown class skips.
  test('a changeset, a pull request body and an audit note are not markdown', () => {
    assert.deepEqual(ids(['.changeset/brave-owls.md']), ['other']);
    assert.deepEqual(ids(['pr-body.md']), ['other']);
    assert.deepEqual(ids(['notes/pr-body.md']), ['other']);
    assert.deepEqual(ids(['.audit/notes.md']), ['other']);
    assert.deepEqual(ids(['docs/notes.mdx']), ['other']);
  });

  test("the markdown type holds the files change-class.sh classes markdown, and no others", () => {
    const files = [
      'README.md',
      'CONTRIBUTING.md',
      'docs/decisions/0012-docs-build-in-github.md',
      'apps/docs/TRANSLATING.md',
      'scripts/README.md',
      '.claude/task-prompt.md',
      '.changeset/brave-owls.md',
      '.audit/notes.md',
      'pr-body.md',
      'notes/pr-body.md',
      'docs/notes.mdx',
      'LICENSE',
    ];
    for (const file of files) {
      const ci = execFileSync('bash', ['.github/scripts/change-class.sh'], { cwd: repoRoot, input: `${file}\n`, encoding: 'utf8' }).trim();
      // A file an earlier type takes, such as scripts/README.md for ci, never reaches the markdown type.
      const reaches = CHANGE_TYPES.find((type) => type.id === 'markdown').match(file);
      assert.equal(reaches, ci === 'markdown', `${file}: change-class.sh says ${ci}, but the markdown type ${reaches ? 'matches' : 'does not match'} it`);
    }
  });

  test('a diff yields each hit type once, in registry order', () => {
    const files = ['README.md', 'apps/docs/a.ts', 'packages/design-system/src/a.ts', 'packages/design-system/tokens/b.json', 'apps/docs/b.ts'];
    assert.deepEqual(ids(files), ['tokens', 'component', 'docs', 'markdown']);
    assert.deepEqual(ids([]), []);
  });

  test('every type names only steps that exist', () => {
    for (const type of CHANGE_TYPES) for (const step of type.steps) assert.ok(STEPS[step], `${type.id} -> ${step}`);
  });
});

describe('planFor', () => {
  test('build-ds precedes publish-check and fernway, and steps are de-duplicated across types', () => {
    const { types, steps } = planFor(['examples/fernway/a.ts', 'packages/design-system/src/a.ts', 'apps/docs/lib/a.ts']);
    assert.deepEqual(types, ['component', 'docs', 'example']);
    assert.deepEqual(steps, [
      'check',
      'schema',
      'tokens-check',
      'changeset',
      'build-ds',
      'unit',
      'browser',
      'browser-firefox',
      'browser-webkit',
      'docs-browser',
      'publish-check',
      'ssr-smoke',
      'relink',
      'fernway',
      'forbidden-paths',
      'docs-unit',
      'docs-build',
      'docs-axe',
      'docs-peek',
      'drive',
    ]);
    assert.equal(new Set(steps).size, steps.length);
  });

  test('a browser host file runs the browser tests', () => {
    for (const file of ['playwright.host.ts', 'browser.host.ts', 'scripts/macos-browser.sh']) {
      assert.deepEqual(planFor([file]).types, ['component'], file);
    }
  });

  test('a lone fernway need is still ordered after the build it needs', () => {
    const { steps } = planFor(['examples/fernway/a.ts']);
    assert.deepEqual(steps, ['check', 'build-ds', 'relink', 'fernway', 'ssr-smoke', 'forbidden-paths']);
  });

  // A fresh worktree's install ran before dist existed, so Fernway's todae-tokens bin was missing and its
  // build failed with "todae-tokens: command not found" until the relink CI also runs.
  test('fernway relinks the bins after the package build, as CI does', () => {
    assert.deepEqual(expandNeeds(['fernway']), ['build-ds', 'relink', 'fernway']);
    assert.deepEqual(STEPS.relink.cmd, ['pnpm', 'install', '--frozen-lockfile', '--offline']);
  });

  // pnpm test:browser ran every engine at once, Firefox with file parallelism and no quarantine, so a local
  // run failed where CI's Engines jobs passed. Each step is now one of CI's commands.
  test('a package change runs each engine as its own CI command', () => {
    const { steps } = planFor(['packages/design-system/src/a.ts']);
    for (const id of ['browser', 'browser-firefox', 'browser-webkit', 'docs-browser']) assert.ok(steps.includes(id), id);
    assert.ok(!steps.some((id) => STEPS[id].cmd?.join(' ') === 'pnpm test:browser'));
    assert.match(STEPS['browser-firefox'].cmd.join(' '), /--project firefox --no-file-parallelism .*firefox-quarantine\.ts --results "\$BROWSER_RESULTS" --vitest-exit "\$status"/);
  });

  test('markdown alone runs the jobs CI runs on Markdown, and an empty diff plans nothing', () => {
    assert.deepEqual(planFor(['README.md']), { types: ['markdown'], steps: ['check-self', 'forbidden-paths'] });
    assert.deepEqual(planFor([]), { types: [], steps: [] });
  });

  test('an agent change runs the verify self-test, its tests and the rule table check', () => {
    assert.deepEqual(planFor(['.claude/skills/verify/verify.mjs']).steps, ['verify-self-test', 'verify-tests', 'check-self', 'forbidden-paths']);
  });

  test('tests that import the built package run after the build, even when no type asks for the build', () => {
    assert.deepEqual(planFor(['package.json']).steps, ['check', 'changeset', 'build-ds', 'unit', 'pinned-actions', 'forbidden-paths']);
  });

  test('tokens plan the token checks before unit tests', () => {
    const { steps } = planFor(['packages/design-system/tokens/a.json']);
    assert.equal(steps[0], 'tokens-api-check');
    assert.ok(steps.indexOf('tokens-check') < steps.indexOf('unit'));
    assert.deepEqual(steps.filter((id) => id !== 'tokens-api-check'), planTypes(['component']).steps);
  });

  test('a step that a planned step runs as a part is not planned again', () => {
    const { steps } = planFor(['package.json', 'AGENTS.md']);
    assert.ok(steps.includes('check'));
    assert.ok(!steps.includes('check-self'), steps.join(', '));
  });
});

// The plans must run what the jobs Checks needs run, so verify can't pass a commit those jobs fail.
describe('plans match CI', () => {
  const workflow = readWorkflow();

  test('every run line of a blocking ci.yml job is in CI_RUNS, and every CI_RUNS entry is in ci.yml', () => {
    assert.deepEqual(workflowGaps(workflow), []);
  });

  test("each change type's plan runs every step its CI_RUNS entries list", () => {
    assert.deepEqual(ciGaps(), []);
  });

  test('the blocking jobs are the ones Checks needs', () => {
    const jobs = new Set(blockingRuns(workflow).map((item) => item.job));
    assert.deepEqual([...jobs].sort(), [...workflow.jobs.checks.needs].sort());
  });

  test('a new CI command fails and names the fix', () => {
    const changed = structuredClone(workflow);
    changed.jobs.build.steps.push({ run: 'pnpm brand-new-check' });
    const problems = workflowGaps(changed);
    assert.equal(problems.length, 1);
    assert.match(problems[0], /build job runs "pnpm brand-new-check", which no CI_RUNS entry in verify\.mjs names; add one/);
  });

  test('a second command in a run block needs its own entry', () => {
    const changed = structuredClone(workflow);
    const step = changed.jobs.docs.steps.find((item) => item.run === 'pnpm --filter docs test:axe');
    step.run = 'pnpm --filter docs test:axe\npnpm --filter docs test:brand-new';
    const problems = workflowGaps(changed);
    assert.equal(problems.length, 1, problems.join('\n'));
    assert.match(problems[0], /docs job runs "pnpm --filter docs test:brand-new", which no CI_RUNS entry/);
  });

  test("the docs browser line in Fernway's block is its own run", () => {
    assert.ok(blockingRuns(workflow).some((item) => item.job === 'fernway' && item.run.startsWith('pnpm --filter docs test:browser')));
  });

  test('a CI command that is gone fails', () => {
    const changed = structuredClone(workflow);
    changed.jobs.build.steps = changed.jobs.build.steps.filter((step) => step.run !== 'pnpm ssr:smoke');
    assert.match(workflowGaps(changed).join('\n'), /CI_RUNS names "pnpm ssr:smoke" in the build job, which ci\.yml no longer runs there/);
  });

  test('a CI command that no longer matches its step fails', () => {
    const changed = structuredClone(workflow);
    const step = changed.jobs['rule-checker'].steps.find((item) => item.run === 'pnpm check:self');
    step.run = 'pnpm check:self --strict';
    assert.match(workflowGaps(changed).join('\n'), /runs "pnpm check:self --strict", but STEPS\.check-self runs "pnpm check:self"/);
  });

  test('a plan that drops a step CI runs fails and names the fix', () => {
    const component = CHANGE_TYPES.find((type) => type.id === 'component');
    const saved = component.steps;
    component.steps = saved.filter((id) => id !== 'ssr-smoke');
    try {
      assert.match(ciGaps().join('\n'), /the component plan leaves out ssr-smoke, which CI's build job runs as "pnpm ssr:smoke"; add 'ssr-smoke' to CHANGE_TYPES\.component\.steps/);
    } finally {
      component.steps = saved;
    }
  });

  test('a job that runs on every change lists every change type', () => {
    for (const entry of CI_RUNS.filter((item) => ['rule-checker', 'forbidden-paths'].includes(item.job))) {
      assert.deepEqual(entry.types, CHANGE_TYPES.map((type) => type.id), entry.run);
    }
  });

  const plan = (id) => planTypes([id]).steps;

  test('a component plan runs the checks CI requires of a package change', () => {
    const steps = plan('component');
    for (const id of ['typecheck', 'lint', 'stylelint', 'check-self', 'schema', 'unit', 'browser', 'build-ds', 'publish-check', 'ssr-smoke', 'tokens-check', 'changeset']) {
      assert.ok(covers(steps, id), `component plan leaves out ${id}: ${steps.join(', ')}`);
    }
    assert.deepEqual(STEPS['ssr-smoke'].cmd, ['pnpm', 'ssr:smoke']);
    assert.deepEqual(STEPS['tokens-check'].cmd, ['pnpm', '--filter', '@tounsoo/todae', 'tokens:check', '--base', '{base}']);
    assert.deepEqual(STEPS['check-self'].cmd, ['pnpm', 'check:self']);
    assert.deepEqual(STEPS.changeset.cmd, ['pnpm', 'changeset', 'status', '--since={base}']);
  });

  test('an agent plan runs the rule table check beside the verify tests', () => {
    const steps = plan('agent');
    for (const id of ['verify-self-test', 'verify-tests', 'check-self']) assert.ok(steps.includes(id), id);
  });

  test('a docs plan runs axe and peek on the built site after its build', () => {
    const steps = plan('docs');
    for (const id of ['typecheck', 'lint', 'check-self', 'docs-unit', 'docs-browser', 'docs-build', 'docs-axe', 'docs-peek', 'drive']) {
      assert.ok(covers(steps, id), id);
    }
    assert.ok(steps.indexOf('docs-build') < steps.indexOf('docs-axe'));
    assert.ok(steps.indexOf('docs-build') < steps.indexOf('docs-peek'));
    assert.deepEqual(STEPS['docs-axe'].cmd, ['pnpm', '--filter', 'docs', 'test:axe']);
    assert.deepEqual(STEPS['docs-peek'].cmd, ['pnpm', '--filter', 'docs', 'test:peek']);
  });

  test("check's parts are commands its package script runs", () => {
    const script = JSON.parse(readFileSync(path.join(repoRoot, 'package.json'), 'utf8')).scripts.check;
    const pieces = script.split('&&').map((piece) => piece.trim());
    for (const part of STEPS.check.parts) assert.ok(pieces.includes(STEPS[part].cmd.join(' ')), part);
  });

  test('a recursive script runs a workspace script as a part, and only one the package has', () => {
    const packages = new Map([['docs', { scripts: { 'test:browser': 'vitest' } }]]);
    assert.ok(runsPart('pnpm -r --if-present test:browser', ['pnpm', '--filter', 'docs', 'test:browser'], packages));
    assert.ok(!runsPart('pnpm -r --if-present test:browser', ['pnpm', '--filter', 'fernway-example', 'test:browser'], packages));
    assert.ok(!runsPart('pnpm -r --if-present test', ['pnpm', '--filter', 'docs', 'test:browser'], packages));
  });

  test('the Playwright hint names and installs every browser the tests launch', () => {
    const config = readFileSync(path.join(repoRoot, 'packages/design-system/vitest.browser.config.ts'), 'utf8');
    const launched = [...new Set([...config.matchAll(/browser: '(\w+)'/g)].map((match) => match[1]))];
    assert.deepEqual(launched.sort(), ['chromium', 'firefox', 'webkit']);
    for (const id of ['browser', 'browser-firefox', 'browser-webkit', 'docs-browser', 'docs-axe', 'docs-peek']) {
      const reason = STEPS[id].blockedReason;
      for (const name of launched) {
        assert.match(reason, new RegExp(name, 'i'), `${id} hint leaves out ${name}`);
      }
      assert.match(reason, /playwright install --with-deps chromium firefox webkit\.$/);
    }
  });

  // On macOS, WebKit and the scroll-lock Chromium start through scripts/macos-browser.sh, and Playwright checks only
  // that the wrapper exists. Its missing-browser line has to read as a missing install too.
  test("the macOS browser wrapper's missing-browser line is BLOCKED with the install command", () => {
    const script = readFileSync(path.join(repoRoot, 'scripts/macos-browser.sh'), 'utf8');
    const line = /echo "(macos-browser\.sh: Executable doesn't exist at[^"]*)"/.exec(script)?.[1];
    assert.ok(line, 'scripts/macos-browser.sh has no missing-browser line');
    for (const id of ['browser-webkit', 'docs-browser', 'docs-peek']) assert.match(line.replace('$browser', '/x/Playwright'), STEPS[id].blockedWhen, id);
  });

  // Playwright's Firefox failed to start on macOS 27 ("Could not find profile folder"), and the helper called
  // that "not installed". Only a missing browser is BLOCKED; a launch failure is a FAIL with its log.
  test('a browser that is installed but fails to start is not reported as missing', () => {
    const missing = STEPS.browser.blockedWhen;
    assert.match("browserType.launch: Executable doesn't exist at /x/firefox", missing);
    assert.match('Please run the following command to download new browsers:\n    npx playwright install', missing);
    assert.doesNotMatch('Error: browserType.launch: Failed to launch the browser process.\n[err] Could not find profile folder.', missing);
  });
});

describe('docs test servers', () => {
  // Another checkout's docs server on 3100 made axe fail to start, and let peek test that checkout's build.
  test('axe and peek get a free port and never reuse a server already running', () => {
    for (const id of ['docs-axe', 'docs-peek']) assert.equal(STEPS[id].portEnv, 'TODAE_DOCS_TEST_PORT', id);
    for (const file of ['apps/docs/playwright.config.ts', 'apps/docs/playwright.peek.config.ts']) {
      const config = readFileSync(path.join(repoRoot, file), 'utf8');
      assert.match(config, /process\.env\.TODAE_DOCS_TEST_PORT/, file);
      assert.match(config, /reuseExistingServer: false/, file);
    }
  });
});

// #523 found 3100 busy and #530 found 3322 busy, each held by another checkout's docs server, and verify's drive
// stopped BLOCKED on "port 3322 is answered by a process this helper did not start". Verify picks the port itself.
describe('the verify docs server', () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'verify-port-'));
  const bin = path.join(dir, 'bin');
  const helper = path.join(dir, '.claude/skills/verify/verify.mjs');
  const held = [];
  const thieves = [];
  after(async () => {
    spawnSync(process.execPath, [helper, 'cleanup'], { cwd: dir });
    for (const pid of thieves) {
      try {
        process.kill(pid, 'SIGKILL');
      } catch {}
    }
    await Promise.all(
      held.map(
        (server) =>
          new Promise((resolve) => {
            server.closeAllConnections?.();
            server.close(resolve);
          }),
      ),
    );
    rmSync(dir, { recursive: true, force: true });
  });
  mkdirSync(bin, { recursive: true });
  mkdirSync(path.dirname(helper), { recursive: true });
  cpSync(path.join(here, 'verify.mjs'), helper);
  // A docs-like page in the path's language, which the drive passes.
  const page = `(req, res) => res.end('<html lang="' + (req.url.startsWith('/ko') ? 'ko' : 'en') + '" data-appearance="light"><h1>Home</h1></html>')`;
  // A stand-in for `pnpm --filter docs exec next dev --port <n>`: it serves that page on that port.
  writeFileSync(
    path.join(bin, 'pnpm'),
    `#!${process.execPath}\nconst port = Number(process.argv[process.argv.indexOf('--port') + 1]);\n` +
      `const fs = require('node:fs'), { spawn } = require('node:child_process');\n` +
      // With TAKEN_ONCE set, the first start finds its port taken, as when another process wins the race for it.
      `const once = process.env.TAKEN_ONCE;\n` +
      `if (once && !fs.existsSync(once)) { fs.writeFileSync(once, String(port)); console.error('Error: listen EADDRINUSE: address already in use'); process.exit(1); }\n` +
      // With THIEF_ONCE set, another process takes the port first and answers like the docs, while this one stays
      // up without serving it, as next dev on a Mac does when it binds [::] beside a server on 127.0.0.1.
      `const thief = process.env.THIEF_ONCE;\n` +
      `if (thief && !fs.existsSync(thief)) {\n` +
      `  const child = spawn(process.execPath, ['-e', "require('node:http').createServer(" + ${JSON.stringify(page)} + ").listen(" + port + ", '127.0.0.1')"], { detached: true, stdio: 'ignore' });\n` +
      `  child.unref(); fs.writeFileSync(thief, port + ' ' + child.pid); setInterval(() => {}, 1e5);\n` +
      `} else require('node:http').createServer(${page}).listen(port, '127.0.0.1');\n`,
    { mode: 0o755 },
  );
  writeFileSync(path.join(dir, '.gitignore'), '.verify/\nevidence/\ntaken-once\nthief-once\n');
  const git = (...argv) => execFileSync('git', argv, { cwd: dir, encoding: 'utf8' });
  git('init', '-q', '-b', 'main');
  git('add', '.');
  git('-c', 'user.email=test@example.com', '-c', 'user.name=Test', 'commit', '-qm', 'base', '--no-verify');
  const env = { ...process.env, PATH: `${bin}${path.delimiter}${process.env.PATH}` };

  // The ports past runs found busy, held by a server verify did not start. One already held elsewhere is busy too.
  const hold = (port) =>
    new Promise((resolve) => {
      const server = http.createServer((_, res) => res.end('another checkout'));
      server.once('error', resolve);
      server.listen(port, '127.0.0.1', () => {
        held.push(server);
        resolve();
      });
    });
  const busy = [3100, 3322];

  test('launch starts on a free port when the old default ports are busy', async () => {
    await Promise.all(busy.map(hold));
    const run = spawnSync(process.execPath, [helper, 'launch'], { cwd: dir, env, encoding: 'utf8', timeout: 60_000 });
    assert.equal(run.status, 0, run.stdout + run.stderr);
    const port = Number(/launch ready http:\/\/127\.0\.0\.1:(\d+) /.exec(run.stdout)?.[1]);
    assert.ok(port > 0 && !busy.includes(port), run.stdout);
    assert.equal(spawnSync(process.execPath, [helper, 'cleanup'], { cwd: dir, encoding: 'utf8' }).status, 0);
  });

  test('launch picks another free port when its first one is taken before the server binds it', () => {
    const taken = path.join(dir, 'taken-once');
    const run = spawnSync(process.execPath, [helper, 'launch'], { cwd: dir, env: { ...env, TAKEN_ONCE: taken }, encoding: 'utf8', timeout: 60_000 });
    assert.equal(run.status, 0, run.stdout + run.stderr);
    const port = Number(/launch ready http:\/\/127\.0\.0\.1:(\d+) /.exec(run.stdout)?.[1]);
    assert.ok(port > 0 && String(port) !== readFileSync(taken, 'utf8'), run.stdout);
    assert.equal(spawnSync(process.execPath, [helper, 'cleanup'], { cwd: dir, encoding: 'utf8' }).status, 0);
  });

  // launch trusts a reply when lsof can't name the listener, so this needs lsof, as macOS and CI's Ubuntu have.
  const lsof = spawnSync('lsof', ['-v'], { stdio: 'ignore' }).error === undefined;
  test('launch moves to another free port when a server it did not start answers on its first one', { skip: !lsof && 'no lsof' }, () => {
    const marker = path.join(dir, 'thief-once');
    const run = spawnSync(process.execPath, [helper, 'launch'], { cwd: dir, env: { ...env, THIEF_ONCE: marker }, encoding: 'utf8', timeout: 60_000 });
    const [stolen, thief] = readFileSync(marker, 'utf8').split(' ').map(Number);
    thieves.push(thief);
    assert.equal(run.status, 0, run.stdout + run.stderr);
    const port = Number(/launch ready http:\/\/127\.0\.0\.1:(\d+) /.exec(run.stdout)?.[1]);
    assert.ok(port > 0 && port !== stolen, run.stdout);
    assert.equal(spawnSync(process.execPath, [helper, 'cleanup'], { cwd: dir, encoding: 'utf8' }).status, 0);
  });

  test('the drive step starts its server on a free port when the old default ports are busy', async () => {
    await Promise.all(busy.map(hold));
    const { STEPS: steps, executeDrive } = await import(pathToFileURL(helper).href);
    const evidence = path.join(dir, 'evidence');
    mkdirSync(evidence, { recursive: true });
    const path0 = process.env.PATH;
    process.env.PATH = env.PATH;
    try {
      const { result } = await executeDrive(steps.drive, 1, evidence, {}, ['/']);
      const log = readFileSync(path.join(dir, result.log), 'utf8');
      assert.doesNotMatch(log, /is answered by a process this helper did not start/);
      const port = Number(/launched http:\/\/127\.0\.0\.1:(\d+) /.exec(log)?.[1]);
      assert.ok(port > 0 && !busy.includes(port), log);
      assert.match(log, /cleaned up the docs server this run started/);
      // The whole drive ran against that server: it is this checkout's, at HEAD, and both pages passed.
      assert.equal(result.status, 'passed', log);
    } finally {
      process.env.PATH = path0;
    }
  });
});

describe('nodeIcu', () => {
  // The Air's Homebrew node@24: its system ICU wrote ko dates as 2026/10/13, and five date tests failed there.
  test("a node that links the system ICU is a problem that names the fix", () => {
    const result = nodeIcu({ icu_gyp_path: 'tools/icu/icu-system.gyp' }, { icu: '79.1', cldr: '49.0' });
    assert.equal(result.ok, false);
    assert.match(result.detail, /system ICU 79\.1, CLDR 49\.0.*nodejs\.org, nvm or fnm/);
  });

  test('an official build, with its own ICU, passes', () => {
    assert.equal(nodeIcu({ icu_gyp_path: 'tools/icu/icu-generic.gyp' }, { icu: '78.3', cldr: '48.0' }).ok, true);
  });
});

describe('forbidden-paths step', () => {
  test("runs under any bash, macOS's 3.2 included, with no version gate", () => {
    const step = STEPS['forbidden-paths'];
    assert.equal(step.blockedWhen, undefined);
    assert.doesNotMatch(step.cmd.join(' '), /BASH_VERSINFO|bash 4/);
  });
});

describe('expandNeeds', () => {
  test('adds needs at any depth, each before what needs it', () => {
    assert.deepEqual(expandNeeds(['docs-axe']), ['build-ds', 'docs-build', 'docs-axe']);
    assert.deepEqual(expandNeeds(['docs-peek', 'docs-axe']), ['build-ds', 'docs-build', 'docs-peek', 'docs-axe']);
  });
});

describe('withBase', () => {
  test('puts the plan base into the command', () => {
    assert.deepEqual(withBase(['pnpm', 'changeset', 'status', '--since={base}'], BASE), ['pnpm', 'changeset', 'status', `--since=${BASE}`]);
  });

  test('leaves a command without {base} alone, even with no base', () => {
    assert.deepEqual(withBase(['pnpm', 'test'], null), ['pnpm', 'test']);
  });

  test('refuses anything but a full SHA', () => {
    assert.throws(() => withBase(['git', 'diff', '{base}...HEAD'], 'main; rm -rf /'), /plan base/);
    assert.throws(() => withBase(['git', 'diff', '{base}...HEAD'], null), /plan base/);
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

  test('the shared MDX pages render each docs component mdx-components.tsx registers, so a change there shows on them', () => {
    const registry = readFileSync(path.join(repoRoot, 'apps/docs/mdx-components.tsx'), 'utf8');
    const local = new Set();
    // Every local name bound by an import from ./components/, whatever the import's shape.
    for (const match of registry.matchAll(/^import\s+(?!type\b)([^;'"]+?)\s+from\s+['"]\.\/components\//gm)) {
      for (const part of match[1].replace(/[{}]/g, ',').split(',')) {
        const name = part.trim().split(/\s+as\s+/).pop().replace(/^\*\s*/, '').trim();
        if (name) local.add(name);
      }
    }
    const body = /const components = \{([^}]+)\}/.exec(registry)[1];
    const entries = body.split(',').map((item) => item.trim()).filter(Boolean).map((item) => {
      const [key, value = key] = item.split(':').map((part) => part.trim());
      return { key, value: value.split('.')[0] };
    });
    const remark = readFileSync(path.join(repoRoot, 'apps/docs/lib/remarkPageContents.mjs'), 'utf8');
    // The page text outside fenced code samples, which render as code, not as components.
    const pages = ['apps/docs/app/(en)/button/page.mdx', 'apps/docs/app/(en)/field/select/page.mdx']
      .map((file) => readFileSync(path.join(repoRoot, file), 'utf8'))
      .map((text) => ({ fenced: /^```/m.test(text), prose: text.replace(/^```[\s\S]*?^```/gm, '') }));
    const ELEMENTS = {
      a: /\]\(/,
      code: /`[^`\n]+`/,
      h2: /^## /m,
      h3: /^### /m,
      hr: /^---$/m,
      p: /^[A-Za-z]/m,
    };
    const shows = (key) => {
      if (key === 'pre') return pages.every((page) => page.fenced);
      if (ELEMENTS[key]) return pages.every((page) => ELEMENTS[key].test(page.prose));
      if (!/^[A-Z]/.test(key)) return false;
      if (pages.every((page) => new RegExp(`<${key}[\\s>/]`).test(page.prose))) return true;
      // remarkPageContents wraps every MDX page in DocsPage, and adds PageContentsFold
      // when the page has two sections or more.
      if (!remark.includes(`jsx('${key}'`)) return false;
      return key === 'DocsPage' || pages.every((page) => (page.prose.match(/^## /gm) ?? []).length >= 2);
    };
    assert.ok(local.size > 0);
    assert.ok(!local.has(''));
    for (const name of local) {
      const keys = entries.filter((entry) => entry.value === name).map((entry) => entry.key);
      assert.ok(keys.some(shows), `${name} (registered as ${keys.join(', ')}) is not shown on /button and /field/select`);
    }
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

  test('a docs file one page imports drives that page, also through another file', () => {
    const importers = importGraph([
      { file: 'apps/docs/app/(en)/badge/page.mdx', text: "import { BadgeTones } from '../../../components/demos/BadgeDemo';" },
      { file: 'apps/docs/app/ko/badge/page.mdx', text: "import { BadgeTones } from '../../../components/demos/BadgeDemo';" },
      { file: 'apps/docs/components/demos/BadgeDemo.tsx', text: "import { tone } from './tones.ts';\nexport { x } from \"../../lib/x\";" },
      { file: 'apps/docs/components/demos/tones.ts', text: '' },
      { file: 'apps/docs/lib/x/index.ts', text: '' },
    ]);
    assert.deepEqual(routesFor(['apps/docs/components/demos/BadgeDemo.tsx'], () => true, importers), ['/badge', '/ko/badge']);
    assert.deepEqual(routesFor(['apps/docs/components/demos/tones.ts'], () => true, importers), ['/badge', '/ko/badge']);
    assert.deepEqual(routesFor(['apps/docs/lib/x/index.ts'], () => true, importers), ['/badge', '/ko/badge']);
  });

  test('a docs file a layout imports also drives the shared set', () => {
    const importers = importGraph([
      { file: 'apps/docs/app/(en)/layout.tsx', text: "import { Nav } from '../../components/Nav';" },
      { file: 'apps/docs/app/(en)/button/page.mdx', text: "import { Nav } from '../../../components/Nav';" },
      { file: 'apps/docs/components/Nav.tsx', text: '' },
    ]);
    assert.deepEqual(routesFor(['apps/docs/components/Nav.tsx'], () => true, importers), ['/button', '/ko/button', ...shared.slice(0, 2), ...shared.slice(4)]);
  });

  test('a changed layout drives the shared set even when a page imports it', () => {
    const importers = importGraph([
      { file: 'apps/docs/app/(en)/button/page.mdx', text: "import x from '../layout';" },
      { file: 'apps/docs/app/(en)/layout.tsx', text: '' },
    ]);
    assert.deepEqual(routesFor(['apps/docs/app/(en)/layout.tsx'], () => true, importers), ['/button', '/ko/button', ...shared.slice(0, 2), ...shared.slice(4)]);
  });

  test('a docs file the MDX renderers import also drives the shared set', () => {
    const importers = importGraph([
      { file: 'apps/docs/mdx-components.tsx', text: "import { LocalizedLink } from './components/LocalizedLink';" },
      { file: 'apps/docs/app/(en)/link/page.mdx', text: "import { LocalizedLink } from '../../../components/LocalizedLink';" },
      { file: 'apps/docs/components/LocalizedLink.tsx', text: '' },
    ]);
    assert.deepEqual(routesFor(['apps/docs/components/LocalizedLink.tsx'], () => true, importers), ['/link', '/ko/link', ...shared]);
  });

  test('in this repo, the badge demo drives only the badge pages', async () => {
    const { execFileSync: run } = await import('node:child_process');
    const files = run('git', ['-c', 'core.quotePath=false', 'ls-files', '--', 'apps/docs'], { cwd: repoRoot, encoding: 'utf8' })
      .split('\n')
      .filter((file) => /\.(?:mdx?|[cm]?[jt]sx?|css)$/.test(file));
    const importers = importGraph(files.map((file) => ({ file, text: readFileSync(path.join(repoRoot, file), 'utf8') })));
    assert.deepEqual(routesFor(['apps/docs/examples/badge/BadgeTones.tsx'], () => true, importers), ['/badge', '/ko/badge']);
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
      { id: 'browser', command: 'pnpm test:browser', status: 'blocked', reason: STEPS.browser.blockedReason },
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
        '- `pnpm test:browser`: blocked. Playwright Chromium, Firefox or WebKit is not installed. Run pnpm --filter @tounsoo/todae exec playwright install --with-deps chromium firefox webkit.',
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
  test('a report with no base says so instead of printing null', () => {
    assert.match(renderBody({ ...report, base: null }, SHA), /^Tested commit: .*\nBase: not resolved\nVerdict: BLOCKED/);
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

  test('a page that fails is not hidden by a walled page', async () => {
    const base = await start((request, response) => {
      if (request.url.startsWith('/ko')) return response.writeHead(403).end();
      response.writeHead(500).end('boom');
    });
    const driven = await driveSite(base.origin, ['/'], {}, { remote: true });
    assert.equal(driven.blocked, null);
    assert.deepEqual(driven.pages.map((item) => [item.path, item.ok]), [['/', false], ['/ko', false]]);
    const body = renderBody({ verdict: 'FAIL', head: SHA, base: BASE, results: [{ id: 'drive', status: 'failed' }], drive: driven }, SHA);
    assert.match(body, /- Drive: `\/` failed\. returned 500/);
    assert.match(body, /- Drive: `\/ko` blocked\. the preview answered 403/);
  });

  test('a page that fails is not hidden by a later network error', async () => {
    const base = await start((request, response) => {
      if (request.url.startsWith('/ko')) return response.socket.destroy();
      response.writeHead(500).end('boom');
    });
    const driven = await driveSite(base.origin, ['/'], {}, { remote: true });
    assert.equal(driven.blocked, null);
    assert.equal(driven.pages[0].ok, false);
    assert.deepEqual(driven.unreached.paths, ['/ko']);
    const body = renderBody({ verdict: 'FAIL', head: SHA, base: BASE, results: [{ id: 'drive', status: 'failed' }], drive: driven }, SHA);
    assert.match(body, /- Drive: `\/ko` not reached\. could not reach http:\/\/127\.0\.0\.1:\d+/);
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

    test('a base ahead of the merge base plans from the merge base, as the diff does', () => {
      const mergeBase = git('rev-parse', 'origin/main').trim();
      const head = git('rev-parse', 'HEAD').trim();
      git('checkout', '-q', '-b', 'side', mergeBase);
      write('later.md', 'y');
      git('add', '.');
      git('commit', '-qm', 'later on main');
      git('update-ref', 'refs/remotes/origin/main', 'HEAD');
      git('checkout', '-q', head);
      const out = JSON.parse(plan('--base', 'origin/main').stdout);
      assert.equal(out.base, mergeBase);
      assert.ok(!out.files.includes('later.md'));
      assert.equal(JSON.parse(plan().stdout).base, mergeBase);
    });

    test('a base with no shared history is BLOCKED, not a crash', () => {
      const lone = execFileSync('git', ['commit-tree', git('rev-parse', 'HEAD^{tree}').trim(), '-m', 'lone'], { cwd: dir, encoding: 'utf8' }).trim();
      const run = plan('--base', lone);
      assert.equal(run.status, 2, run.stderr);
      assert.match(run.stdout, /no merge base between .* and HEAD; pick a base that shares history with HEAD/);
    });

    test('plan is BLOCKED when origin/main is missing', () => {
      git('update-ref', '-d', 'refs/remotes/origin/main');
      const run = plan();
      assert.equal(run.status, 2);
      assert.match(run.stdout, /fetch origin main first/);
    });
  });
});
