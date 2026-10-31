import assert from 'node:assert/strict';
import { test } from 'node:test';
import stylelint from 'stylelint';
import projectConfig from '../stylelint.config.mjs';

const config = {
  plugins: ['./stylelint/no-raw-value.mjs'],
  rules: {
    'todae/no-raw-value': [true, { severity: 'warning' }],
  },
};

async function lint(code) {
  const result = await stylelint.lint({ code, config });
  const report = result.results[0];
  assert.equal(report.errored, false);
  return report.warnings.map((warning) => {
    assert.equal(warning.severity, 'warning');
    const match = warning.text.match(/Unexpected raw (\S+) "([^"]+)"/);
    assert.ok(match, warning.text);
    return `${match[1]} ${match[2]}`;
  });
}

test('system colors stay quiet, and forced-colors still rejects raw values', async () => {
  assert.deepEqual(await lint('.a { color: CanvasText; background: Highlight; border-color: GrayText; }'), []);
  assert.deepEqual(await lint('.a { color: canvastext; fill: mark; stroke: LinkText; }'), []);
  assert.deepEqual(
    await lint('@media (forced-colors: active) { .a { color: CanvasText; background: Highlight; } }'),
    [],
  );
  assert.deepEqual(
    await lint('@media (forced-colors: active) { .a { color: red; margin: 4px; border: 2px solid black; } }'),
    ['color red', 'spacing 4px', 'line-width 2px', 'color black'],
  );
  assert.deepEqual(
    await lint('@media (forced-colors: active) { .a { color: #ff0000; padding: 13px; } }'),
    ['color #ff0000', 'spacing 13px'],
  );
  assert.deepEqual(await lint('@media (forced-colors: active){color:#ff0000;padding:13px}'), [
    'color #ff0000',
    'spacing 13px',
  ]);
  assert.deepEqual(
    await lint('@media (min-width: 1px) { @media (forced-colors: active) { .a { outline: 3px solid red; } } }'),
    ['line-width 3px', 'color red'],
  );
  assert.deepEqual(
    await lint('@media (forced-colors: active) and (prefers-contrast: more) { .a { color: red; } }'),
    ['color red'],
  );
  assert.deepEqual(await lint('@media (forced-colors: active) { .a { color: red; } } .b { color: blue; }'), [
    'color red',
    'color blue',
  ]);
  assert.deepEqual(await lint('@media (forced-colors: active), (min-width: 1px) { .a { color: red; } }'), [
    'color red',
  ]);
});

test('plain numbers inside calc, min, max, and clamp stay quiet', async () => {
  assert.deepEqual(await lint('.a { margin: calc(100% - 2 * var(--todae-space-1)); }'), []);
  assert.deepEqual(await lint('.a { padding: min(1rem, var(--todae-space-2) * -0.5); }'), ['spacing 1rem']);
  assert.deepEqual(await lint('.a { gap: max(var(--todae-space-1), 3); }'), []);
  assert.deepEqual(await lint('.a { font-size: clamp(1, 2vw, var(--todae-font-size-1)); }'), ['font-size 2vw']);
  assert.deepEqual(await lint('.a { margin: 2; font-size: calc(1em * var(--todae-code-font-scale)); }'), [
    'spacing 2',
    'font-size 1em',
  ]);
  assert.deepEqual(await lint('.a { border: calc(2 * var(--todae-border-width)) solid red; }'), ['color red']);
});

test('percentages inside color functions stay quiet, and the hue gradient is listed', async () => {
  assert.deepEqual(await lint('.a { background: hsl(var(--_hue) 100% 50%); color: oklch(0.7 0.1 200); }'), [
    'color 0.7',
    'color 0.1',
    'color 200',
  ]);
  assert.deepEqual(await lint('.a { background: rgb(10 20 30 / 40%); }'), ['color 10', 'color 20', 'color 30']);
  assert.deepEqual(
    await lintIn(
      '.a { background: linear-gradient(to right in hsl longer hue, hsl(0 100% 50%), hsl(360 100% 50%)); }',
      'ColorPicker.module.css',
    ),
    [],
  );
  assert.deepEqual(
    await lintIn(
      '.a { background: linear-gradient(to right in hsl longer hue, hsl(360 100% 50%)); }',
      'Button.module.css',
    ),
    ['color 360'],
  );
  assert.deepEqual(await lint('.a { background: hsl(360 100% 50%); }'), ['color 360']);
  assert.deepEqual(await lint('.a { margin: 30%; }'), ['spacing 30%']);
});

test('50% circle radii are listed, and other 50% values are not', async () => {
  assert.deepEqual(await lintIn('.a { border-radius: 50%; border-top-left-radius: 50%; }', 'Loader.module.css'), []);
  assert.deepEqual(await lintIn('.a { border-radius: 50%; }', 'Button.module.css'), ['radius 50%']);
  assert.deepEqual(await lintIn('.a { border-radius: 10px 50%; padding: 50%; }', 'Loader.module.css'), [
    'radius 10px',
    'spacing 50%',
  ]);
});

