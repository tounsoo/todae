import { cleanup, render, screen } from '@testing-library/react';
import { userEvent } from 'vitest/browser';
import { useState } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { Slider, type SliderRangeValue } from '../index.js';

afterEach(cleanup);

function Range({ initial = [20, 80] as SliderRangeValue }: { initial?: SliderRangeValue }) {
  const [value, setValue] = useState(initial);
  return (
    <div style={{ inlineSize: 400 }}>
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
    const box = group().getBoundingClientRect();
    await userEvent.click(group(), { position: { x: box.width * 0.1, y: box.height / 2 } });
    expect(start()).toHaveProperty('value', '10');
    expect(end()).toHaveProperty('value', '80');
    expect(document.activeElement).toBe(start());

    await userEvent.click(group(), { position: { x: box.width * 0.9, y: box.height / 2 } });
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

  it('gives each thumb only the span it can travel', () => {
    render(<Range />);
    const box = group().getBoundingClientRect();
    const thumb = usedThumb();
    expect(thumb).toBeGreaterThan(0);
    const travel = box.width - thumb;
    const startBox = start().getBoundingClientRect();
    const endBox = end().getBoundingClientRect();
    expect(Math.abs(startBox.left - box.left)).toBeLessThan(2);
    expect(Math.abs(startBox.width - (travel * 0.8 + thumb))).toBeLessThan(2);
    expect(Math.abs(endBox.left - (box.left + travel * 0.2))).toBeLessThan(2);
    expect(Math.abs(endBox.right - box.right)).toBeLessThan(2);
    const fill = getComputedStyle(group(), '::after');
    expect(fill.backgroundColor).not.toBe('rgba(0, 0, 0, 0)');
    const fillWidth = Number.parseFloat(fill.width);
    expect(Math.abs(fillWidth - travel * 0.6)).toBeLessThan(2);
    const mask = group().querySelector('span');
    if (!(mask instanceof HTMLElement)) throw new Error('missing mask');
    const maskBox = mask.getBoundingClientRect();
    expect(Math.abs(maskBox.width - (thumb / 2 + travel * 0.2))).toBeLessThan(2);
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

  it('draws the focus ring around the track', async () => {
    render(<Range />);
    start().focus();
    await userEvent.keyboard('{ArrowRight}');
    expect(getComputedStyle(start()).outlineStyle).toBe('none');
    expect(getComputedStyle(group()).outlineStyle).toBe('solid');
  });
});
