import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Table as ServerTable } from '../server/table.js';
import { StringsProvider } from '../providers/StringsProvider.js';
import { Table, type TableSort } from './Table.client.js';

const live = () => document.querySelector<HTMLElement>('[data-todae-announcer] [aria-live="polite"]')?.textContent ?? '';

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(async () => {
  cleanup();
  await act(() => vi.runAllTimersAsync());
  vi.useRealTimers();
  for (const node of document.querySelectorAll('[data-todae-announcer]')) node.remove();
});

function Headers({ sort, children }: { sort?: TableSort; children?: React.ReactNode }) {
  return (
    <table>
      <thead>
        <tr>
          <Table.HeaderCell scope="col" sort={sort}>
            {children ?? 'Name'}
          </Table.HeaderCell>
        </tr>
      </thead>
    </table>
  );
}

describe('Table.HeaderCell sort', () => {
  it.each(['ascending', 'descending'] as const)('sets aria-sort and data-sort for %s', (sort) => {
    render(<Headers sort={sort} />);
    const cell = screen.getByRole('columnheader');
    expect(cell.getAttribute('aria-sort')).toBe(sort);
    expect(cell.getAttribute('data-sort')).toBe(sort);
  });

  it('marks a sortable column that is not sorted through data-sort alone', () => {
    render(<Headers sort="none" />);
    const cell = screen.getByRole('columnheader');
    expect(cell.hasAttribute('aria-sort')).toBe(false);
    expect(cell.getAttribute('data-sort')).toBe('none');
  });

  it('sets neither without sort', () => {
    render(<Headers />);
    const cell = screen.getByRole('columnheader');
    expect(cell.hasAttribute('aria-sort')).toBe(false);
    expect(cell.hasAttribute('data-sort')).toBe(false);
  });

  it('renders the same from the server entry', () => {
    render(
      <ServerTable.Root>
        <ServerTable.Head>
          <ServerTable.Row>
            <ServerTable.HeaderCell scope="col" sort="descending">
              Name
            </ServerTable.HeaderCell>
          </ServerTable.Row>
        </ServerTable.Head>
      </ServerTable.Root>,
    );
    expect(screen.getByRole('columnheader').getAttribute('aria-sort')).toBe('descending');
  });
});

describe('Table.Row selected', () => {
  it('sets an empty data-selected and no ARIA when selected', () => {
    render(
      <table>
        <tbody>
          <Table.Row selected data-testid="row" />
          <Table.Row data-testid="other" />
        </tbody>
      </table>,
    );
    const row = screen.getByTestId('row');
    expect(row.getAttribute('data-selected')).toBe('');
    expect(row.hasAttribute('aria-selected')).toBe(false);
    expect(screen.getByTestId('other').hasAttribute('data-selected')).toBe(false);
  });
});

