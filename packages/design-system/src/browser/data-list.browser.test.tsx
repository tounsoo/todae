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
  it('puts the details beside the term as a flex item that sizes to content', () => {
    render(
      <div data-appearance="light" data-density="comfortable" style={{ display: 'flex', inlineSize: '40rem' }}>
        <DataList.Root aria-label="Order">
          <DataList.Item>
            <DataList.Term>Status</DataList.Term>
            <DataList.Details>Shipped</DataList.Details>
          </DataList.Item>
        </DataList.Root>
      </div>,
    );
    const term = screen.getByText('Status').getBoundingClientRect();
    const details = screen.getByText('Shipped').getBoundingClientRect();
    expect(details.left).toBeGreaterThanOrEqual(term.right);
  });

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

  it('keeps a long unbroken value inside the list', () => {
    const long = 'a-very-long-unbroken-address@example-company-domain-with-no-spaces.example.com';
    render(
      <div data-appearance="light" data-density="comfortable" style={{ inlineSize: '16rem' }}>
        <DataList.Root aria-label="Contact">
          <DataList.Item>
            <DataList.Term>Email</DataList.Term>
            <DataList.Details>{long}</DataList.Details>
          </DataList.Item>
        </DataList.Root>
      </div>,
    );
    const root = screen.getByLabelText('Contact').getBoundingClientRect();
    const details = screen.getByText(long);
    expect(details.getBoundingClientRect().right).toBeLessThanOrEqual(root.right + 1);
    expect(details.scrollWidth).toBeLessThanOrEqual(details.clientWidth);
  });

  it('sizes a vertical term to its text, not the term column', () => {
    render(list('40rem', 'vertical'));
    const term = screen.getByText('Status');
    const line = parseFloat(getComputedStyle(term).lineHeight);
    expect(term.getBoundingClientRect().height).toBeLessThan(line * 1.5);
  });

  it('keeps a nested list on its own orientation', () => {
    render(
      <div data-appearance="light" data-density="comfortable" style={{ inlineSize: '40rem' }}>
        <DataList.Root aria-label="Order">
          <DataList.Item>
            <DataList.Term>Shipping</DataList.Term>
            <DataList.Details>
              <DataList.Root orientation="vertical" aria-label="Address">
                <DataList.Item>
                  <DataList.Term>Street</DataList.Term>
                  <DataList.Details>1 Main St</DataList.Details>
                </DataList.Item>
              </DataList.Root>
            </DataList.Details>
          </DataList.Item>
        </DataList.Root>
      </div>,
    );
    const term = screen.getByText('Street');
    const line = parseFloat(getComputedStyle(term).lineHeight);
    expect(term.getBoundingClientRect().height).toBeLessThan(line * 1.5);
    const details = screen.getByText('1 Main St').getBoundingClientRect();
    expect(details.top).toBeGreaterThanOrEqual(term.getBoundingClientRect().bottom);
    expect(details.height).toBeLessThan(line * 1.5);
  });

  it('keeps a long unbroken term inside its column', () => {
    const long = 'Averylongunbrokentermthatcannotfititscolumn';
    render(
      <div data-appearance="light" data-density="comfortable" style={{ inlineSize: '40rem' }}>
        <DataList.Root aria-label="Terms">
          <DataList.Item>
            <DataList.Term>{long}</DataList.Term>
            <DataList.Details>Value</DataList.Details>
          </DataList.Item>
        </DataList.Root>
      </div>,
    );
    const term = screen.getByText(long);
    expect(term.scrollWidth).toBeLessThanOrEqual(term.clientWidth);
    expect(screen.getByText('Value').getBoundingClientRect().left).toBeGreaterThanOrEqual(term.getBoundingClientRect().right);
  });

  describe('at the stacking threshold', () => {
    function threshold() {
      const { container } = render(list('40rem'));
      const probe = document.createElement('div');
      probe.style.inlineSize =
        'calc(var(--todae-datalist-term-width) + var(--todae-datalist-gap-column) + var(--todae-datalist-details-min-width))';
      container.firstElementChild!.append(probe);
      const width = probe.getBoundingClientRect().width;
      probe.remove();
      cleanup();
      return width;
    }

    it('stays beside the term when one pixel wider than term, gap and details minimum', () => {
      render(list(`${threshold() + 1}px`));
      const term = screen.getByText('Status').getBoundingClientRect();
      const details = screen.getByText('Shipped').getBoundingClientRect();
      expect(Math.abs(details.top - term.top)).toBeLessThan(1);
    });

    it('stacks when one pixel narrower than term, gap and details minimum', () => {
      render(list(`${threshold() - 1}px`));
      const term = screen.getByText('Status').getBoundingClientRect();
      const details = screen.getByText('Shipped').getBoundingClientRect();
      expect(details.top).toBeGreaterThanOrEqual(term.bottom);
    });
  });

  it('has no axe violations', async () => {
    const { container } = render(list('40rem'));
    const results = await axe.run(container);
    expect(results.violations).toEqual([]);
  });
});
