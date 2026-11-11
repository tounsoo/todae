import assert from 'node:assert/strict';
import { test } from 'node:test';
import stylelint from 'stylelint';
import projectConfig from '../stylelint.config.mjs';

const ruleName = 'todae/disabled-state';
const file = 'packages/design-system/src/components/Button.module.css';

const config = {
  plugins: ['./stylelint/disabled-state.mjs'],
  rules: { [ruleName]: [true, { severity: 'warning' }] },
};

async function lint(code) {
  const result = await stylelint.lint({ code, codeFilename: file, config });
  const report = result.results[0];
  assert.equal(report.errored, false);
  return report.warnings.map((warning) => {
    assert.equal(warning.rule, ruleName);
    if (warning.text.startsWith('Unexpected opacity')) return 'opacity';
    const match = warning.text.match(/Unexpected cursor "([^"]+)"/);
    assert.ok(match, warning.text);
    return `cursor ${match[1]}`;
  });
}

test('a disabled state may set not-allowed or inherit, and an enabled state may fade', async () => {
  const good = `.a:disabled, .b[aria-disabled='true'] { cursor: not-allowed; color: var(--todae-button-fg-disabled); }
    .c:disabled { cursor: inherit; }
    .d:not(:disabled) { opacity: 0.5; cursor: pointer; }
    .e:hover:not(:disabled, [aria-disabled='true']) { cursor: pointer; opacity: 0.4; }
    .f:disabled { &:hover { opacity: 0.5; cursor: pointer; } }`;
  assert.deepEqual(await lint(good), []);
});

test('a disabled state may not fade, and its cursor may not be another keyword', async () => {
  assert.deepEqual(await lint(".a:disabled { opacity: 1; }"), ['opacity']);
  assert.deepEqual(await lint(".a[aria-disabled='true'] { opacity: 0.5; cursor: pointer; }"), [
    'opacity',
    'cursor pointer',
  ]);
  assert.deepEqual(await lint('.a:disabled { cursor: not-allowed !important; }'), ['cursor not-allowed !important']);
});

test('the project config rejects disabled opacity at error severity', async () => {
  const result = await stylelint.lint({
    code: '.a:disabled { opacity: 1; }',
    codeFilename: file,
    config: projectConfig,
  });
  const report = result.results[0];
  assert.equal(report.errored, true);
  assert.equal(report.warnings.length, 1);
  assert.equal(report.warnings[0].rule, ruleName);
  assert.equal(report.warnings[0].severity, 'error');
});