describe('Table.SortButton', () => {
  function Sortable({ name = 'Name' }: { name?: string }) {
    const [sort, setSort] = useState<TableSort>('none');
    return (
      <table>
        <thead>
          <tr>
            <Table.HeaderCell scope="col" sort={sort}>
              <Table.SortButton onClick={() => setSort(sort === 'ascending' ? 'descending' : 'ascending')}>
                {name}
              </Table.SortButton>
            </Table.HeaderCell>
          </tr>
        </thead>
      </table>
    );
  }

  it('is a button named by the column label, with its glyph hidden from assistive technology', () => {
    render(<Sortable />);
    const button = screen.getByRole('button', { name: 'Name' });
    expect(button.getAttribute('type')).toBe('button');
    const glyph = button.querySelector('[data-todae-glyph]');
    expect(glyph?.getAttribute('aria-hidden')).toBe('true');
    expect(glyph?.querySelector('svg')).not.toBeNull();
  });

  it('announces the new sort once after a click, in the strings of the provider', async () => {
    render(<Sortable />);
    const button = screen.getByRole('button', { name: 'Name' });
    fireEvent.click(button);
    await act(() => vi.advanceTimersByTimeAsync(1000));
    expect(live()).toBe('Sorted by Name, ascending');
    fireEvent.click(button);
    await act(() => vi.advanceTimersByTimeAsync(1000));
    expect(live()).toBe('Sorted by Name, descending');
  });

  it('announces when the sort changes later than the click', async () => {
    function Later() {
      const [sort, setSort] = useState<TableSort>('none');
      return (
        <>
          <button type="button" onClick={() => setSort('descending')}>
            apply
          </button>
          <table>
            <thead>
              <tr>
                <Table.HeaderCell scope="col" sort={sort}>
                  <Table.SortButton>Amount</Table.SortButton>
                </Table.HeaderCell>
              </tr>
            </thead>
          </table>
        </>
      );
    }
    render(<Later />);
    fireEvent.click(screen.getByRole('button', { name: 'Amount' }));
    await act(() => vi.advanceTimersByTimeAsync(1000));
    expect(live()).toBe('');
    fireEvent.click(screen.getByRole('button', { name: 'apply' }));
    await act(() => vi.advanceTimersByTimeAsync(1000));
    expect(live()).toBe('Sorted by Amount, descending');
  });

  it('says a column is not sorted when its sort is cleared', async () => {
    function Clearing() {
      const [sort, setSort] = useState<TableSort>('descending');
      return (
        <table>
          <thead>
            <tr>
              <Table.HeaderCell scope="col" sort={sort}>
                <Table.SortButton onClick={() => setSort('none')}>Name</Table.SortButton>
              </Table.HeaderCell>
            </tr>
          </thead>
        </table>
      );
    }
    render(<Clearing />);
    fireEvent.click(screen.getByRole('button'));
    await act(() => vi.advanceTimersByTimeAsync(1000));
    expect(live()).toBe('Name, not sorted');
  });

  it('names the column from aria-label, and leaves a glyph out of the name', async () => {
    function Labelled() {
      const [sort, setSort] = useState<TableSort>('none');
      return (
        <table>
          <thead>
            <tr>
              <Table.HeaderCell scope="col" sort={sort}>
                <Table.SortButton aria-label="Invoice number" onClick={() => setSort('ascending')}>
                  Invoice
                </Table.SortButton>
              </Table.HeaderCell>
            </tr>
          </thead>
        </table>
      );
    }
    render(<Labelled />);
    fireEvent.click(screen.getByRole('button'));
    await act(() => vi.advanceTimersByTimeAsync(1000));
    expect(live()).toBe('Sorted by Invoice number, ascending');
  });

  it('does not announce a change it did not follow a click for, or after the click was prevented', async () => {
    function Controlled() {
      const [sort, setSort] = useState<TableSort>('none');
      return (
        <>
          <button type="button" onClick={() => setSort('ascending')}>
            apply
          </button>
          <table>
            <thead>
              <tr>
                <Table.HeaderCell scope="col" sort={sort}>
                  <Table.SortButton onClick={(event) => event.preventDefault()}>Name</Table.SortButton>
                </Table.HeaderCell>
              </tr>
            </thead>
          </table>
        </>
      );
    }
    render(<Controlled />);
    fireEvent.click(screen.getByRole('button', { name: 'apply' }));
    await act(() => vi.advanceTimersByTimeAsync(1000));
    expect(live()).toBe('');
    fireEvent.click(screen.getByRole('button', { name: 'Name' }));
    fireEvent.click(screen.getByRole('button', { name: 'apply' }));
    await act(() => vi.advanceTimersByTimeAsync(1000));
    expect(live()).toBe('');
  });

  it('stops watching when it unmounts', async () => {
    const { rerender } = render(<Headers sort="none"><Table.SortButton>Name</Table.SortButton></Headers>);
    fireEvent.click(screen.getByRole('button'));
    const cell = screen.getByRole('columnheader');
    rerender(<div />);
    cell.setAttribute('aria-sort', 'ascending');
    await act(() => vi.advanceTimersByTimeAsync(1000));
    expect(live()).toBe('');
  });

  it('reads the announcement from StringsProvider', async () => {
    render(
      <StringsProvider strings={{ sortedAscending: (column) => `${column} trié` }}>
        <Sortable />
      </StringsProvider>,
    );
    fireEvent.click(screen.getByRole('button'));
    await act(() => vi.advanceTimersByTimeAsync(1000));
    expect(live()).toBe('Name trié');
  });
});
