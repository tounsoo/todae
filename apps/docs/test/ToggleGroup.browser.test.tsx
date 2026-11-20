/// <reference types="@vitest/browser-playwright" />
import { cleanup, render, screen, within } from '@testing-library/react';
import { page, userEvent } from 'vitest/browser';
import { afterEach, beforeEach, expect, it } from 'vitest';
import { Button, ToggleGroup } from '@tounsoo/todae';
import '@tounsoo/todae/todae.css';

beforeEach(async () => {
  await page.viewport(375, 800);
});

afterEach(() => {
  cleanup();
});

const radius = (el: Element, edge: 'top-left' | 'top-right') => {
  const style = getComputedStyle(el);
  const value = edge === 'top-left' ? style.borderTopLeftRadius : style.borderTopRightRadius;
  return Number.parseFloat(value);
};

it('wraps inside 375px with no horizontal overflow, and each line stays joined', async () => {
  render(
    <div style={{ width: 375 }}>
      <ToggleGroup.Root aria-label="Days" defaultValue="Monday">
        {['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'].map((day) => (
          <ToggleGroup.Item key={day} value={day}>
            {day}
          </ToggleGroup.Item>
        ))}
      </ToggleGroup.Root>
    </div>,
  );
  const group = screen.getByRole('group', { name: 'Days' });
  const items = within(group).getAllByRole('button');
  const box = group.getBoundingClientRect();
  expect(box.width).toBeLessThanOrEqual(375);
  expect(group.scrollWidth).toBeLessThanOrEqual(group.clientWidth);
  for (const item of items) {
    const rect = item.getBoundingClientRect();
    expect(rect.left).toBeGreaterThanOrEqual(box.left - 0.5);
    expect(rect.right).toBeLessThanOrEqual(box.right + 0.5);
  }
  const lines = new Map<number, HTMLElement[]>();
  for (const item of items) {
    const top = Math.round(item.getBoundingClientRect().top);
    const line = lines.get(top);
    if (line) line.push(item);
    else lines.set(top, [item]);
  }
  expect(lines.size).toBeGreaterThan(1);
  const lineStarts = [...lines.values()].map((line) => line[0]!.getBoundingClientRect().left);
  expect(Math.max(...lineStarts) - Math.min(...lineStarts)).toBeLessThanOrEqual(1);
  for (const line of lines.values()) {
    const first = line[0]!;
    const last = line[line.length - 1]!;
    expect(first).toHaveAttribute('data-line-start');
    expect(last).toHaveAttribute('data-line-end');
    expect(radius(first, 'top-left')).toBeGreaterThan(0);
    expect(radius(last, 'top-right')).toBeGreaterThan(0);
    if (line.length > 2) {
      const middle = line[1]!;
      expect(middle).not.toHaveAttribute('data-line-start');
      expect(middle).not.toHaveAttribute('data-line-end');
      expect(radius(middle, 'top-left')).toBe(0);
      expect(radius(middle, 'top-right')).toBe(0);
    }
  }
  // Arrow keys move focus and leave the pressed item pressed.
  const monday = screen.getByRole('button', { name: 'Monday' });
  monday.focus();
  await userEvent.keyboard('{ArrowRight}');
  expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Tuesday' }));
  expect(monday).toHaveAttribute('aria-pressed', 'true');
});

it('wraps a ghost row inside 375px without overflowing', () => {
  render(
    <div style={{ width: 375 }}>
      <ToggleGroup.Root aria-label="Marks">
        {['One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven'].map((label) => (
          <ToggleGroup.Item key={label} value={label} variant="ghost">
            {label}
          </ToggleGroup.Item>
        ))}
      </ToggleGroup.Root>
    </div>,
  );
  const group = screen.getByRole('group', { name: 'Marks' });
  const box = group.getBoundingClientRect();
  expect(box.width).toBeLessThanOrEqual(375);
  expect(group.scrollWidth).toBeLessThanOrEqual(group.clientWidth);
  const tops = new Set(within(group).getAllByRole('button').map((item) => Math.round(item.getBoundingClientRect().top)));
  expect(tops.size).toBeGreaterThan(1);
});

