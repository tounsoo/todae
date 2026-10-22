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
  it('fills a flex row that gives it room, beside its sibling', () => {
    render(
      <div data-appearance="light" data-density="comfortable" style={{ display: 'flex', gap: '1rem', inlineSize: '40rem' }}>
        <DataList.Root aria-label="Order" style={{ flex: 1 }}>
          <DataList.Item>
            <DataList.Term>Status</DataList.Term>
            <DataList.Details>Shipped</DataList.Details>
          </DataList.Item>
        </DataList.Root>
        <button type="button">Edit</button>
      </div>,
    );
    const term = screen.getByText('Status').getBoundingClientRect();
    const details = screen.getByText('Shipped').getBoundingClientRect();
    const button = screen.getByRole('button').getBoundingClientRect();
    expect(details.left).toBeGreaterThanOrEqual(term.right);
    expect(Math.abs(details.top - term.top)).toBeLessThan(1);
    expect(button.left).toBeGreaterThanOrEqual(details.right);
  });

  it('stays inside a narrow parent that sizes it to its content', () => {
    render(
      <div data-testid="parent" data-appearance="light" data-density="comfortable" style={{ inlineSize: '8rem' }}>
        <div data-testid="box" style={{ display: 'inline-block' }}>
          <DataList.Root aria-label="Order">
            <DataList.Item>
              <DataList.Term>Status</DataList.Term>
              <DataList.Details>Shipped by ground freight from the Oakland warehouse</DataList.Details>
            </DataList.Item>
          </DataList.Root>
        </div>
      </div>,
    );
    const parent = screen.getByTestId('parent').getBoundingClientRect();
    const box = screen.getByTestId('box').getBoundingClientRect();
    const details = screen.getByText(/Shipped by/).getBoundingClientRect();
    expect(box.right).toBeLessThanOrEqual(parent.right + 0.5);
    expect(details.right).toBeLessThanOrEqual(box.right + 0.5);
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

  describe('with minItemSize', () => {
    function columns(width: string) {
      return (
        <div data-appearance="light" data-density="comfortable" style={{ inlineSize: width }}>
          <DataList.Root aria-label="Plan" minItemSize="12rem" orientation="vertical">
            {['Seats', 'Storage', 'Support'].map((term) => (
              <DataList.Item key={term}>
                <DataList.Term>{term}</DataList.Term>
                <DataList.Details>{`${term} value`}</DataList.Details>
              </DataList.Item>
            ))}
          </DataList.Root>
        </div>
      );
    }

    it('puts as many items in a row as the width allows, spaced by datalist.gap.between-columns', () => {
      render(columns('30rem'));
      const [a, b, c] = ['Seats', 'Storage', 'Support'].map((text) => screen.getByText(text).getBoundingClientRect());
      expect(a!.top).toBe(b!.top);
      expect(c!.top).toBeGreaterThan(a!.top);
      expect(c!.left).toBe(a!.left);
      const list = screen.getByLabelText('Plan');
      const probe = document.createElement('div');
      probe.style.inlineSize = 'var(--todae-datalist-gap-between-columns)';
      list.append(probe);
      const gap = probe.getBoundingClientRect().width;
      probe.remove();
      expect(gap).toBeGreaterThan(0);
      expect(gap).not.toBe(parseFloat(getComputedStyle(list).rowGap));
      const first = list.children[0]!.getBoundingClientRect();
      const second = list.children[1]!.getBoundingClientRect();
      expect(second.left - first.right).toBeCloseTo(gap, 1);
    });

    it('keeps one column inside a list narrower than minItemSize', () => {
      render(columns('8rem'));
      const list = screen.getByLabelText('Plan').getBoundingClientRect();
      const item = screen.getByLabelText('Plan').children[0]!.getBoundingClientRect();
      expect(item.right).toBeLessThanOrEqual(list.right + 0.5);
      const [a, b] = ['Seats', 'Storage'].map((text) => screen.getByText(text).getBoundingClientRect());
      expect(b!.top).toBeGreaterThan(a!.top);
    });

    function horizontal(width: string, minItemSize: string) {
      return (
        <div data-appearance="light" data-density="comfortable" style={{ inlineSize: width }}>
          <DataList.Root aria-label="Order" minItemSize={minItemSize}>
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

    it('keeps a horizontal item beside its term in a column as wide as term, gap and details minimum', () => {
      render(horizontal('48rem', 'calc(var(--todae-datalist-term-width) + var(--todae-datalist-gap-column) + var(--todae-datalist-details-min-width))'));
      const [status, total] = ['Status', 'Total'].map((text) => screen.getByText(text).getBoundingClientRect());
      expect(status!.top).toBe(total!.top);
      expect(total!.left).toBeGreaterThan(status!.left);
      const details = screen.getByText('Shipped').getBoundingClientRect();
      expect(Math.abs(details.top - status!.top)).toBeLessThan(1);
      expect(details.left).toBeGreaterThanOrEqual(status!.right);
    });

    it('stacks a horizontal item in a column narrower than term, gap and details minimum', () => {
      render(horizontal('30rem', '12rem'));
      const [status, total] = ['Status', 'Total'].map((text) => screen.getByText(text).getBoundingClientRect());
      expect(status!.top).toBe(total!.top);
      expect(screen.getByText('Shipped').getBoundingClientRect().top).toBeGreaterThanOrEqual(status!.bottom);
    });

    it('takes its column count from the width a flex row gives it', () => {
      render(
        <div data-appearance="light" data-density="comfortable" style={{ display: 'flex', inlineSize: '40rem' }}>
          <DataList.Root aria-label="Wide" minItemSize="12rem" orientation="vertical" style={{ flex: 1 }}>
            {['Seats', 'Storage', 'Support'].map((term) => (
              <DataList.Item key={term}>
                <DataList.Term>{term}</DataList.Term>
                <DataList.Details>1</DataList.Details>
              </DataList.Item>
            ))}
          </DataList.Root>
        </div>,
      );
      const [a, b, c] = ['Seats', 'Storage', 'Support'].map((text) => screen.getByText(text).getBoundingClientRect());
      expect(a!.top).toBe(b!.top);
      expect(a!.top).toBe(c!.top);
    });

    it('takes its column count from its text in a flex row that gives it no width', () => {
      const sized = (label: string, details: string) => (
        <div data-appearance="light" data-density="comfortable" style={{ display: 'flex', inlineSize: '60rem' }}>
          <DataList.Root aria-label={label} minItemSize="12rem" orientation="vertical">
            {['Seats', 'Storage', 'Support'].map((term) => (
              <DataList.Item key={term}>
                <DataList.Term>{term}</DataList.Term>
                <DataList.Details>{term === 'Storage' ? details : '1'}</DataList.Details>
              </DataList.Item>
            ))}
          </DataList.Root>
        </div>
      );
      const tops = (label: string) =>
        Array.from(screen.getByLabelText(label).children).map((item) => item.getBoundingClientRect().top);
      const long = 'Forty-eight gigabytes of one hundred, renewed with the plan each month';
      render(sized('Short', '1'));
      expect(new Set(tops('Short')).size).toBe(3);
      cleanup();
      render(sized('Long', long));
      const probe = document.createElement('span');
      probe.textContent = long;
      probe.style.whiteSpace = 'nowrap';
      screen.getByText(long).append(probe);
      const textWidth = probe.getBoundingClientRect().width;
      probe.remove();
      expect(screen.getByLabelText('Long').getBoundingClientRect().width).toBeCloseTo(textWidth, 0);
      expect(new Set(tops('Long')).size).toBeLessThan(3);
    });
  });

  it('has no axe violations', async () => {
    const { container } = render(list('40rem'));
    const results = await axe.run(container);
    expect(results.violations).toEqual([]);
  });
});
