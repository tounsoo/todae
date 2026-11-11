import assert from 'node:assert/strict';
import { test } from 'node:test';
import stylelint from 'stylelint';
import projectConfig from '../stylelint.config.mjs';

const ruleName = 'todae/no-raw-literal';
const file = 'packages/design-system/src/components/Button.module.css';

const config = {
  plugins: ['./stylelint/no-raw-literal.mjs'],
  rules: { [ruleName]: [true, { severity: 'warning' }] },
};

function kind(text) {
  if (text.includes('pill length')) return 'pill';
  if (text.includes('line-height')) return 'leading';
  if (text.includes('opacity')) return 'fade';
  if (text.includes('easing')) return 'easing';
  if (text.includes('hairline')) return 'hairline';
  return text;
}

async function lint(code) {
  const result = await stylelint.lint({ code, codeFilename: file, config });
  const report = result.results[0];
  assert.equal(report.errored, false);
  return report.warnings.map((warning) => {
    assert.equal(warning.rule, ruleName);
    assert.equal(warning.severity, 'warning');
    return kind(warning.text);
  });
}

const bad = `.a {
  width: 999px;
  line-height: 1.5;
  opacity: 0.4;
  transition: opacity 200ms ease-in-out;
  border-top: 1px solid var(--todae-button-border);
  inline-size: calc(100% - 1px);
}`;

test('tokens, unitless 1, opacity 0 and 1, and linear pass', async () => {
  const good = `.a {
    width: var(--todae-button-height);
    line-height: 1;
    line-height: var(--todae-text-leading-default);
    opacity: 0;
    opacity: 1;
    transition: opacity 200ms linear;
    transition-timing-function: var(--todae-motion-easing-enter);
    border: var(--todae-border-width) solid var(--todae-button-border);
    inline-size: calc(100% - var(--todae-border-width));
    outline: 1px solid CanvasText;
    margin: 1px;
  }`;
  assert.deepEqual(await lint(good), []);
});

test('pills, numeric leading, fractional opacity, named easing, and 1px hairlines fail', async () => {
  assert.deepEqual(await lint(bad), ['pill', 'leading', 'fade', 'easing', 'hairline', 'hairline']);
  assert.deepEqual(await lint('.a { line-height: 1.0; opacity: .5; border-radius: 1px; }'), [
    'leading',
    'fade',
    'hairline',
  ]);
  assert.deepEqual(await lint('.a { animation: spin 1s ease, fade 1s ease-in, grow 1s ease-out; }'), [
    'easing',
    'easing',
    'easing',
  ]);
  assert.deepEqual(await lint('@media (min-width: 9999px) { .a { color: var(--todae-button-fg); } }'), ['pill']);
});

test('a forced-colors block is skipped, including a query that continues after the same text', async () => {
  assert.deepEqual(await lint(`@media (forced-colors: active) { ${bad} }`), []);
  assert.deepEqual(await lint(`@media (forced-colors: active) and (prefers-contrast: more) { ${bad} }`), []);
  assert.deepEqual(await lint(`@media (forced-colors: active), (min-width: 999px) { .a { line-height: 2; } }`), []);
  assert.deepEqual(
    await lint('@media (min-width: 1px) and (forced-colors: active) { .a { line-height: 2; } }'),
    ['leading'],
  );
  assert.deepEqual(
    await lint(`@media (min-width: 1px) { @media (forced-colors: active) { ${bad} } .b { width: 999px; } }`),
    ['pill'],
  );
});

test('the project config rejects a numeric line-height at error severity', async () => {
  const result = await stylelint.lint({
    code: '.a { line-height: 1.5; }',
    codeFilename: file,
    config: projectConfig,
  });
  const report = result.results[0];
  assert.equal(report.errored, true);
  assert.equal(report.warnings.length, 1);
  assert.equal(report.warnings[0].rule, ruleName);
  assert.equal(report.warnings[0].severity, 'error');
});