it('joins a single line the same way Button.Group does', () => {
  render(
    <div style={{ display: 'grid', gap: 16, width: 375 }}>
      <ToggleGroup.Root aria-label="Align" defaultValue="left">
        <ToggleGroup.Item value="left">Left</ToggleGroup.Item>
        <ToggleGroup.Item value="center">Center</ToggleGroup.Item>
        <ToggleGroup.Item value="right">Right</ToggleGroup.Item>
      </ToggleGroup.Root>
      <Button.Group aria-label="Actions">
        <Button.Root variant="secondary">Left</Button.Root>
        <Button.Root variant="secondary">Center</Button.Root>
        <Button.Root variant="secondary">Right</Button.Root>
      </Button.Group>
    </div>,
  );
  const toggle = within(screen.getByRole('group', { name: 'Align' })).getAllByRole('button');
  const actions = within(screen.getByRole('group', { name: 'Actions' })).getAllByRole('button');
  expect(toggle.map((item) => Math.round(item.getBoundingClientRect().width))).toEqual(
    actions.map((item) => Math.round(item.getBoundingClientRect().width)),
  );
  const border = Number.parseFloat(getComputedStyle(toggle[0]!).borderTopWidth);
  const overlap = toggle[0]!.getBoundingClientRect().right - toggle[1]!.getBoundingClientRect().left;
  const buttonOverlap = actions[0]!.getBoundingClientRect().right - actions[1]!.getBoundingClientRect().left;
  expect(overlap).toBeCloseTo(border, 0);
  expect(overlap).toBeCloseTo(buttonOverlap, 0);
  const group = screen.getByRole('group', { name: 'Align' }).getBoundingClientRect();
  const buttonGroup = screen.getByRole('group', { name: 'Actions' }).getBoundingClientRect();
  expect(toggle[0]!.getBoundingClientRect().left).toBeCloseTo(group.left, 0);
  expect(actions[0]!.getBoundingClientRect().left).toBeCloseTo(buttonGroup.left, 0);
  expect(Math.round(group.width)).toBe(Math.round(buttonGroup.width));
  expect(radius(toggle[0]!, 'top-right')).toBe(0);
  expect(radius(actions[0]!, 'top-right')).toBe(0);
  expect(radius(toggle[0]!, 'top-left')).toBeCloseTo(radius(actions[0]!, 'top-left'), 0);
});

it('paints an unpressed segment with togglegroup.item.border.default and leaves the default color unchanged', () => {
  render(
    <div>
      <Button.Root variant="secondary">Plain</Button.Root>
      <ToggleGroup.Root aria-label="Align" defaultValue="left">
        <ToggleGroup.Item value="left">Left</ToggleGroup.Item>
        <ToggleGroup.Item value="center">Center</ToggleGroup.Item>
      </ToggleGroup.Root>
      <div style={{ ['--todae-togglegroup-item-border-default' as string]: 'rgb(11, 22, 33)' }}>
        <ToggleGroup.Root aria-label="Tint" defaultValue="a">
          <ToggleGroup.Item value="a">A</ToggleGroup.Item>
          <ToggleGroup.Item value="b">B</ToggleGroup.Item>
        </ToggleGroup.Root>
      </div>
    </div>,
  );
  const plain = getComputedStyle(screen.getByRole('button', { name: 'Plain' })).borderTopColor;
  const center = screen.getByRole('button', { name: 'Center' });
  expect(getComputedStyle(center).borderTopColor).toBe(plain);
  const tinted = screen.getByRole('button', { name: 'B' });
  const pressed = screen.getByRole('button', { name: 'A' });
  expect(getComputedStyle(tinted).borderTopColor).toBe('rgb(11, 22, 33)');
  expect(getComputedStyle(pressed).borderTopColor).not.toBe('rgb(11, 22, 33)');
});

it('keeps a required item pressed on click, Space, and Enter, and never reports null', async () => {
  const seen: Array<string | null> = [];
  render(
    <ToggleGroup.Root aria-label="Align" required defaultValue="left" onValueChange={(value) => seen.push(value)}>
      <ToggleGroup.Item value="left">Left</ToggleGroup.Item>
      <ToggleGroup.Item value="center">Center</ToggleGroup.Item>
    </ToggleGroup.Root>,
  );
  const left = screen.getByRole('button', { name: 'Left' });
  left.focus();
  await userEvent.keyboard('{Enter}');
  await userEvent.keyboard('{Space}');
  await userEvent.click(left);
  expect(left).toHaveAttribute('aria-pressed', 'true');
  expect(seen).toEqual([]);
  await userEvent.click(screen.getByRole('button', { name: 'Center' }));
  expect(seen).toEqual(['center']);
  expect(screen.getByRole('button', { name: 'Center' })).toHaveAttribute('aria-pressed', 'true');
});
