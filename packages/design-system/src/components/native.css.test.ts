import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const sheet = (name: string) =>
  readFileSync(join(import.meta.dirname, `${name}.module.css`), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
/** The declarations of the first rule whose selector is exactly `selector`. */
function rule(css: string, selector: string): string {
  const start = css.indexOf(`${selector} {`);
  expect(start, selector).toBeGreaterThanOrEqual(0);
  const body = css.slice(css.indexOf('{', start) + 1);
  return body.slice(0, body.indexOf('}'));
}

describe('native element component styles', () => {
  // A sublayer of todae.components: every other component's own rules beat
  // it whatever their specificity or load order, so a container such as
  // Pagination still styles a Link.Root placed inside it.
  it('sit in the todae.components.native sublayer, and nothing else', () => {
    for (const name of ['Link', 'Disclosure', 'Separator', 'Table', 'Progress', 'Spinner', 'Skeleton', 'Slider', 'Code', 'Kbd', 'VisuallyHidden']) {
      const css = sheet(name);
      expect(css, name).toMatch(/^\s*@layer todae\.components\.native \{/);
      expect(css.match(/@layer/g), name).toHaveLength(1);
    }
  });

  it('let the forced colors meter bar win over the Firefox state fills', () => {
    const progress = sheet('Progress');
    // State fills at the bar's own specificity, so the later forced rule wins.
    expect(progress.match(/\.meter:-moz-meter/g)).toBeNull();
    expect(progress).toContain('.meter:where(:-moz-meter-optimum)::-moz-meter-bar {');
    expect(progress.lastIndexOf('.meter::-moz-meter-bar')).toBeGreaterThan(progress.indexOf('.meter:where(:-moz-meter-sub-sub-optimum)'));
  });

  it('style only real links, and mark the current one by any aria-current but empty or false', () => {
    const link = sheet('Link');
    expect(link).toContain('.root:any-link {');
    expect(link).toContain(".root:any-link:where([aria-current]:not([aria-current='false' i], [aria-current='']))");
    // Hover follows the current rule so the hover tokens still apply to a current link.
    expect(link.indexOf('.root:any-link:where(:hover)')).toBeGreaterThan(link.indexOf('.root:any-link:where([aria-current]'));
  });

  it('stop motion under reduced motion', () => {
    expect(sheet('Disclosure')).toMatch(/prefers-reduced-motion: reduce\) \{\s*\.root::details-content \{\s*transition: none;/);
    expect(sheet('Progress')).toMatch(/prefers-reduced-motion: reduce\) \{\s*\.progress:indeterminate \{\s*animation: none;/);
    expect(sheet('Spinner')).toMatch(/prefers-reduced-motion: reduce\) \{\s*progress\.root,\s*progress\.root\[data-variant='dots'\] \{\s*animation: none;/);
    expect(sheet('Skeleton')).toMatch(/prefers-reduced-motion: reduce\) \{\s*\.root \{\s*animation: none;/);
  });

  it('keep progress, spinner and skeleton visible in forced colors', () => {
    expect(sheet('Progress')).toMatch(/forced-colors: active\) \{\s*\.root \{\s*forced-color-adjust: none;/);
    expect(sheet('Spinner')).toMatch(/forced-colors: active\) \{\s*progress\.root \{\s*forced-color-adjust: none;/);
    expect(sheet('Skeleton')).toMatch(/forced-colors: active\) \{\s*\.root \{\s*forced-color-adjust: none;\s*background: GrayText;/);
  });

  it('draw the spinner in the text color, so it shows inside a primary button', () => {
    expect(rule(sheet('Spinner'), 'progress.root')).toContain('currentColor 0 25%');
  });

  it('tint inline code from the text color, lightly, and give blocks their own colors', () => {
    const code = sheet('Code');
    const inline = rule(code, '.root');
    expect(inline).not.toMatch(/\bcolor:/);
    expect(inline).toContain('color-mix(in oklch, currentColor calc(var(--todae-code-tint) * 100%), transparent)');
    // A light tint keeps the pair close to the text and surface around it,
    // which the resolver's contrast list cannot check for a color-mix.
    const tokens = JSON.parse(readFileSync(join(import.meta.dirname, '../../tokens/components/code.json'), 'utf8'));
    const core = JSON.parse(readFileSync(join(import.meta.dirname, '../../tokens/core.json'), 'utf8'));
    // The tint points into the opacity scale: `#/opacity/<n>/$value`.
    const step = tokens.code.tint.$value.$ref.match(/^#\/opacity\/(\d+)\/\$value$/)?.[1];
    expect(core.opacity[step].$value).toBeLessThanOrEqual(0.15);
    expect(rule(code, '.block')).toContain('color: var(--todae-code-block-fg);');
    // Code in a block drops its box, whether it is a Code.Root or a plain code.
    expect(code.indexOf('.block code {')).toBeGreaterThan(code.indexOf('.root {'));
  });

  it('draw a shortcut or echoed input as plain text around its key caps', () => {
    const kbd = sheet('Kbd');
    expect(kbd.indexOf('.root:has(kbd, samp) {')).toBeGreaterThan(kbd.indexOf('.root {'));
  });

  it('hide visually with !important, and show a focusable one while focus is inside', () => {
    const hidden = sheet('VisuallyHidden');
    expect(hidden).toContain('.root,\n  .focusable:not(:focus-within) {');
    expect(hidden).toContain('clip-path: inset(50%) !important;');
  });
});
