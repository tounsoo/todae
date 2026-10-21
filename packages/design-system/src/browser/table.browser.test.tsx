import { render, screen } from '@testing-library/react';
import { userEvent } from '@vitest/browser/context';
import { useState, type ReactNode } from 'react';
import { describe, expect, it } from 'vitest';
import { Checkbox, Table, useSelection, VisuallyHidden, type TableSort } from '../index.js';

function Themed({ children }: { children: ReactNode }) {
  return (
    <main data-appearance="light" data-density="comfortable">
      {children}
    </main>
  );
}

const ROWS = ['Ada', 'Grace', 'Alan', 'Edsger', 'Barbara'];

function Selectable() {
  const selection = useSelection({ keys: ROWS });
  return (
    <Table.Root>
      <Table.Caption>People</Table.Caption>
      <Table.Head>
        <Table.Row>
          <Table.HeaderCell scope="col">
            <Checkbox.Root {...selection.getSelectAllProps()}>
              <VisuallyHidden.Root>Select all rows</VisuallyHidden.Root>
            </Checkbox.Root>
          </Table.HeaderCell>
          <Table.HeaderCell scope="col">Name</Table.HeaderCell>
        </Table.Row>
      </Table.Head>
      <Table.Body>
        {ROWS.map((name) => (
          <Table.Row key={name} selected={selection.isSelected(name)}>
            <Table.Cell>
              <Checkbox.Root {...selection.getCheckboxProps(name)}>
                <VisuallyHidden.Root>{`Select ${name}`}</VisuallyHidden.Root>
              </Checkbox.Root>
            </Table.Cell>
            <Table.Cell>{name}</Table.Cell>
          </Table.Row>
        ))}
      </Table.Body>
    </Table.Root>
  );
}

const checked = () => ROWS.filter((name) => (screen.getByRole('checkbox', { name: `Select ${name}` }) as HTMLInputElement).checked);

describe('Table selection in a browser', () => {
  it('selects a range with a Shift click, in either direction', async () => {
    render(
      <Themed>
        <Selectable />
      </Themed>,
    );
    await userEvent.click(screen.getByRole('checkbox', { name: 'Select Grace' }));
    await userEvent.keyboard('{Shift>}');
    await userEvent.click(screen.getByRole('checkbox', { name: 'Select Edsger' }));
    await userEvent.keyboard('{/Shift}');
    expect(checked()).toEqual(['Grace', 'Alan', 'Edsger']);
    await userEvent.keyboard('{Shift>}');
    await userEvent.click(screen.getByRole('checkbox', { name: 'Select Ada' }));
    await userEvent.keyboard('{/Shift}');
    expect(checked()).toEqual(['Ada', 'Grace', 'Alan', 'Edsger']);
  });

  it('selects a range with Shift and Space on a focused checkbox', async () => {
    render(
      <Themed>
        <Selectable />
      </Themed>,
    );
    screen.getByRole('checkbox', { name: 'Select Ada' }).focus();
    await userEvent.keyboard(' ');
    screen.getByRole('checkbox', { name: 'Select Alan' }).focus();
    await userEvent.keyboard('{Shift>}[Space]{/Shift}');
    expect(checked()).toEqual(['Ada', 'Grace', 'Alan']);
  });

  it('shows the mixed state of the select-all box, and fills a selected row', async () => {
    render(
      <Themed>
        <Selectable />
      </Themed>,
    );
    const all = screen.getByRole('checkbox', { name: 'Select all rows' }) as HTMLInputElement;
    await userEvent.click(screen.getByRole('checkbox', { name: 'Select Ada' }));
    expect(all.indeterminate).toBe(true);
    expect(all.matches(':indeterminate')).toBe(true);
    const row = screen.getByRole('checkbox', { name: 'Select Ada' }).closest('tr')!;
    expect(getComputedStyle(row).backgroundColor).not.toBe('rgba(0, 0, 0, 0)');
    expect(getComputedStyle(screen.getByRole('checkbox', { name: 'Select Grace' }).closest('tr')!).backgroundColor).toBe('rgba(0, 0, 0, 0)');
    await userEvent.click(all);
    expect(all.indeterminate).toBe(false);
    expect(checked()).toEqual(ROWS);
  });
});

function Sorting({ initial }: { initial: TableSort }) {
  const [sort, setSort] = useState<TableSort>(initial);
  return (
    <Table.Root>
      <Table.Head>
        <Table.Row>
          <Table.HeaderCell scope="col" sort={sort}>
            <Table.SortButton onClick={() => setSort(sort === 'ascending' ? 'descending' : 'ascending')}>Name</Table.SortButton>
          </Table.HeaderCell>
          <Table.HeaderCell scope="col" sort="none">
            <Table.SortButton>Amount</Table.SortButton>
          </Table.HeaderCell>
        </Table.Row>
      </Table.Head>
    </Table.Root>
  );
}

describe('Table.SortButton in a browser', () => {
  const glyph = (name: string) => screen.getByRole('button', { name }).querySelector<HTMLElement>('[data-todae-glyph]')!;

  it('hides the glyph of an unsorted column without moving the label, and shows it on hover and focus', async () => {
    render(
      <Themed>
        <Sorting initial="none" />
      </Themed>,
    );
    const button = screen.getByRole('button', { name: 'Name' });
    const before = button.getBoundingClientRect().width;
    expect(getComputedStyle(glyph('Name')).visibility).toBe('hidden');
    await userEvent.hover(button);
    expect(getComputedStyle(glyph('Name')).visibility).toBe('visible');
    await userEvent.unhover(button);
    expect(getComputedStyle(glyph('Name')).visibility).toBe('hidden');
    await userEvent.tab();
    expect(getComputedStyle(glyph('Name')).visibility).toBe('visible');
    expect(button.getBoundingClientRect().width).toBe(before);
    expect(getComputedStyle(button).outlineStyle).toBe('solid');
  });

  it('shows the glyph on a sorted column and turns it when descending', async () => {
    render(
      <Themed>
        <Sorting initial="ascending" />
      </Themed>,
    );
    expect(getComputedStyle(glyph('Name')).visibility).toBe('visible');
    expect(getComputedStyle(glyph('Name')).rotate).toBe('none');
    await userEvent.click(screen.getByRole('button', { name: 'Name' }));
    expect(getComputedStyle(glyph('Name')).visibility).toBe('visible');
    expect(getComputedStyle(glyph('Name')).rotate).toBe('180deg');
    expect(getComputedStyle(glyph('Amount')).visibility).toBe('hidden');
  });
});
