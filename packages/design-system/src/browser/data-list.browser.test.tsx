import { cleanup, render, screen } from '@testing-library/react';
import axe from 'axe-core';
import { afterEach, describe, expect, it } from 'vitest';
import { DataList } from '../index.js';

afterEach(cleanup);

function list(width: string, orientation?: 'horizontal' | 'vertical') {
  return (
    <div data-appearance="light" data-density="comfortable" style={{ inlineSize: width }}>
      <DataList.Root aria-label="Order" orientation={orientation}>
        <DataList.Item>
          <DataList.Term>Status</DataList.Term>
          <DataList.Details>Shipped</DataList.Details>
        </DataList.Item>
        <DataList.Item>
          <DataList.Term>Total</DataList.Term>
          <DataList.Details>$42.00</DataList.Details>
        </DataList.Item>
      </DataList.Root>
    </div>
  );
}

describe('DataList in a browser', () => {
  it('puts the details beside the term in a wide list', () => {
    render(list('40rem'));
    const term = screen.getByText('Status').getBoundingClientRect();
    const details = screen.getByText('Shipped').getBoundingClientRect();
    expect(details.left).toBeGreaterThanOrEqual(term.right);
    expect(Math.abs(details.top - term.top)).toBeLessThan(1);
  });

  it('stacks the details below the term when the list is too narrow for both', () => {
    render(list('14rem'));
    const term = screen.getByText('Status').getBoundingClientRect();
    const details = screen.getByText('Shipped').getBoundingClientRect();
    expect(details.top).toBeGreaterThanOrEqual(term.bottom);
    expect(details.left).toBeCloseTo(term.left, 0);
  });

  it('keeps the term within a list narrower than the term column', () => {
    render(list('6rem'));
    const root = screen.getByText('Status').closest('dl')!.getBoundingClientRect();
    const term = screen.getByText('Status').getBoundingClientRect();
    expect(term.right).toBeLessThanOrEqual(root.right + 1);
  });

  it('lines the terms up in one column and shares the term column width', () => {
    render(list('40rem'));
    const [a, b] = ['Status', 'Total'].map((text) => screen.getByText(text).getBoundingClientRect());
    expect(a!.left).toBe(b!.left);
    expect(a!.width).toBe(b!.width);
    const [x, y] = ['Shipped', '$42.00'].map((text) => screen.getByText(text).getBoundingClientRect());
    expect(x!.left).toBe(y!.left);
  });

  it('stacks the details below the term in a wide vertical list', () => {
    render(list('40rem', 'vertical'));
    const term = screen.getByText('Status').getBoundingClientRect();
    const details = screen.getByText('Shipped').getBoundingClientRect();
    expect(details.top).toBeGreaterThanOrEqual(term.bottom);
    expect(details.left).toBeCloseTo(term.left, 0);
  });

  it('resets the default margin on the details and mutes the term', () => {
    render(list('40rem'));
    expect(getComputedStyle(screen.getByText('Shipped')).marginInlineStart).toBe('0px');
    expect(getComputedStyle(screen.getByText('Status')).color).not.toBe(getComputedStyle(screen.getByText('Shipped')).color);
  });

  it('has no axe violations', async () => {
    const { container } = render(list('40rem'));
    const results = await axe.run(container);
    expect(results.violations).toEqual([]);
  });
});
