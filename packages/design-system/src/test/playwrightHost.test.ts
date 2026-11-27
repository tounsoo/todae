// @vitest-environment node
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';
import { classicScrollbarsOnHost, firefoxOnHost, webkitOnHost } from '../../../../playwright.host';

const repo = join(import.meta.dirname, '../../../..');
const wrapper = join(repo, 'scripts/macos-browser.sh');

describe('playwright.host.ts', () => {
  it('changes nothing off macOS, so CI launches every browser as before', () => {
    const options = { ignoreDefaultArgs: ['--hide-scrollbars'] };
    for (const platform of ['linux', 'win32'] as const) {
      expect(firefoxOnHost(options, platform)).toBe(options);
      expect(webkitOnHost('/pw/webkit', options, platform)).toBe(options);
      expect(classicScrollbarsOnHost('/pw/chromium', options, platform)).toBe(options);
    }
  });

  it('on macOS, starts WebKit and Chromium through the wrapper with their Cocoa defaults, and keeps the options', () => {
    const webkit = webkitOnHost('/pw/webkit', {}, 'darwin');
    expect(webkit.executablePath).toBe(wrapper);
    expect(webkit.env).toMatchObject({ TODAE_BROWSER: '/pw/webkit', TODAE_COCOA_DEFAULTS: '-AppleKeyboardUIMode 2' });
    const chromium = classicScrollbarsOnHost('/pw/chromium', { ignoreDefaultArgs: ['--hide-scrollbars'] }, 'darwin');
    expect(chromium).toMatchObject({
      executablePath: wrapper,
      ignoreDefaultArgs: ['--hide-scrollbars'],
      env: { TODAE_BROWSER: '/pw/chromium', TODAE_COCOA_DEFAULTS: '-AppleShowScrollBars Always' },
    });
    expect(firefoxOnHost({}, 'darwin').env?.CFFIXED_USER_HOME).toMatch(/todae-firefox-home-/);
  });

  // Playwright loads apps/docs/playwright.peek.config.ts, and this file with it, as CommonJS. import.meta there is
  // a syntax error, which stopped peek on a Mac before it ran a test, so load it the same way here.
  it('loads as CommonJS, as Playwright loads it from the peek config', () => {
    const source = readFileSync(join(repo, 'playwright.host.ts'), 'utf8');
    const { outputText } = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } });
    const module = { exports: {} as Record<string, unknown> };
    new Function('require', 'module', 'exports', '__dirname', outputText)(require, module, module.exports, repo);
    expect(typeof module.exports.webkitOnHost).toBe('function');
  });
});

describe('scripts/macos-browser.sh', () => {
  const run = (env: Record<string, string>, ...args: string[]) =>
    spawnSync('/bin/bash', [wrapper, ...args], { encoding: 'utf8', env: { PATH: process.env.PATH ?? '', ...env } });

  it("runs the browser with Playwright's arguments, then the Cocoa defaults, and drops its own variables", () => {
    const script = 'console.log(JSON.stringify([process.argv.slice(1), process.env.TODAE_BROWSER ?? null]))';
    const result = run({ TODAE_BROWSER: process.execPath, TODAE_COCOA_DEFAULTS: '-AppleKeyboardUIMode 2' }, '-e', script, '--', '--headless');
    expect(result.status, result.stderr).toBe(0);
    expect(JSON.parse(result.stdout)).toEqual([['--headless', '-AppleKeyboardUIMode', '2'], null]);
  });

  // Playwright checks only that the wrapper exists, so the wrapper reports a missing browser the way Playwright
  // does, and the verify helper calls it a missing install (BLOCKED with the install command), not a failure.
  it('says a missing browser does not exist, in the words the verify helper reads as a missing install', () => {
    const result = run({ TODAE_BROWSER: '/nowhere/Playwright.app/Contents/MacOS/Playwright' });
    expect(result.status).toBe(1);
    expect(result.stderr).toMatch(/Executable doesn't exist at \/nowhere\/.*npx playwright install/);
  });
});
