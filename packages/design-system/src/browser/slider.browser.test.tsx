import { cleanup, render, screen } from '@testing-library/react';
import { cdp, page, server, userEvent } from 'vitest/browser';
import { useState, type ReactNode } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { Slider, type SliderRangeValue } from '../index.js';
import { Slider as ServerSlider } from '../server/slider.js';

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

type Rgb = readonly [number, number, number];

function Frame({ appearance, dir, children }: { appearance: 'light' | 'dark'; dir?: 'ltr' | 'rtl'; children: ReactNode }) {
  return (
    <div data-appearance={appearance} data-density="comfortable" dir={dir} style={{ inlineSize: 320, ['--_todae-focus-ring-width' as string]: '8px' }}>
      {children}
    </div>
  );
}

function canvasRgb(color: string): Rgb {
  const canvas = document.createElement('canvas');
  canvas.width = 1;
  canvas.height = 1;
  const ink = canvas.getContext('2d', { willReadFrequently: true });
  if (!ink) throw new Error('no canvas');
  const paint = (start: string) => {
    ink.fillStyle = start;
    ink.fillStyle = color;
    ink.fillRect(0, 0, 1, 1);
    return ink.getImageData(0, 0, 1, 1).data;
  };
  const [r, g, b] = paint('#000');
  const [r2, g2, b2] = paint('#fff');
  if (r !== r2 || g !== g2 || b !== b2 || r === undefined || g === undefined || b === undefined) throw new Error(`unreadable color ${color}`);
  return [r, g, b];
}

function readColor(host: HTMLElement, color: string): Rgb {
  const probe = document.createElement('span');
  probe.style.backgroundColor = color;
  host.append(probe);
  const computed = getComputedStyle(probe).backgroundColor;
  probe.remove();
  return canvasRgb(computed);
}

function expectRgb(actual: Rgb, expected: Rgb, label: string) {
  const gap = Math.max(Math.abs(actual[0] - expected[0]), Math.abs(actual[1] - expected[1]), Math.abs(actual[2] - expected[2]));
  expect(gap, `${label} painted ${actual.join(',')} and the token is ${expected.join(',')}`).toBeLessThanOrEqual(8);
}

async function bitmap(el: HTMLElement) {
  const bytes = await page.screenshot({ element: el, save: false });
  const image = new Image();
  image.src = `data:image/png;base64,${bytes}`;
  await image.decode();
  const canvas = document.createElement('canvas');
  canvas.width = image.naturalWidth;
  canvas.height = image.naturalHeight;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('no canvas');
  context.drawImage(image, 0, 0);
  const scaleX = image.naturalWidth / el.clientWidth;
  const scaleY = image.naturalHeight / el.clientHeight;
  return {
    at(x: number, y: number): Rgb {
      const px = Math.min(image.naturalWidth - 1, Math.max(0, Math.round(x * scaleX)));
      const py = Math.min(image.naturalHeight - 1, Math.max(0, Math.round(y * scaleY)));
      const data = context.getImageData(px, py, 1, 1).data;
      const red = data[0];
      const green = data[1];
      const blue = data[2];
      if (red === undefined || green === undefined || blue === undefined) throw new Error('empty pixel');
      return [red, green, blue];
    },
  };
}

function bound(input: HTMLInputElement, edge: 'min' | 'max'): number {
  const raw = input[edge];
  if (raw === '') return edge === 'min' ? 0 : 100;
  const value = Number(raw);
  return Number.isFinite(value) ? value : edge === 'min' ? 0 : 100;
}

