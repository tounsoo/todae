import assert from 'node:assert/strict';
import { test } from 'node:test';
import stylelint from 'stylelint';
import projectConfig from '../stylelint.config.mjs';

const ruleName = 'todae/token-root-scope';

const config = {
  plugins: ['./stylelint/token-root-scope.mjs'],
  rules: {
    [ruleName]: [
      true,
      {
        severity: 'warning',
        ownRoots: { Field: ['field', 'option'] },
        coreReads: { Field: ['space'] },
        sharedRoots: ['overlay', 'focus'],
      },
    ],
  },
};

async function lint(code, file) {
  const result = await stylelint.lint({ code, codeFilename: file, config });
  const report = result.results[0];
  assert.equal(report.errored, false);
  return report.warnings.map((warning) => {
    assert.equal(warning.rule, ruleName);
    assert.equal(warning.severity, 'warning');
    const match = warning.text.match(/Unexpected token root "([^"]+)" in ([^.]+)\./);
    assert.ok(match, warning.text);
    return `${match[2]} ${match[1]}`;
  });
}

const button = 'packages/design-system/src/components/Button.module.css';
const field = 'packages/design-system/src/components/Field.module.css';
const base = 'packages/design-system/src/styles/base.css';

test('a sheet may read its own root, a configured root, a core read, and a shared root', async () => {
  assert.deepEqual(await lint('.a { color: var(--todae-button-fg); }', button), []);
  assert.deepEqual(await lint('.a { outline-color: var(--todae-focus-ring-color); }', button), []);
  assert.deepEqual(await lint('.a { background: var(--todae-overlay-bg); }', button), []);
  assert.deepEqual(
    await lint('.a { color: var(--todae-field-fg); background: var(--todae-option-bg); gap: var(--todae-space-2); }', field),
    [],
  );
  assert.deepEqual(await lint('.a { color: var(--todae-base-fg); }', base), []);
});

test('a sheet may not read another component root', async () => {
  assert.deepEqual(await lint('.a { color: var(--todae-dialog-bg); }', button), ['Button dialog']);
  assert.deepEqual(await lint('.a { color: var(--todae-button-fg); }', field), ['Field button']);
  assert.deepEqual(
    await lint('.a { color: var(--todae-dialog-bg); background: var(--todae-menu-bg); }', button),
    ['Button dialog', 'Button menu'],
  );
});

test('ownRoots replaces the name default, so the configured roots are the ones that pass', async () => {
  const swapped = {
    plugins: ['./stylelint/token-root-scope.mjs'],
    rules: {
      [ruleName]: [
        true,
        {
          severity: 'warning',
          ownRoots: { Button: ['dialog'] },
          coreReads: {},
          sharedRoots: [],
        },
      ],
    },
  };
  const read = async (code) => {
    const result = await stylelint.lint({ code, codeFilename: button, config: swapped });
    return result.results[0].warnings.map((warning) => warning.text.match(/"([^"]+)"/)[1]);
  };
  assert.deepEqual(await read('.a { color: var(--todae-dialog-bg); }'), []);
  assert.deepEqual(await read('.a { color: var(--todae-button-fg); }'), ['button']);
});

test('the project config rejects a foreign root at error severity', async () => {
  const result = await stylelint.lint({
    code: '.a { color: var(--todae-dialog-bg); }',
    codeFilename: button,
    config: projectConfig,
  });
  const report = result.results[0];
  assert.equal(report.errored, true);
  assert.equal(report.warnings.length, 1);
  assert.equal(report.warnings[0].rule, ruleName);
  assert.equal(report.warnings[0].severity, 'error');
});
