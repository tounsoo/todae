import assert from 'node:assert/strict';
import { test } from 'node:test';
import stylelint from 'stylelint';
import projectConfig from '../stylelint.config.mjs';

const ruleName = 'todae/anchored-motion';
const file = 'packages/design-system/src/components/Popover.module.css';

const config = {
  plugins: ['./stylelint/anchored-motion.mjs'],
  rules: { [ruleName]: [true, { severity: 'warning' }] },
};

async function lint(code) {
  const result = await stylelint.lint({ code, codeFilename: file, config });
  const report = result.results[0];
  assert.equal(report.errored, false);
  return report.warnings.map((warning) => {
    assert.equal(warning.rule, ruleName);
    return warning.text.replace(/ \(todae\/anchored-motion\)$/, '').split('. ')[0];
  });
}

const registered = "@property --_popover-slide { syntax: '<length>'; inherits: false; initial-value: 0px; }\n";
const anchored = '.content { position-anchor: --a; top: anchor(bottom); margin-block-start: calc(-1 * var(--_popover-slide, 0px)); }\n';

test('an anchored sheet transitions the margins that read its slide, and flips by the flip-block tactic', async () => {
  const good = `${registered}${anchored}
    .content {
      transition:
        opacity 200ms ease,
        margin-block-start 200ms ease,
        margin-block-end 200ms ease;
      position-try-fallbacks: flip-block, flip-inline;
    }
    @position-try --fit { margin-block: var(--todae-popover-offset); height: auto; }`;
  assert.deepEqual(await lint(good), []);
});

test('a sheet with no anchor positioning may transition a custom property', async () => {
  assert.deepEqual(await lint(`${registered}.a { transition: --_popover-slide 200ms ease; }`), []);
});

test('an anchored sheet may not transition a custom property, by transition or transition-property', async () => {
  // Popover.module.css before #529.
  const before529 = `${registered}${anchored}
    .content {
      transition:
        opacity var(--_motion-duration-enter) var(--_motion-easing-enter),
        scale var(--_motion-duration-enter) var(--_motion-easing-enter),
        --_popover-slide var(--_motion-duration-enter) var(--_motion-easing-enter);
    }`;
  assert.deepEqual(await lint(before529), ['Unexpected transition of --_popover-slide in a sheet with anchor positioning']);
  assert.deepEqual(await lint(`.a { position-area: top; transition-property: opacity, --_tip; }`), [
    'Unexpected transition of --_tip in a sheet with anchor positioning',
  ]);
  // Coachmark's popup draws on Popover, whose sheet registers the length.
  assert.deepEqual(await lint(`.popup { position-anchor: --c; transition: --_popover-slide 1s; }`), [
    'Unexpected transition of --_popover-slide in a sheet with anchor positioning',
  ]);
});

test('a custom property anywhere in a transition item counts, and so does all, named or implied', async () => {
  // Neon round 1 on #532.
  const name = 'Unexpected transition of --_popover-slide in a sheet with anchor positioning';
  assert.deepEqual(await lint(`.a { position-anchor: --a; transition: 200ms ease --_popover-slide; }`), [name]);
  assert.deepEqual(await lint(`.a { position-anchor: --a; transition: var(--_d) --_popover-slide; }`), [name]);
  assert.deepEqual(await lint(`.a { position-anchor: --a; transition: allow-discrete --_popover-slide 200ms; }`), [name]);
  assert.deepEqual(await lint(`.a { position-anchor: --a; transition: opacity var(--_d) cubic-bezier(0.2, 0.8, 0.2, 1); }`), []);
  const all = 'Unexpected transition of all properties in a sheet with anchor positioning, by all or by naming none';
  // Whether or not this sheet registers the length: Coachmark draws on Popover's (Neon round 2 on #532).
  assert.deepEqual(await lint(`${registered}.a { position-anchor: --a; transition: all 200ms; }`), [all]);
  assert.deepEqual(await lint(`.a { position-anchor: --a; transition: ALL 200ms; }`), [all]);
  assert.deepEqual(await lint(`.a { position-anchor: --a; transition: 200ms ease; }`), [all]);
  assert.deepEqual(await lint(`.a { position-anchor: --a; transition: opacity 200ms, 1s cubic-bezier(0, 0, 1, 1); }`), [all]);
  assert.deepEqual(await lint(`.a { position-anchor: --a; transition: none; }`), []);
  assert.deepEqual(await lint(`.a { position-anchor: --a; transition: var(--_motion); }`), []);
  assert.deepEqual(await lint(`.a { position-anchor: --a; transition: var(--_d)--_popover-slide; }`), [name]);
  assert.deepEqual(await lint(`.a { position-anchor: --a; TRANSITION-PROPERTY: --_popover-slide; }`), [name]);
});

test('a named @position-try may not set a margin from a local length, wherever it is registered', async () => {
  // Coachmark's popup draws on Popover, whose sheet registers --_popover-slide (Neon round 1 on #532).
  assert.deepEqual(await lint(`@position-try --flip { margin-block-start: var(--_popover-slide, 0px); }`), [
    'Unexpected margin-block-start reading the local --_popover-slide in a named @position-try',
  ]);
});

test('a named @position-try may not set a margin from a length the sheet registers', async () => {
  // The flip try #529 removed.
  const before529 = `${registered}${anchored}
    @position-try --todae-popover-flip-block {
      top: unset;
      bottom: calc(anchor(top) + var(--todae-popover-offset));
      inset-inline-start: anchor(self-start);
      margin-block-start: var(--_popover-slide, 0px);
      margin-block-end: calc(-1 * var(--_popover-slide, 0px));
    }`;
  assert.deepEqual(await lint(before529), [
    'Unexpected margin-block-start reading the local --_popover-slide in a named @position-try',
    'Unexpected margin-block-end reading the local --_popover-slide in a named @position-try',
  ]);
});

test('the project config rejects it at error severity, and the message names the fix', async () => {
  const result = await stylelint.lint({
    code: `.a { position-anchor: --a; transition: --_popover-slide 1s; }`,
    codeFilename: file,
    config: projectConfig,
  });
  const [warning] = result.results[0].warnings;
  assert.equal(result.results[0].errored, true);
  assert.equal(warning.rule, ruleName);
  assert.equal(warning.severity, 'error');
  assert.match(warning.text, /Transition the properties that read it, such as margin-block-start and margin-block-end/);
});
