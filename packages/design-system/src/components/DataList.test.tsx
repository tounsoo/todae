import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { DataList } from './DataList.js';

afterEach(cleanup);

function order(orientation?: 'horizontal' | 'vertical') {
  return (
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
  );
}

describe('DataList', () => {
  it('renders a dl of div items holding a dt and a dd', () => {
    const { container } = render(order());
    const list = container.querySelector('dl')!;
    expect(list.getAttribute('aria-label')).toBe('Order');
    const items = Array.from(list.children);
    expect(items.map((item) => item.tagName)).toEqual(['DIV', 'DIV']);
    expect(Array.from(items[0]!.children).map((child) => child.tagName)).toEqual(['DT', 'DD']);
    expect(screen.getByText('Status').tagName).toBe('DT');
    expect(screen.getByText('Shipped').tagName).toBe('DD');
  });

  it('defaults to horizontal and takes vertical', () => {
    const { container, rerender } = render(order());
    expect(container.querySelector('dl')!.getAttribute('data-orientation')).toBe('horizontal');
    rerender(order('vertical'));
    expect(container.querySelector('dl')!.getAttribute('data-orientation')).toBe('vertical');
  });

  it('lays the items out in columns no narrower than minItemSize, keeping the caller style', () => {
    const { container, rerender } = render(
      <DataList.Root minItemSize="20rem" style={{ alignItems: 'start' }}>
        <DataList.Item />
      </DataList.Root>,
    );
    const list = container.querySelector('dl')!;
    expect(list.getAttribute('data-layout')).toBe('fill');
    expect(list.style.getPropertyValue('--_min-item-size')).toBe('20rem');
    expect(list.style.alignItems).toBe('start');
    rerender(
      <DataList.Root minItemSize="">
        <DataList.Item />
      </DataList.Root>,
    );
    expect(list.hasAttribute('data-layout')).toBe(false);
    expect(list.style.getPropertyValue('--_min-item-size')).toBe('');
  });

  it('keeps a className alongside its own', () => {
    const { container } = render(
      <DataList.Root className="mine">
        <DataList.Item className="row">
          <DataList.Term className="key">A</DataList.Term>
          <DataList.Details className="value">B</DataList.Details>
        </DataList.Item>
      </DataList.Root>,
    );
    for (const selector of ['dl.mine', 'div.row', 'dt.key', 'dd.value']) {
      expect(container.querySelector(selector)!.className.split(' ').length).toBeGreaterThan(1);
    }
  });
});
