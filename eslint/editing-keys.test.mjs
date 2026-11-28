import assert from 'node:assert/strict';
import { join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { ESLint } from 'eslint';

const root = fileURLToPath(new URL('..', import.meta.url));
const eslint = new ESLint({ cwd: root });

// eslint.config.mjs bans Control editing keys in browser tests: they are Meta on macOS, and 33 tests failed there.
async function flagged(code, file = 'packages/design-system/src/browser/x.browser.test.tsx') {
  const [result] = await eslint.lintText(code, { filePath: join(root, file) });
  return result.messages.filter((m) => m.ruleId === 'no-restricted-syntax').length;
}

test('a browser test that presses Control for select all, copy, paste, cut, undo or redo fails, in every spelling', async () => {
  for (const keys of ['{Control>}a{/Control}', '{Control>}c{/Control}', '{Control>}v{/Control}', '{Control>}x{/Control}', '{Control>}z{/Control}', '{Control>}y{/Control}', '{Control>}A{/Control}', '{Control>}{Shift>}z{/Shift}{/Control}', '{Control>}{Shift>}Z{/Shift}{/Control}', '{Shift>}{Control>}z{/Control}{/Shift}']) {
    assert.equal(await flagged(`await userEvent.keyboard('${keys}');`), 1, keys);
    assert.equal(await flagged('await userEvent.keyboard(`${x}' + keys + '`);'), 1, `template ${keys}`);
  }
});

test('ControlOrMeta, a Control hotkey a product binds, and Control outside a browser test pass', async () => {
  assert.equal(await flagged("await userEvent.keyboard('{ControlOrMeta>}a{/ControlOrMeta}');"), 0);
  assert.equal(await flagged("await userEvent.keyboard('{ControlOrMeta>}{Shift>}z{/Shift}{/ControlOrMeta}');"), 0);
  assert.equal(await flagged("await userEvent.keyboard('{Control>}k{/Control}');"), 0);
  assert.equal(await flagged("fireEvent.keyDown(el, { key: 'a', ctrlKey: true }); const s = '{Control>}a{/Control}';", 'packages/design-system/src/components/x.test.tsx'), 0);
});
