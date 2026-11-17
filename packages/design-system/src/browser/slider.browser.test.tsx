import { cleanup, render, screen } from '@testing-library/react';
import { cdp, server, userEvent } from 'vitest/browser';
import { useState } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { Slider, type SliderRangeValue } from '../index.js';

afterEach(cleanup);

function Range({ initial = [20, 80] as SliderRangeValue, dir }: { initial?: SliderRangeValue; dir?: 'ltr' | 'rtl' }) {
  const [value, setValue] = useState(initial);
  return (
    <div dir={dir} style={{ inlineSize: 400 }}>
      <Slider.Root mode="range" startLabel="Minimum" endLabel="Maximum" value={value} onValueChange={setValue} />
    </div>
  );
}

function usedThumb(): number {
  const raw = getComputedStyle(group()).getPropertyValue('--_thumb').trim();
  const value = Number.parseFloat(raw);
  if (raw.endsWith('rem')) return value * Number.parseFloat(getComputedStyle(group()).fontSize);
  return value;
}

const start = () => screen.getByRole('slider', { name: 'Minimum' });
const end = () => screen.getByRole('slider', { name: 'Maximum' });
const group = () => screen.getByRole('group');

function styleRules(): CSSStyleRule[] {
  const nested = (list: CSSRuleList): CSSStyleRule[] =>
    [...list].flatMap((rule) => {
      if (rule instanceof CSSStyleRule) return [rule];
      if ('cssRules' in rule && rule.cssRules instanceof CSSRuleList) return nested(rule.cssRules);
      return [];
    });
  return [...document.styleSheets].flatMap((sheet) => {
    try {
      return nested(sheet.cssRules);
    } catch {
      return [];
    }
  });
}

function thumbPaint(input: Element): { appearance: string; background: string } {
  const appearance = getComputedStyle(input).appearance;
  const pseudo = '::-webkit-slider-thumb';
  const measured = getComputedStyle(input, pseudo).backgroundColor;
  if (measured && measured !== 'rgba(0, 0, 0, 0)' && measured !== 'transparent') return { appearance, background: measured };
  const rule = styleRules().find((candidate) =>
    candidate.selectorText.split(',').some((part) => {
      const selector = part.trim();
      if (!selector.endsWith(pseudo)) return false;
      const owner = selector.slice(0, -pseudo.length).trim();
      return owner !== '' && input.matches(owner);
    }),
  );
  const declared = rule?.style.getPropertyValue('background-color').trim() ?? '';
  const variable = /^var\((--[\w-]+)\)$/.exec(declared);
  const name = variable?.[1];
  if (name) {
    const resolved = getComputedStyle(input).getPropertyValue(name).trim();
    if (resolved) return { appearance, background: resolved };
  }
  return { appearance, background: declared };
}

function onPage(x: number, y: number) {
  const frame = window.frameElement!.getBoundingClientRect();
  const scale = frame.width / window.innerWidth;
  return { x: frame.left + x * scale, y: frame.top + y * scale };
}

async function stroke(kind: 'touch' | 'pen', from: { x: number; y: number }, to: { x: number; y: number }) {
  const session = cdp() as { send(method: string, params?: object): Promise<unknown> };
  const down = onPage(from.x, from.y);
  const up = onPage(to.x, to.y);
  if (kind === 'touch') {
    await session.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: down.x, y: down.y, id: 1 }] });
    await session.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: up.x, y: up.y, id: 1 }] });
    await session.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    return;
  }
  await session.send('Input.dispatchMouseEvent', { type: 'mouseMoved', ...down, pointerType: 'pen' });
  await session.send('Input.dispatchMouseEvent', { type: 'mousePressed', ...down, button: 'left', buttons: 1, clickCount: 1, pointerType: 'pen' });
  await session.send('Input.dispatchMouseEvent', { type: 'mouseMoved', ...up, button: 'left', buttons: 1, pointerType: 'pen' });
  await session.send('Input.dispatchMouseEvent', { type: 'mouseReleased', ...up, button: 'left', buttons: 0, clickCount: 1, pointerType: 'pen' });
}

