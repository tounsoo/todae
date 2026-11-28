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
  "import { MentionText } from '../components/MentionText.js';",
  "import type { PopoverCloseReason } from '../components/Popover.js';",
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
    // Both sides assert, one inside waitFor's callback (Neon round 1 on #532).
    code(
      "it('lands', async () => { render(<Popover.Root />); if (server.browser === 'firefox') { await waitFor(() => expect(sub.left).toBeCloseTo(0, 0)); } else { expect(sub.right).toBe(1); } });",
    ),
    // A value picked in a callback that doesn't assert.
    code("it('slides', () => { render(<Popover.Root />); const steps = [1].map(() => { if (server.browser === 'webkit') return 2; return 1; }); expect(steps).toHaveLength(1); });"),
    // A type from an anchored module makes no test anchored.
    code("it('fades the panel', () => { const reason: PopoverCloseReason = 'escape'; if (server.browser !== 'chromium') return; render(<Tabs.Root />); expect(reason).toBe('escape'); });"),
    // One CDP test in a Chromium-only suite of non-anchored tests.
    code("describe.runIf(server.browser === 'chromium')('Tabs', () => { it('names', async () => { render(<Tabs.Root />); await cdp().send('A'); }); });"),
    // A helper inside a suite runs only in the tests that call it (Neon round 2 on #532).
    code(
      "describe('mixed', () => { function checkTabs() { if (server.browser !== 'chromium') return; expect(1).toBe(1); } it('tabs', () => { render(<Tabs.Root />); checkTabs(); }); it('popover', () => { render(<Popover.Root />); expect(2).toBe(2); }); });",
    ),
    code(
      "describe('Popover', () => { async function checkAx() { if (server.browser !== 'chromium') return; await cdp().send('A'); expect(1).toBe(1); } it('names', async () => { render(<Popover.Root />); await checkAx(); }); it('slides', () => { render(<Popover.Root />); expect(2).toBe(2); }); });",
    ),
    // A helper declared at the top, called from one test of a mixed suite (Neon round 3 on #532).
    code(
      "function checkTabs() { if (server.browser !== 'chromium') return; expect(1).toBe(1); }\ndescribe('mixed', () => { it('tabs', () => { render(<Tabs.Root />); checkTabs(); }); it('popover', () => { render(<Popover.Root />); expect(2).toBe(2); }); });",
    ),
    code(
      "async function checkAx() { if (server.browser !== 'chromium') return; await cdp().send('A'); expect(1).toBe(1); }\ndescribe('Popover', () => { it('names', async () => { render(<Popover.Root />); await checkAx(); }); it('slides', () => { render(<Popover.Root />); expect(2).toBe(2); }); });",
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
    // Inside waitFor's callback (Neon round 1 on #532).
    { code: code("it('slides', async () => { render(<Popover.Root />); await waitFor(() => { if (server.browser !== 'chromium') return; expect(gap()).toBeLessThan(4); }); });"), errors: [error] },
    { code: code("it('slides', async () => { render(<Popover.Root />); if (server.browser === 'chromium') { await waitFor(() => expect(gap()).toBeLessThan(4)); } });"), errors: [error] },
    // Chained after the gate, directly or on an alias.
    { code: code("it.runIf(server.browser === 'chromium').each([false, true])('slides', (above) => { render(<Popover.Root />); });"), errors: [error] },
    { code: code("const motionIt = it.runIf(server.browser === 'chromium');\nmotionIt.each([false, true])('slides', (above) => { render(<Popover.Root />); });"), errors: [error] },
    // In a helper of the file that an anchored test calls.
    { code: code("function check() { if (server.browser !== 'chromium') return; expect(gap()).toBeLessThan(4); }\nit('slides', () => { render(<Popover.Root />); check(); });"), errors: [error] },
    // MentionText renders Mention's popovers.
    { code: code("it.runIf(server.browser === 'chromium')('peeks', () => { render(<MentionText text=\"@a\" />); });"), errors: [error] },
    // A suite whose one CDP test doesn't excuse the anchored one beside it.
    {
      code: code("describe.runIf(server.browser === 'chromium')('Popover', () => { it('names', async () => { usePopover(); await cdp().send('A'); }); it('slides', () => { render(<Popover.Root />); }); });"),
      errors: [error],
    },
    // A helper inside a suite, called from an anchored test.
    {
      code: code("describe('Popover', () => { function check() { if (server.browser !== 'chromium') return; expect(gap()).toBe(1); } it('slides', () => { render(<Popover.Root />); check(); }); });"),
      errors: [error],
    },
    // A property named cdp drives nothing.
    { code: code("it.runIf(server.browser === 'chromium')('slides', () => { const opts = { cdp: false }; render(<Popover.Root {...opts} />); });"), errors: [error] },
    // The tooltip overlay modules count.
    {
      code: `import { server } from 'vitest/browser';\nimport { wireTooltip } from '../overlay/tooltipWire.js';\nit.runIf(server.browser === 'chromium')('tips', () => { wireTooltip(); });`,
      errors: [error],
    },
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
