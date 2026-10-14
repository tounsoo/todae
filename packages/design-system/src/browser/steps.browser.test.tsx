import { cleanup, render, screen } from '@testing-library/react';
import axe from 'axe-core';
import { afterEach, describe, expect, it } from 'vitest';
import { Steps } from '../index';

afterEach(cleanup);

function markerOf(item: HTMLElement): DOMRect {
  return item.querySelector('[aria-hidden="true"]')!.getBoundingClientRect();
}

/** The line drawn after an item, joining its marker to the next one. */
function lineOf(item: HTMLElement): { top: number; bottom: number; centre: number; width: number } {
  const style = getComputedStyle(item, '::after');
  const box = item.getBoundingClientRect();
  const top = box.top + parseFloat(style.top);
  const bottom = box.bottom - parseFloat(style.bottom);
  const width = parseFloat(style.width);
  const start = item.matches(':dir(rtl)') ? box.right - parseFloat(style.right) - width : box.left + parseFloat(style.left);
  return { top, bottom, centre: start + width / 2, width };
}

function plan(dir: 'ltr' | 'rtl' = 'ltr') {
  return (
    <div data-appearance="light" data-density="comfortable" dir={dir} style={{ inlineSize: '20rem' }}>
      <Steps.Root aria-label="Plan">
        <Steps.Item status="done">Read the files</Steps.Item>
        <Steps.Item status="current">
          Write the fix, with a long enough description that it wraps onto a second line
        </Steps.Item>
        <Steps.Item>Run the tests</Steps.Item>
        <Steps.Item status="error">Deploy</Steps.Item>
      </Steps.Root>
    </div>
  );
}

describe('Steps in a browser', () => {
  for (const dir of ['ltr', 'rtl'] as const) {
    it(`joins each marker to the next with a line through its centre (${dir})`, () => {
      render(plan(dir));
      const items = screen.getAllByRole('listitem');
      for (let i = 0; i < items.length - 1; i++) {
        const marker = markerOf(items[i]!);
        const next = markerOf(items[i + 1]!);
        const line = lineOf(items[i]!);
        expect(line.width).toBeGreaterThan(0);
        expect(Math.abs(line.centre - (marker.left + marker.width / 2))).toBeLessThan(1);
        // The line starts below this marker and ends above the next one, with a small gap at each end.
        expect(line.top).toBeGreaterThan(marker.bottom);
        expect(line.top - marker.bottom).toBeLessThan(4);
        expect(line.bottom).toBeLessThan(next.top);
        expect(next.top - line.bottom).toBeLessThan(4);
      }
      expect(getComputedStyle(items.at(-1)!, '::after').content).toBe('none');
    });
  }

  it('centres the marker on the first line of the step and puts it at the start', () => {
    render(plan('rtl'));
    const item = screen.getAllByRole('listitem')[1]!;
    const content = item.querySelector('div')!;
    const lineHeight = parseFloat(getComputedStyle(content).lineHeight);
    const firstLine = content.getBoundingClientRect().top + parseFloat(getComputedStyle(content).paddingTop);
    const marker = markerOf(item);
    expect(Math.abs(marker.top + marker.height / 2 - (firstLine + lineHeight / 2))).toBeLessThan(1);
    expect(content.getBoundingClientRect().height).toBeGreaterThan(lineHeight * 1.5);
    expect(marker.left).toBeGreaterThan(content.getBoundingClientRect().right);
  });

  it('fills the running marker with the spinner and strikes through done steps only', () => {
    render(plan());
    const [done, current, pending] = screen.getAllByRole('listitem');
    const spinner = current!.querySelector('progress')!.getBoundingClientRect();
    const marker = markerOf(current!);
    expect(Math.abs(spinner.width - marker.width)).toBeLessThan(1);
    expect(Math.abs(spinner.left - marker.left)).toBeLessThan(1);
    expect(Math.abs(spinner.top - marker.top)).toBeLessThan(1);
    expect(getComputedStyle(done!.querySelector('div')!).textDecorationLine).toBe('line-through');
    expect(getComputedStyle(pending!.querySelector('div')!).textDecorationLine).toBe('none');
  });

  it('has no axe violations', async () => {
    const { container } = render(plan());
    const result = await axe.run(container, { rules: { 'color-contrast': { enabled: false } } });
    expect(result.violations).toEqual([]);
  });
});
