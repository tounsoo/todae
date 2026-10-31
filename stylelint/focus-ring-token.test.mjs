import assert from 'node:assert/strict';
import { test } from 'node:test';
import stylelint from 'stylelint';
import projectConfig from '../stylelint.config.mjs';

const ruleName = 'todae/focus-ring-token';
const button = 'packages/design-system/src/components/Button.module.css';
const pagination = 'packages/design-system/src/components/Pagination.module.css';
const chip = 'packages/design-system/src/components/Chip.module.css';

const config = {
  plugins: ['./stylelint/focus-ring-token.mjs'],
  rules: {
    [ruleName]: [
      true,
      {
        severity: 'warning',
        outlineExceptions: [{ file: 'Pagination.module.css', value: '1px solid CanvasText' }],
      },
    ],
  },
};

async function lint(code, file, lintConfig = config) {
  const result = await stylelint.lint({ code, codeFilename: file, config: lintConfig });
  const report = result.results[0];
  assert.equal(report.errored, false);
  return report.warnings.map((warning) => {
    assert.equal(warning.rule, ruleName);
    const match = warning.text.match(/Unexpected (\S+) "([^"]+)"/);
    assert.ok(match, warning.text);
    return `${match[1]} ${match[2]}`;
  });
}

test('focus and chip rings, outline none, and the negative width offset pass', async () => {
  const good = `.a {
    outline: none;
    outline: var(--todae-focus-ring-width) solid var(--todae-button-ring-focus);
    outline-offset: var(--todae-focus-ring-offset);
  }
  .b {
    outline: var(--todae-chip-ring-width) solid var(--todae-chip-ring-focus);
    outline-offset: var(--todae-chip-ring-offset);
  }
  .c { outline-offset: calc(-1 * var(--todae-focus-ring-width)); }`;
  assert.deepEqual(await lint(good, button), []);
  assert.deepEqual(await lint(good, chip), []);
});

test('a raw outline or offset fails, except the value named for that file', async () => {
  assert.deepEqual(await lint('.a { outline: 2px solid red; }', button), ['outline 2px solid red']);
  assert.deepEqual(await lint('.a { outline: var(--todae-button-border-width) solid var(--todae-focus-ring-color); }', button), [
    'outline var(--todae-button-border-width) solid var(--todae-focus-ring-color)',
  ]);
  assert.deepEqual(await lint('.a { outline-offset: 2px; }', button), ['outline-offset 2px']);
  assert.deepEqual(await lint('.a { outline: 1px solid CanvasText; }', pagination), []);
  assert.deepEqual(await lint('.a { outline: 1px solid CanvasText; }', button), ['outline 1px solid CanvasText']);
  assert.deepEqual(await lint('.a { outline: 2px solid CanvasText; }', pagination), ['outline 2px solid CanvasText']);
});

test('without the file option, Pagination fails the same outline', async () => {
  const bare = {
    plugins: ['./stylelint/focus-ring-token.mjs'],
    rules: { [ruleName]: [true, { severity: 'warning' }] },
  };
  assert.deepEqual(await lint('.a { outline: 1px solid CanvasText; }', pagination, bare), [
    'outline 1px solid CanvasText',
  ]);
});

test('the project config allows Pagination only inside the real forced-colors rule', async () => {
  const quiet = await stylelint.lint({
    code: '@media (forced-colors: active) { .a { outline: 1px solid CanvasText; } }',
    codeFilename: pagination,
    config: projectConfig,
  });
  assert.equal(quiet.results[0].errored, false);
  assert.deepEqual(quiet.results[0].warnings, []);

  const noisy = await stylelint.lint({
    code: '.a { outline: var(--todae-button-border-width) solid var(--todae-focus-ring-color); }',
    codeFilename: button,
    config: projectConfig,
  });
  assert.equal(noisy.results[0].errored, true);
  assert.equal(noisy.results[0].warnings.length, 1);
  assert.equal(noisy.results[0].warnings[0].rule, ruleName);
  assert.equal(noisy.results[0].warnings[0].severity, 'error');
});