describe('Slider range in the browser', () => {
  it('moves each thumb by an arrow key', async () => {
    render(<Range />);
    start().focus();
    await userEvent.keyboard('{ArrowRight}');
    expect(start()).toHaveProperty('value', '21');
    expect(end()).toHaveProperty('value', '80');
    end().focus();
    await userEvent.keyboard('{ArrowRight}');
    expect(end()).toHaveProperty('value', '81');
    expect(start()).toHaveProperty('value', '21');
  });

  it('sends each thumb to its own Home and End, and pages it without passing the other', async () => {
    render(<Range />);
    end().focus();
    await userEvent.keyboard('{End}');
    expect(end()).toHaveProperty('value', '100');
    expect(start()).toHaveProperty('value', '20');
    await userEvent.keyboard('{Home}');
    expect(end()).toHaveProperty('value', '20');
    expect(start()).toHaveProperty('value', '20');

    start().focus();
    await userEvent.keyboard('{Home}');
    expect(start()).toHaveProperty('value', '0');
    expect(end()).toHaveProperty('value', '20');
    await userEvent.keyboard('{End}');
    expect(start()).toHaveProperty('value', '20');
    expect(end()).toHaveProperty('value', '20');

    cleanup();
    render(<Range />);
    start().focus();
    const read = (thumb: HTMLElement) => {
      if (!(thumb instanceof HTMLInputElement)) throw new Error('not an input');
      return Number(thumb.value);
    };
    const before = read(start());
    await userEvent.keyboard('{PageUp}');
    const after = read(start());
    expect(after).toBeGreaterThan(before);
    expect(after).toBeLessThanOrEqual(80);
    expect(end()).toHaveProperty('value', '80');
    await userEvent.keyboard('{PageDown}');
    expect(read(start())).toBeLessThan(after);
    expect(end()).toHaveProperty('value', '80');
  });

  it('moves the nearer thumb from a press on the track', async () => {
    render(<Range />);
    await userEvent.click(group(), { position: place(pointAt(10)) });
    expect(start()).toHaveProperty('value', '10');
    expect(end()).toHaveProperty('value', '80');
    expect(document.activeElement).toBe(start());

    await userEvent.click(group(), { position: place(pointAt(90)) });
    expect(end()).toHaveProperty('value', '90');
    expect(start()).toHaveProperty('value', '10');
    expect(document.activeElement).toBe(end());
  });

  it('keeps the pressed thumb while the pointer moves past the other one', async () => {
    render(<Range />);
    const box = group().getBoundingClientRect();
    await userEvent.dragAndDrop(group(), group(), {
      sourcePosition: { x: box.width * 0.1, y: box.height / 2 },
      targetPosition: { x: box.width * 0.95, y: box.height / 2 },
    });
    expect(start()).toHaveProperty('value', '80');
    expect(end()).toHaveProperty('value', '80');
  });

  it('places each thumb on its value', () => {
    render(<Range />);
    const box = group().getBoundingClientRect();
    const thumb = usedThumb();
    expect(thumb).toBeGreaterThan(0);
    const travel = box.width - thumb;
    const startBox = start().getBoundingClientRect();
    const endBox = end().getBoundingClientRect();
    expect(Math.abs(startBox.width - thumb)).toBeLessThan(2);
    expect(Math.abs(endBox.width - thumb)).toBeLessThan(2);
    expect(Math.abs(startBox.left - (box.left + travel * 0.2))).toBeLessThan(2);
    expect(Math.abs(endBox.left - (box.left + travel * 0.8))).toBeLessThan(2);
    const fill = getComputedStyle(group(), '::after');
    expect(fill.backgroundColor).not.toBe('rgba(0, 0, 0, 0)');
    const fillWidth = Number.parseFloat(fill.width);
    expect(Math.abs(fillWidth - travel * 0.6)).toBeLessThan(2);
    expect(group().querySelector('span')).toBeNull();
  });

  it('keeps a thumb that sits on an end of the scale', () => {
    const { unmount } = render(<Range initial={[0, 0]} />);
    const closed = group().getBoundingClientRect();
    const size = usedThumb();
    const startBox = start().getBoundingClientRect();
    expect(startBox.width).toBeGreaterThan(size / 2);
    expect(startBox.left).toBeGreaterThanOrEqual(closed.left - 1);
    expect(startBox.right).toBeLessThanOrEqual(closed.left + size + 2);
    unmount();
    render(<Range initial={[100, 100]} />);
    const open = group().getBoundingClientRect();
    const endBox = end().getBoundingClientRect();
    expect(endBox.width).toBeGreaterThan(size / 2);
    expect(endBox.left).toBeGreaterThanOrEqual(open.right - size - 2);
    expect(endBox.right).toBeLessThanOrEqual(open.right + 2);
  });

  it('puts both thumbs on the same point when the values are equal', () => {
    render(<Range initial={[50, 50]} />);
    const box = group().getBoundingClientRect();
    const size = usedThumb();
    const startBox = start().getBoundingClientRect();
    const endBox = end().getBoundingClientRect();
    const startCenter = startBox.right - size / 2;
    const endCenter = endBox.left + size / 2;
    expect(Math.abs(startCenter - endCenter)).toBeLessThan(2);
    expect(Math.abs(startCenter - (box.left + box.width / 2))).toBeLessThan(2);
  });

  function pointAt(percent: number) {
    const box = group().getBoundingClientRect();
    const thumb = usedThumb();
    const travel = box.width - thumb;
    const along = thumb / 2 + (percent / 100) * travel;
    const rtl = getComputedStyle(group()).direction === 'rtl';
    return { x: rtl ? box.right - along : box.left + along, y: box.top + box.height / 2 };
  }

  function place(point: { x: number; y: number }) {
    const box = group().getBoundingClientRect();
    return { x: point.x - box.left, y: point.y - box.top };
  }

  async function drag(from: { x: number; y: number }, to: { x: number; y: number }) {
    await userEvent.dragAndDrop(group(), group(), { sourcePosition: place(from), targetPosition: place(to) });
  }

  it('stacks the start thumb above the end thumb', () => {
    for (const [low, high] of [
      [16, 35],
      [0, 100],
      [0, 0],
      [100, 100],
      [50, 50],
    ] as const) {
      cleanup();
      render(<Range initial={[low, high]} />);
      const startIndex = Number(getComputedStyle(start()).zIndex);
      const endIndex = Number(getComputedStyle(end()).zIndex);
      expect(startIndex, `${low} to ${high}`).toBeGreaterThan(endIndex);
    }
  });

  it('leaves the value unchanged when a thumb is pressed and released', async () => {
    for (const [low, high, thumb] of [
      [0, 40, 'start'],
      [16, 35, 'start'],
      [40, 100, 'end'],
    ] as const) {
      cleanup();
      render(<Range initial={[low, high]} />);
      const at = place(pointAt(thumb === 'start' ? low : high));
      await userEvent.click(group(), { position: at });
      expect(start(), `${low} to ${high}`).toHaveProperty('value', String(low));
      expect(end(), `${low} to ${high}`).toHaveProperty('value', String(high));
    }
  });

  it('focuses the start thumb when a shared thumb is tapped', async () => {
    render(<Range initial={[50, 50]} />);
    await userEvent.click(group(), { position: place(pointAt(50)) });
    expect(start()).toHaveProperty('value', '50');
    expect(end()).toHaveProperty('value', '50');
    expect(document.activeElement).toBe(start());
  });

  it('drags the start thumb from 16 to 25', async () => {
    render(<Range initial={[16, 35]} />);
    await drag(pointAt(16), pointAt(25));
    expect(start()).toHaveProperty('value', '25');
    expect(end()).toHaveProperty('value', '35');
  });

  it('drags the end thumb from 35 to 60', async () => {
    render(<Range initial={[16, 35]} />);
    await drag(pointAt(35), pointAt(60));
    expect(start()).toHaveProperty('value', '16');
    expect(end()).toHaveProperty('value', '60');
  });

  it('drags the start thumb when a shared thumb moves toward the minimum', async () => {
    render(<Range initial={[50, 50]} />);
    await drag(pointAt(50), pointAt(30));
    expect(start()).toHaveProperty('value', '30');
    expect(end()).toHaveProperty('value', '50');
  });

  it('drags the end thumb when a shared thumb moves toward the maximum', async () => {
    render(<Range initial={[50, 50]} />);
    await drag(pointAt(50), pointAt(70));
    expect(start()).toHaveProperty('value', '50');
    expect(end()).toHaveProperty('value', '70');
  });

  it('drags a thumb in right to left', async () => {
    render(<Range initial={[16, 35]} dir="rtl" />);
    await drag(pointAt(35), pointAt(60));
    expect(start()).toHaveProperty('value', '16');
    expect(end()).toHaveProperty('value', '60');
  });

  it.runIf(server.browser === 'chromium')('drags the start thumb from a touch press and leaves it focused', async () => {
    render(<Range initial={[16, 35]} />);
    const kinds: string[] = [];
    group().addEventListener('pointerdown', (event) => kinds.push(event.pointerType));
    await stroke('touch', pointAt(16), pointAt(25));
    expect(kinds).toEqual(['touch']);
    expect(start()).toHaveProperty('value', '25');
    expect(end()).toHaveProperty('value', '35');
    expect(document.activeElement).toBe(start());
  });

  it.runIf(server.browser === 'chromium')('drags the end thumb from a pen press and leaves it focused', async () => {
    render(<Range initial={[16, 35]} />);
    const kinds: string[] = [];
    group().addEventListener('pointerdown', (event) => kinds.push(event.pointerType));
    await stroke('pen', pointAt(35), pointAt(60));
    expect(kinds).toEqual(['pen']);
    expect(start()).toHaveProperty('value', '16');
    expect(end()).toHaveProperty('value', '60');
    expect(document.activeElement).toBe(end());
  });

  it('fills the single track up to the thumb', async () => {
    render(<Slider.Root aria-label="Volume" defaultValue={40} />);
    const input = screen.getByRole('slider', { name: 'Volume' });
    expect(getComputedStyle(input).getPropertyValue('--_value').trim()).toBe('40%');
    input.focus();
    await userEvent.keyboard('{ArrowRight}');
    expect(input).toHaveProperty('value', '41');
    expect(getComputedStyle(input).getPropertyValue('--_value').trim()).toBe('41%');
  });

  it('paints each thumb from the fill token', () => {
    render(
      <>
        <Slider.Root aria-label="Volume" defaultValue={40} />
        <Range initial={[16, 69]} />
      </>,
    );
    const fill = getComputedStyle(start()).getPropertyValue('--todae-slider-fill').trim();
    for (const input of [screen.getByRole('slider', { name: 'Volume' }), start(), end()]) {
      const painted = thumbPaint(input);
      expect(painted.appearance).toBe('none');
      expect(painted.background).toBe(fill);
    }
  });

  it('draws the focus ring around the track', async () => {
    render(<Range />);
    start().focus();
    await userEvent.keyboard('{ArrowRight}');
    expect(getComputedStyle(start()).outlineStyle).toBe('none');
    expect(getComputedStyle(group()).outlineStyle).toBe('solid');
  });
});
