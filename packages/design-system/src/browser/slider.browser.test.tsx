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
    const startBox = start().getBoundingClientRect();
    const endBox = end().getBoundingClientRect();
    expect(Math.abs(startBox.left - box.left)).toBeLessThan(2);
    expect(Math.abs(startBox.width - box.width * 0.8)).toBeLessThan(2);
    expect(Math.abs(endBox.left - (box.left + box.width * 0.2))).toBeLessThan(2);
    expect(Math.abs(endBox.right - box.right)).toBeLessThan(2);
    const fill = getComputedStyle(group(), '::after');
    expect(fill.backgroundColor).not.toBe('rgba(0, 0, 0, 0)');
    const fillWidth = Number.parseFloat(fill.width);
    expect(fillWidth).toBeGreaterThan(box.width * 0.5);
    expect(fillWidth).toBeLessThan(box.width * 0.7);
    const mask = group().querySelector('span');
    if (!(mask instanceof HTMLElement)) throw new Error('missing mask');
    const maskBox = mask.getBoundingClientRect();
    expect(maskBox.width).toBeGreaterThan(box.width * 0.15);
    expect(maskBox.width).toBeLessThan(box.width * 0.25);
  });
});
