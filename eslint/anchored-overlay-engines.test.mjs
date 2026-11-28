import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { describe, it } from 'node:test';
import { ESLint, RuleTester } from 'eslint';
import tseslint from 'typescript-eslint';
import plugin from './todae.mjs';

RuleTester.describe = describe;
RuleTester.it = it;
RuleTester.itOnly = it.only;

const tester = new RuleTester({
  languageOptions: {
    parser: tseslint.parser,
    parserOptions: { ecmaFeatures: { jsx: true } },
  },
});

const imports = [
  "import { server } from 'vitest/browser';",
  "import { Popover } from '../components/Popover.js';",
  "import { Field } from '../components/Field.js';",
  "import { Tabs } from '../components/Tabs.js';",
  "import { usePopover } from '../hooks/usePopover.js';",
].join('\n');
const code = (body) => `${imports}\n${body}`;
const error = { messageId: 'skipsEngine' };

tester.run('anchored-overlay-engines', plugin.rules['anchored-overlay-engines'], {
  valid: [
    // Every engine asserts.
    code("it('slides', () => { render(<Popover.Root />); expect(gap()).toBeLessThan(4); });"),
    // An engine's own expected value or tolerance.
    code("it('slides', () => { render(<Popover.Root />); expect(gap()).toBeCloseTo(server.browser === 'webkit' ? 1.5 : 1); });"),
    code("const slack = server.browser === 'chromium' ? 1 : 1.5;\nit('slides', () => { render(<Popover.Root />); expect(gap()).toBeLessThan(slack); });"),
    // Each branch asserts, through a helper of the file too.
    code(
      "function atEnd() { expect(gap()).toBe(0); }\nit('moves', () => { render(<Popover.Root />); if (server.browser === 'firefox') atEnd(); else expect(gap()).toBeGreaterThan(1); });",
    ),
    // A step that differs by engine but skips no assertion.
    code("it('opens', async () => { render(<Popover.Root />); if (server.browser === 'webkit') await frame(); expect(open()).toBe(true); });"),
    // A return from a helper that picks a value is not a return from the test.
    code(
      "it('slides', () => { render(<Popover.Root />); const slack = () => { if (server.browser === 'webkit') return 2; return 1; }; expect(gap()).toBeLessThan(slack()); });",
    ),
    // Not an anchored overlay: motion only has to work in Chrome there (ARCHITECTURE "Motion").
    code("it('fades the panel', () => { if (server.browser !== 'chromium') return; render(<Tabs.Root />); expect(1).toBe(1); });"),
    code("it.runIf(server.browser === 'chromium')('fades the panel', () => { render(<Tabs.Root />); });"),
    // A test that drives Chromium's CDP session, directly or through a helper.
    code("it.runIf(server.browser === 'chromium')('names the dialog', async () => { render(<Popover.Root />); await cdp().send('Accessibility.enable'); });"),
    code(
      "const session = () => cdp();\nconst axIt = it.runIf(server.browser === 'chromium');\naxIt('names the dialog', async () => { render(<Popover.Root />); await session().send('A'); });",
    ),
  ],
  invalid: [
    // #525's slide tests, as they merged.
    {
      code: code(
        "function Slide() { const popover = usePopover({ defaultOpen: true }); return <Popover.Root {...popover.getPopoverProps()} />; }\n" +
          "it.each([false, true])('slides from its trigger by the offset, by layout, above %s', async (above) => {\n" +
          "  // Motion only has to work in Chrome (ARCHITECTURE \"Motion\").\n" +
          "  if (server.browser !== 'chromium') return;\n" +
          '  render(<Slide above={above} />);\n' +
          '  expect(gap()).toBeLessThan(4);\n' +
          '});',
      ),
      errors: [error],
    },
    { code: code("it('slides', () => { render(<Popover.Root />); if (server.browser === 'chromium') expect(running).toContain('opacity'); });"), errors: [error] },
    { code: code("it('slides', () => { render(<Popover.Root />); server.browser === 'chromium' && expect(gap()).toBe(1); });"), errors: [error] },
    { code: code("it('slides', ({ skip }) => { if (server.browser === 'webkit') skip(); render(<Popover.Root />); });"), errors: [error] },
    { code: code("it.runIf(server.browser === 'chromium')('slides', () => { render(<Popover.Root />); });"), errors: [error] },
    { code: code("it.skipIf(server.browser === 'webkit')('slides', () => { render(<Field.Picker />); });"), errors: [error] },
    { code: code("describe.runIf(server.browser === 'chromium')('Popover', () => { it('slides', () => { usePopover(); }); });"), errors: [error] },
    { code: code("const motionIt = it.runIf(server.browser === 'chromium');\nmotionIt('slides', () => { render(<Popover.Root />); });"), errors: [error] },
    // Through a value of the file, or the user agent.
    { code: code("const chrome = server.browser === 'chromium';\nit('slides', () => { render(<Popover.Root />); if (!chrome) return; expect(1).toBe(1); });"), errors: [error] },
    { code: code("it('slides', () => { render(<Popover.Root />); if (/WebKit/.test(navigator.userAgent)) return; expect(1).toBe(1); });"), errors: [error] },
  ],
});

describe('the repo config', () => {
  const root = new URL('..', import.meta.url).pathname;

  it('runs the rule on the package browser tests at error severity', async () => {
    const eslint = new ESLint({ cwd: root });
    const config = await eslint.calculateConfigForFile('packages/design-system/src/browser/opt-in-motion.browser.test.tsx');
    assert.equal(config.rules['todae/anchored-overlay-engines'][0], 2);
  });

  it("fails the Popover slide tests #525 merged, which returned outside Chromium", async (t) => {
    const file = 'packages/design-system/src/browser/opt-in-motion.browser.test.tsx';
    let source;
    try {
      source = execFileSync('git', ['show', `41882a15:${file}`], { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
    } catch {
      t.skip('a shallow clone has no 41882a15 to read');
      return;
    }
    const [result] = await new ESLint({ cwd: root }).lintText(source, { filePath: file });
    const lines = result.messages.filter((m) => m.ruleId === 'todae/anchored-overlay-engines').map((m) => m.line);
    assert.deepEqual(lines, [102, 118, 159, 206]);
  });
});
