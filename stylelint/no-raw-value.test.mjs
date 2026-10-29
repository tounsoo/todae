import assert from 'node:assert/strict';
import { test } from 'node:test';
import stylelint from 'stylelint';

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

test('system colors and forced-colors blocks stay quiet', async () => {
  assert.deepEqual(await lint('.a { color: CanvasText; background: Highlight; border-color: GrayText; }'), []);
  assert.deepEqual(await lint('.a { color: canvastext; fill: mark; stroke: LinkText; }'), []);
  assert.deepEqual(
    await lint('@media (forced-colors: active) { .a { color: red; margin: 4px; border: 2px solid black; } }'),
    [],
  );
  assert.deepEqual(
    await lint('@media (min-width: 1px) { @media (forced-colors: active) { .a { outline: 3px solid red; } } }'),
    [],
  );
  assert.deepEqual(
    await lint('@media (forced-colors: active) and (prefers-contrast: more) { .a { color: red; } }'),
    [],
  );
  assert.deepEqual(await lint('@media (forced-colors: active) { .a { color: red; } } .b { color: blue; }'), [
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
    await lint(
      '.a { background: linear-gradient(to right in hsl longer hue, hsl(0 100% 50%), hsl(360 100% 50%)); }',
    ),
    [],
  );
  assert.deepEqual(await lint('.a { background: hsl(360 100% 50%); }'), ['color 360']);
  assert.deepEqual(await lint('.a { margin: 30%; }'), ['spacing 30%']);
});

test('50% circle radii are listed, and other 50% values are not', async () => {
  assert.deepEqual(await lint('.a { border-radius: 50%; border-top-left-radius: 50%; }'), []);
  assert.deepEqual(await lint('.a { border-radius: 10px 50%; padding: 50%; }'), ['radius 10px', 'spacing 50%']);
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
  assert.deepEqual(await lint('.a { border: 1px solid var(--todae-field-border-default); }'), []);
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
    [],
  );
});
