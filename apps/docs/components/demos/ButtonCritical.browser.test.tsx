import { cleanup, render, screen } from '@testing-library/react';
import { userEvent } from 'vitest/browser';
import { afterEach, describe, expect, it } from 'vitest';
import '@tounsoo/todae/todae.css';
import { Button, Dialog, Menu, ThemeProvider, type Appearance } from '@tounsoo/todae';
import { parseComputedColor } from '../../../../packages/design-system/src/providers/overrideContrast.ts';

afterEach(cleanup);

type ButtonState = 'default' | 'hover' | 'active' | 'focus' | 'disabled';

function channels(color: string): [number, number, number, number] {
  const parsed = parseComputedColor(color);
  if (!parsed) throw new Error(`unreadable color ${color}`);
  return parsed;
}

function near(actual: string, expected: string, label: string) {
  const [ar, ag, ab, aa] = channels(actual);
  const [br, bg, bb, ba] = channels(expected);
  const delta = Math.max(Math.abs(ar - br), Math.abs(ag - bg), Math.abs(ab - bb), Math.abs(aa - ba));
  expect(delta, label).toBeLessThan(0.02);
}

function linear(channel: number): number {
  return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
}

function wcag(fg: string, bg: string): number {
  const lum = (color: string) => {
    const [r, g, b, a] = channels(color);
    if (a < 1) throw new Error(`critical text and fill are translucent (${color})`);
    return 0.2126 * linear(r) + 0.7152 * linear(g) + 0.0722 * linear(b);
  };
  const a = lum(fg);
  const b = lum(bg);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

function swatch(root: HTMLElement, variable: string): string {
  const probe = document.createElement('div');
  probe.style.backgroundColor = `var(${variable})`;
  root.append(probe);
  const color = getComputedStyle(probe).backgroundColor;
  probe.remove();
  return color;
}

function paint(button: HTMLElement) {
  const style = getComputedStyle(button);
  return { fg: style.color, bg: style.backgroundColor };
}

/** Samples colors during the press. A click holds the button down for `delay`. */
async function whileActive(button: HTMLElement): Promise<{ fg: string; bg: string }> {
  let sample: { fg: string; bg: string } | undefined;
  let stop = false;
  const watch = () => {
    if (stop) return;
    if (button.matches(':active')) sample = paint(button);
    requestAnimationFrame(watch);
  };
  requestAnimationFrame(watch);
  await userEvent.click(button, { delay: 250 });
  stop = true;
  expect(sample, 'the critical button was pressed').toBeDefined();
  return sample!;
}

describe('critical button paint', () => {
  for (const appearance of ['light', 'dark'] as const satisfies readonly Appearance[]) {
    it(`paints critical states from its tokens in ${appearance}, and leaves the other variants on theirs`, async () => {
      const view = render(
        <ThemeProvider appearance={appearance}>
          <button type="button">Before</button>
          <Button.Root variant="critical">Delete</Button.Root>
          <Button.Root variant="critical" disabled>
            Delete later
          </Button.Root>
          <Button.Root variant="critical" aria-disabled="true">
            Held
          </Button.Root>
          <Button.Root>Save</Button.Root>
          <Button.Root variant="secondary">Cancel</Button.Root>
          <Button.Root variant="ghost">Ghost</Button.Root>
          <Menu.Root>
            <Menu.Trigger variant="critical">Menu delete</Menu.Trigger>
          </Menu.Root>
          <Button.Root variant="critical" render={(props) => <a {...props} href="/delete" />}>
            Link delete
          </Button.Root>
        </ThemeProvider>,
      );
      const root = view.container.firstElementChild as HTMLElement;
      const button = screen.getByRole('button', { name: (name) => name === 'Delete' });
      const token = (state: ButtonState, part: 'bg' | 'fg') =>
        swatch(root, `--todae-button-critical-${part}-${state}`);

      const rest = paint(button);
      near(rest.bg, token('default', 'bg'), `${appearance} rest bg`);
      near(rest.fg, token('default', 'fg'), `${appearance} rest fg`);
      expect(wcag(rest.fg, rest.bg), `${appearance} rest`).toBeGreaterThanOrEqual(4.5);

      await userEvent.hover(button);
      const hover = paint(button);
      near(hover.bg, token('hover', 'bg'), `${appearance} hover bg`);
      near(hover.fg, token('hover', 'fg'), `${appearance} hover fg`);
      expect(hover.bg).not.toBe(rest.bg);
      expect(wcag(hover.fg, hover.bg), `${appearance} hover`).toBeGreaterThanOrEqual(4.5);
      await userEvent.unhover(button);

      const pressed = await whileActive(button);
      near(pressed.bg, token('active', 'bg'), `${appearance} active bg`);
      near(pressed.fg, token('active', 'fg'), `${appearance} active fg`);
      expect(pressed.fg).not.toBe(hover.fg);
      expect(wcag(pressed.fg, pressed.bg), `${appearance} active`).toBeGreaterThanOrEqual(4.5);

      await userEvent.unhover(button);
      screen.getByRole('button', { name: 'Before' }).focus();
      await userEvent.tab();
      expect(document.activeElement).toBe(button);
      expect(button.matches(':focus-visible')).toBe(true);
      const focus = paint(button);
      near(focus.bg, token('focus', 'bg'), `${appearance} focus bg`);
      near(focus.fg, token('focus', 'fg'), `${appearance} focus fg`);
      expect(getComputedStyle(button).outlineStyle).not.toBe('none');
      expect(wcag(focus.fg, focus.bg), `${appearance} focus`).toBeGreaterThanOrEqual(4.5);

      for (const name of ['Delete later', 'Held']) {
        const off = screen.getByRole('button', { name });
        const colors = paint(off);
        near(colors.bg, token('disabled', 'bg'), `${appearance} ${name} bg`);
        near(colors.fg, token('disabled', 'fg'), `${appearance} ${name} fg`);
        expect(getComputedStyle(off).cursor).toBe('not-allowed');
        expect(wcag(colors.fg, colors.bg), `${appearance} ${name}`).toBeGreaterThanOrEqual(4.5);
      }

      const same = (name: string, variant: 'primary' | 'secondary' | 'ghost') => {
        const el = screen.getByRole('button', { name });
        const colors = paint(el);
        near(colors.bg, swatch(root, `--todae-button-${variant}-bg-default`), `${appearance} ${variant} bg`);
        near(colors.fg, swatch(root, `--todae-button-${variant}-fg-default`), `${appearance} ${variant} fg`);
      };
      same('Save', 'primary');
      same('Cancel', 'secondary');
      same('Ghost', 'ghost');

      near(paint(screen.getByRole('button', { name: 'Menu delete' })).bg, rest.bg, `${appearance} menu`);
      near(paint(screen.getByRole('link', { name: 'Link delete' })).bg, rest.bg, `${appearance} link`);
      view.unmount();

      render(
        <ThemeProvider appearance={appearance}>
          <Dialog.Root open aria-label="Delete the file">
            <Dialog.Close variant="critical">Dialog delete</Dialog.Close>
          </Dialog.Root>
        </ThemeProvider>,
      );
      near(paint(screen.getByRole('button', { name: 'Dialog delete' })).bg, rest.bg, `${appearance} dialog`);
    });
  }
});