test('a plain number in a border shorthand is a line width', async () => {
  assert.deepEqual(await lint('.a { border: 2 solid red; }'), ['line-width 2', 'color red']);
  assert.deepEqual(await lint('.a { border-top: 2px dashed #fff; outline: 5 solid blue; }'), [
    'line-width 2px',
    'color #fff',
    'line-width 5',
    'color blue',
  ]);
  assert.deepEqual(await lint('.a { column-rule: 6px dotted black; border-width: 4; }'), [
    'line-width 6px',
    'color black',
    'line-width 4',
  ]);
  assert.deepEqual(await lintIn('.a { border: 1px solid var(--todae-field-border-default); }', 'Code.module.css'), [
    'line-width 1px',
  ]);
});

test('shadows report their colors and leave the lengths', async () => {
  assert.deepEqual(await lint('.a { box-shadow: 2px 2px 4px red; text-shadow: 1px 1px 0 #fff; }'), [
    'color red',
    'color #fff',
  ]);
  assert.deepEqual(
    await lint('.a { box-shadow: inset 0 0 0 var(--todae-button-border-width) currentColor, 1px 1px 0 blue; }'),
    ['color blue'],
  );
  assert.deepEqual(await lint('.a { box-shadow: 0 0 0 1px CanvasText; text-shadow: none; }'), []);
  assert.deepEqual(
    await lint('@media (forced-colors: active) { .a { box-shadow: 0 0 0 1px red; } }'),
    ['color red'],
  );
});

async function lintIn(code, file) {
  const result = await stylelint.lint({
    code,
    codeFilename: `packages/design-system/src/components/${file}`,
    config,
  });
  const report = result.results[0];
  assert.equal(report.errored, false);
  return report.warnings.map((warning) => {
    const match = warning.text.match(/Unexpected raw (\S+) "([^"]+)"/);
    assert.ok(match, warning.text);
    return `${match[1]} ${match[2]}`;
  });
}

test('0px is allowed everywhere, and the other leftovers only in their sheets', async () => {
  assert.deepEqual(await lint('.a { margin: 0px; border-radius: 0px; }'), []);
  assert.deepEqual(await lint('.a { color: black; background: white; margin: 1em; }'), [
    'color black',
    'color white',
    'spacing 1em',
  ]);
  assert.deepEqual(await lintIn('.a { font-size: calc(1em * var(--scale)); }', 'Code.module.css'), []);
  assert.deepEqual(await lintIn('.a { font-size: 1em; }', 'Button.module.css'), ['font-size 1em']);
  assert.deepEqual(await lintIn('.a { margin-inline-end: calc(var(--gap) * 1em); }', 'Disclosure.module.css'), []);
  assert.deepEqual(await lintIn('.a { margin: 1em; }', 'Button.module.css'), ['spacing 1em']);
  assert.deepEqual(await lintIn('.a { margin-block: calc((1lh - var(--size)) / 2); }', 'Field.module.css'), []);
  assert.deepEqual(await lintIn('.a { padding: 1lh; }', 'Button.module.css'), ['spacing 1lh']);
  assert.deepEqual(await lintIn('.a { margin: -1px; }', 'VisuallyHidden.module.css'), []);
  assert.deepEqual(await lintIn('.a { margin: -1px; }', 'Button.module.css'), ['spacing -1px']);
  assert.deepEqual(
    await lintIn('.a { background: linear-gradient(to top, black, white); }', 'ColorPicker.module.css'),
    [],
  );
  assert.deepEqual(await lintIn('.a { background: black; }', 'Button.module.css'), ['color black']);
  assert.deepEqual(await lintIn('.a { margin-inline: calc(var(--i) * 2.5%); }', 'Toast.module.css'), []);
  assert.deepEqual(await lintIn('.a { margin: 2.5%; }', 'Button.module.css'), ['spacing 2.5%']);
  assert.deepEqual(await lintIn('.a { margin: 30% auto 0; }', 'selection.module.css'), []);
  assert.deepEqual(await lintIn('.a { margin: 30%; }', 'Button.module.css'), ['spacing 30%']);
});

test('1px hairline is listed only inside forced-colors for the named sheets', async () => {
  const border = '.a { border: 1px solid var(--todae-field-border-default); }';
  const inside = '@media (forced-colors: active) { .a { border: 1px solid CanvasText; outline: 1px solid CanvasText; } }';
  assert.deepEqual(await lintIn(border, 'Progress.module.css'), ['line-width 1px']);
  assert.deepEqual(await lintIn(border, 'Button.module.css'), ['line-width 1px']);
  assert.deepEqual(await lintIn(border, 'Pagination.module.css'), ['line-width 1px']);
  assert.deepEqual(await lintIn(inside, 'Progress.module.css'), []);
  assert.deepEqual(await lintIn(inside, 'Button.module.css'), []);
  assert.deepEqual(await lintIn(inside, 'Pagination.module.css'), []);
  assert.deepEqual(await lintIn(inside, 'Code.module.css'), ['line-width 1px', 'line-width 1px']);
  assert.deepEqual(
    await lintIn(
      '@media (forced-colors: active) { .a { border-width: max(1px, var(--todae-button-border-width)); } }',
      'Button.module.css',
    ),
    [],
  );
});

test('the project config fails on a raw hex', async () => {
  const result = await stylelint.lint({
    code: '.a { color: #fff; }',
    codeFilename: 'packages/design-system/src/components/Button.module.css',
    config: projectConfig,
  });
  const report = result.results[0];
  assert.equal(report.errored, true);
  assert.equal(report.warnings.length, 1);
  assert.equal(report.warnings[0].severity, 'error');
  assert.match(report.warnings[0].text, /Unexpected raw color "#fff"/);
});