function along(input: HTMLInputElement, value: number): number {
  const thumb = input.clientHeight;
  const min = bound(input, 'min');
  const max = bound(input, 'max');
  const span = max - min;
  const ratio = span === 0 ? 0 : (value - min) / span;
  const fromStart = thumb / 2 + ratio * (input.clientWidth - thumb);
  return getComputedStyle(input).direction === 'rtl' ? input.clientWidth - fromStart : fromStart;
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

  it('paints the thumb and the track from the fill token', async () => {
    for (const appearance of ['light', 'dark'] as const) {
      const view = render(
        <Frame appearance={appearance}>
          <Slider.Root aria-label="Volume" defaultValue={40} />
          <Range initial={[16, 69]} />
        </Frame>,
      );
      const host = view.container.querySelector('[data-appearance]');
      if (!(host instanceof HTMLElement)) throw new Error('missing theme');
      const fill = readColor(host, 'var(--todae-slider-fill)');
      const empty = readColor(host, 'ButtonFace');
      const volume = screen.getByRole('slider', { name: 'Volume' });
      if (!(volume instanceof HTMLInputElement)) throw new Error('missing slider');
      const y = volume.clientHeight / 2;
      const single = await bitmap(volume);
      expectRgb(single.at(along(volume, 40), y), fill, `${appearance} thumb`);
      expectRgb(single.at(along(volume, 40), 1), fill, `${appearance} thumb edge`);
      expectRgb(single.at(along(volume, 20), y), fill, `${appearance} fill`);
      expectRgb(single.at(along(volume, 70), y), empty, `${appearance} track`);
      for (const thumb of [start(), end()]) {
        const shot = await bitmap(thumb);
        expectRgb(shot.at(thumb.clientWidth / 2, thumb.clientHeight / 2), fill, `${appearance} range thumb`);
      }
      const track = await bitmap(group());
      const groupBox = group().getBoundingClientRect();
      const startBox = start().getBoundingClientRect();
      const endBox = end().getBoundingClientRect();
      const gy = group().clientHeight / 2;
      expectRgb(track.at((startBox.right + endBox.left) / 2 - groupBox.left, gy), fill, `${appearance} range fill`);
      expectRgb(track.at(startBox.left - groupBox.left - startBox.width / 2, gy), empty, `${appearance} range track`);
      view.unmount();
    }
  });

  it('fills toward the inline start', async () => {
    const view = render(
      <Frame appearance="light" dir="rtl">
        <Slider.Root aria-label="Volume" defaultValue={40} />
      </Frame>,
    );
    const host = view.container.querySelector('[data-appearance]');
    if (!(host instanceof HTMLElement)) throw new Error('missing theme');
    const fill = readColor(host, 'var(--todae-slider-fill)');
    const empty = readColor(host, 'ButtonFace');
    const volume = screen.getByRole('slider', { name: 'Volume' });
    if (!(volume instanceof HTMLInputElement)) throw new Error('missing slider');
    const y = volume.clientHeight / 2;
    const shot = await bitmap(volume);
    expectRgb(shot.at(along(volume, 20), y), fill, 'rtl fill');
    expectRgb(shot.at(along(volume, 70), y), empty, 'rtl track');
  });

  it('moves the fill with the thumb on the server entry', async () => {
    const view = render(
      <Frame appearance="light">
        <ServerSlider.Root aria-label="Volume" defaultValue={40} step={20} />
      </Frame>,
    );
    const host = view.container.querySelector('[data-appearance]');
    if (!(host instanceof HTMLElement)) throw new Error('missing theme');
    const fill = readColor(host, 'var(--todae-slider-fill)');
    const empty = readColor(host, 'ButtonFace');
    const input = screen.getByRole('slider', { name: 'Volume' });
    if (!(input instanceof HTMLInputElement)) throw new Error('missing slider');
    const y = input.clientHeight / 2;
    const before = await bitmap(input);
    expectRgb(before.at(along(input, 50), y), empty, 'before');
    input.focus();
    await userEvent.keyboard('{ArrowRight}');
    expect(input).toHaveProperty('value', '60');
    const after = await bitmap(input);
    expectRgb(after.at(along(input, 50), y), fill, 'after');
    expectRgb(after.at(along(input, 80), y), empty, 'past');
  });

  it('draws the focus ring around the track', async () => {
    render(<Range />);
    start().focus();
    await userEvent.keyboard('{ArrowRight}');
    expect(getComputedStyle(start()).outlineStyle).toBe('none');
    expect(getComputedStyle(group()).outlineStyle).toBe('solid');
  });

  it('paints a disabled thumb and fill with GrayText', async () => {
    for (const appearance of ['light', 'dark'] as const) {
      const view = render(
        <Frame appearance={appearance}>
          <Slider.Root aria-label="Volume" defaultValue={40} disabled />
          <Slider.Root mode="range" startLabel="Minimum" endLabel="Maximum" defaultValue={[16, 69]} disabled />
        </Frame>,
      );
      const host = view.container.querySelector('[data-appearance]');
      if (!(host instanceof HTMLElement)) throw new Error('missing theme');
      const fill = readColor(host, 'var(--todae-slider-fill)');
      const gray = readColor(host, 'GrayText');
      const empty = readColor(host, 'ButtonFace');
      const volume = screen.getByRole('slider', { name: 'Volume' });
      if (!(volume instanceof HTMLInputElement)) throw new Error('missing slider');
      const y = volume.clientHeight / 2;
      const single = await bitmap(volume);
      expectRgb(single.at(along(volume, 40), y), gray, `${appearance} disabled thumb`);
      expectRgb(single.at(along(volume, 20), y), gray, `${appearance} disabled fill`);
      expectRgb(single.at(along(volume, 70), y), empty, `${appearance} disabled track`);
      const fillGap = Math.max(Math.abs(fill[0] - gray[0]), Math.abs(fill[1] - gray[1]), Math.abs(fill[2] - gray[2]));
      expect(fillGap, `${appearance} GrayText is the fill token`).toBeGreaterThan(8);
      for (const thumb of [start(), end()]) {
        if (!(thumb instanceof HTMLElement)) throw new Error('missing thumb');
        const shot = await bitmap(thumb);
        expectRgb(shot.at(thumb.clientWidth / 2, thumb.clientHeight / 2), gray, `${appearance} disabled range thumb`);
      }
      const track = await bitmap(group());
      const groupBox = group().getBoundingClientRect();
      const startBox = start().getBoundingClientRect();
      const endBox = end().getBoundingClientRect();
      expectRgb(
        track.at((startBox.right + endBox.left) / 2 - groupBox.left, group().clientHeight / 2),
        gray,
        `${appearance} disabled range fill`,
      );
      expectRgb(
        track.at(Math.max(0, startBox.left - groupBox.left - startBox.width / 2), group().clientHeight / 2),
        empty,
        `${appearance} disabled range track`,
      );
      view.unmount();
    }
  });

  it('keeps the single fill inside the input when the thumb clip is removed', async () => {
    const view = render(
      <Frame appearance="light">
        <div data-pad="" style={{ padding: 24, background: 'rgb(0, 255, 0)' }}>
          <Slider.Root aria-label="Volume" defaultValue={40} />
        </div>
      </Frame>,
    );
    const pad = view.container.querySelector('[data-pad]');
    if (!(pad instanceof HTMLElement)) throw new Error('missing pad');
    const input = screen.getByRole('slider', { name: 'Volume' });
    if (!(input instanceof HTMLInputElement)) throw new Error('missing slider');
    const style = document.createElement('style');
    style.textContent = 'input[type="range"]::-webkit-slider-thumb { clip-path: none !important; }';
    document.head.append(style);
    try {
      const shot = await bitmap(pad);
      const inputBox = input.getBoundingClientRect();
      const padBox = pad.getBoundingClientRect();
      const left = inputBox.left - padBox.left;
      const top = inputBox.top - padBox.top;
      const page: Rgb = [0, 255, 0];
      const fill = readColor(pad, 'var(--todae-slider-fill)');
      expectRgb(shot.at(left - 8, top + inputBox.height / 2), page, 'left of the input');
      expectRgb(shot.at(left + 24, top - 8), page, 'above the input');
      expectRgb(shot.at(left + 24, top + inputBox.height + 8), page, 'below the input');
      expectRgb(shot.at(left + 16, top + inputBox.height / 2), fill, 'inside the input');
    } finally {
      style.remove();
    }
  });

  it('draws the focus ring outside the single input', async () => {
    const view = render(
      <Frame appearance="light">
        <div data-pad="" style={{ padding: 24, background: 'rgb(0, 255, 0)' }}>
          <Slider.Root aria-label="Volume" defaultValue={40} />
        </div>
      </Frame>,
    );
    const pad = view.container.querySelector('[data-pad]');
    if (!(pad instanceof HTMLElement)) throw new Error('missing pad');
    const input = screen.getByRole('slider', { name: 'Volume' });
    if (!(input instanceof HTMLInputElement)) throw new Error('missing slider');
    const ring = readColor(pad, 'var(--todae-slider-ring-focus)');
    input.focus();
    await userEvent.keyboard('{ArrowRight}');
    const shot = await bitmap(pad);
    const inputBox = input.getBoundingClientRect();
    const padBox = pad.getBoundingClientRect();
    expectRgb(shot.at(inputBox.left - padBox.left + inputBox.width / 2, inputBox.top - padBox.top - 6), ring, 'focus ring');
  });
});
