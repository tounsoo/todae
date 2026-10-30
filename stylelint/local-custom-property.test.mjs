import assert from 'node:assert/strict';
import { test } from 'node:test';
import stylelint from 'stylelint';
import projectConfig from '../stylelint.config.mjs';

const ruleName = 'todae/local-custom-property';

const config = {
  plugins: ['./stylelint/local-custom-property.mjs'],
  rules: { [ruleName]: [true, { severity: 'warning' }] },
};

async function lint(code) {
  const result = await stylelint.lint({
    code,
    codeFilename: 'packages/design-system/src/components/Button.module.css',
    config,
  });
  const report = result.results[0];
  assert.equal(report.errored, false);
  return report.warnings.map((warning) => {
    assert.equal(warning.rule, ruleName);
    const match = warning.text.match(/Unexpected custom property "([^"]+)"/);
    assert.ok(match, warning.text);
    return match[1];
  });
}

test('a sheet may set a --_ property and may read a token', async () => {
  assert.deepEqual(await lint('.a { --_button-bg: var(--todae-button-bg); color: var(--todae-button-fg); }'), []);
});

test('a sheet may not declare a --todae- property', async () => {
  assert.deepEqual(await lint('.a { --todae-button-bg: var(--todae-color-bg); }'), ['--todae-button-bg']);
  assert.deepEqual(await lint('.a { --todae-Button: 1; --not-a-token: 1; }'), []);
});

test('the project config rejects a token declaration at error severity', async () => {
  const result = await stylelint.lint({
    code: '.a { --todae-button-probe: 0; }',
    codeFilename: 'packages/design-system/src/components/Button.module.css',
    config: projectConfig,
  });
  const report = result.results[0];
  assert.equal(report.errored, true);
  assert.equal(report.warnings.length, 1);
  assert.equal(report.warnings[0].rule, ruleName);
  assert.equal(report.warnings[0].severity, 'error');
});
