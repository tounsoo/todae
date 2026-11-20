import { cleanup, render, screen } from '@testing-library/react';
import { userEvent } from 'vitest/browser';
import { afterEach, expect, it } from 'vitest';
import '@tounsoo/todae/todae.css';
import { Button, ThemeProvider, ToggleGroup, type ThemeOverride } from '@tounsoo/todae';
import { PRESETS } from '../components/playground/presets';

afterEach(cleanup);

const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday'];

function group(values: string[], width?: number, dir?: 'rtl') {
  return (
    <div dir={dir} style={width === undefined ? undefined : { width }}>
      <ToggleGroup.Root aria-label="Days" defaultValue={values[0]}>
        {values.map((value) => (
          <ToggleGroup.Item key={value} value={value}>
            {value}
          </ToggleGroup.Item>
        ))}
      </ToggleGroup.Root>
    </div>
  );
}

function buttons() {
  return screen.getAllByRole('button');
}

function rowsOf(items: HTMLElement[]) {
  const rows: HTMLElement[][] = [];
  for (const item of items) {
    const top = item.getBoundingClientRect().top;
    const row = rows.find((line) => {
      const first = line[0];
      return first !== undefined && Math.abs(first.getBoundingClientRect().top - top) < 1;
    });
    if (row) row.push(item);
    else rows.push([item]);
  }
  return rows;
}

type Corner = 'topLeft' | 'topRight' | 'bottomLeft' | 'bottomRight';

function radius(item: HTMLElement, corner: Corner) {
  const style = getComputedStyle(item);
  const value = {
    topLeft: style.borderTopLeftRadius,
    topRight: style.borderTopRightRadius,
    bottomLeft: style.borderBottomLeftRadius,
    bottomRight: style.borderBottomRightRadius,
  }[corner];
  return parseFloat(value);
}

function expectJoinedRows(items: HTMLElement[], rtl: boolean) {
  const group = screen.getByRole('group', { name: 'Days' });
  const groupBox = group.getBoundingClientRect();
  const groupStyle = getComputedStyle(group);
  const rows = rowsOf(items);
  expect(rows.length, 'the group wraps onto more than one line').toBeGreaterThan(1);

  const outer: Corner[] = rtl ? ['topRight', 'bottomRight'] : ['topLeft', 'bottomLeft'];
  const inner: Corner[] = rtl ? ['topLeft', 'bottomLeft'] : ['topRight', 'bottomRight'];
  let previousBottom = Number.NEGATIVE_INFINITY;

  for (const row of rows) {
    const ordered = [...row].sort((a, b) => a.getBoundingClientRect().left - b.getBoundingClientRect().left);
    const start = (rtl ? ordered[ordered.length - 1] : ordered[0]) as HTMLElement;
    const end = (rtl ? ordered[0] : ordered[ordered.length - 1]) as HTMLElement;
    const startBox = start.getBoundingClientRect();
    const edge = rtl ? groupBox.right - parseFloat(groupStyle.borderRightWidth) : groupBox.left + parseFloat(groupStyle.borderLeftWidth);
    const startEdge = rtl ? startBox.right : startBox.left;
    expect(startEdge, 'a wrapped line starts on the group edge').toBeCloseTo(edge, 0);

    const top = Math.min(...ordered.map((item) => item.getBoundingClientRect().top));
    expect(top, 'a line does not cover the line above').toBeGreaterThanOrEqual(previousBottom - 0.5);
    previousBottom = Math.max(...ordered.map((item) => item.getBoundingClientRect().bottom));

    for (const corner of outer) expect(radius(start, corner), 'the line start keeps its outer corner').toBeGreaterThan(0);
    for (const corner of inner) expect(radius(end, corner), 'the line end keeps its outer corner').toBeGreaterThan(0);
    if (start !== end) {
      for (const corner of inner) expect(radius(start, corner)).toBe(0);
      for (const corner of outer) expect(radius(end, corner)).toBe(0);
    }

    for (let index = 0; index < ordered.length - 1; index += 1) {
      const prev = ordered[index] as HTMLElement;
      const next = ordered[index + 1] as HTMLElement;
      const shared = parseFloat(getComputedStyle(prev).borderRightWidth);
      const overlap = prev.getBoundingClientRect().right - next.getBoundingClientRect().left;
      expect(overlap, 'neighbors on a line share one border').toBeCloseTo(shared, 0);
      if (prev !== start && prev !== end) {
        for (const corner of [...outer, ...inner]) expect(radius(prev, corner)).toBe(0);
      }
    }
  }
}

it('wraps a joined group onto several lines without clipping or covering the line above', () => {
  render(group(days, 160));
  expectJoinedRows(buttons(), false);
});

it('wraps a right-to-left group from the inline start', () => {
  render(group(days, 160, 'rtl'));
  expectJoinedRows(buttons(), true);
});

it('keeps a Button.Group on one row when the space is narrow', () => {
  render(
    <div style={{ width: 80 }}>
      <Button.Group aria-label="Pages">
        <Button.Root>One</Button.Root>
        <Button.Root>Two</Button.Root>
        <Button.Root>Three</Button.Root>
      </Button.Group>
    </div>,
  );
  const tops = buttons().map((item) => item.getBoundingClientRect().top);
  expect(Math.max(...tops) - Math.min(...tops)).toBeLessThan(1);
});

it('keeps a sized Button.Group at the width it was given', () => {
  render(
    <Button.Group aria-label="Pages" style={{ width: 200 }}>
      <Button.Root>One</Button.Root>
      <Button.Root>Two</Button.Root>
    </Button.Group>,
  );
  const group = screen.getByRole('group', { name: 'Pages' });
  expect(group.getBoundingClientRect().width).toBeCloseTo(200, 0);
  const [first, second] = buttons() as [HTMLElement, HTMLElement];
  const shared = parseFloat(getComputedStyle(first).borderRightWidth);
  expect(first.getBoundingClientRect().right - second.getBoundingClientRect().left).toBeCloseTo(shared, 0);
});

it('keeps a segment wider than the row inside the group', () => {
  render(
    <div style={{ width: 160 }}>
      <ToggleGroup.Root aria-label="Days" defaultValue="long">
        <ToggleGroup.Item value="long">Wednesday-and-the-rest-of-the-week</ToggleGroup.Item>
        <ToggleGroup.Item value="short">Thu</ToggleGroup.Item>
      </ToggleGroup.Root>
    </div>,
  );
  const group = screen.getByRole('group', { name: 'Days' });
  const host = group.parentElement as HTMLElement;
  const long = screen.getByRole('button', { name: 'Wednesday-and-the-rest-of-the-week' });
  const hostBox = host.getBoundingClientRect();
  const groupBox = group.getBoundingClientRect();
  const itemBox = long.getBoundingClientRect();
  expect(groupBox.right, 'the group stays inside its host').toBeLessThanOrEqual(hostBox.right + 0.5);
  expect(itemBox.right, 'the segment border stays inside the group').toBeLessThanOrEqual(groupBox.right + 0.5);
  expect(itemBox.left, 'the segment starts inside the group').toBeGreaterThanOrEqual(groupBox.left - 0.5);
});

it('keeps one joined row when the group has room', () => {
  render(group(['Left', 'Center', 'Right']));
  const items = buttons();
  expect(rowsOf(items)).toHaveLength(1);
  const ordered = [...items].sort((a, b) => a.getBoundingClientRect().left - b.getBoundingClientRect().left);
  const start = ordered[0] as HTMLElement;
  const middle = ordered[1] as HTMLElement;
  const end = ordered[2] as HTMLElement;
  expect(radius(start, 'topLeft')).toBeGreaterThan(0);
  expect(radius(start, 'topRight')).toBe(0);
  expect(radius(end, 'topRight')).toBeGreaterThan(0);
  expect(radius(end, 'topLeft')).toBe(0);
  expect(radius(middle, 'topLeft')).toBe(0);
  expect(radius(middle, 'topRight')).toBe(0);
  const shared = parseFloat(getComputedStyle(start).borderRightWidth);
  expect(start.getBoundingClientRect().right - middle.getBoundingClientRect().left).toBeCloseTo(shared, 0);
});

it('colors an unpressed segment from togglegroup.item.border.default and leaves other borders', () => {
  const border = (name: string) => getComputedStyle(screen.getByRole('button', { name })).borderTopColor;
  const segment = (
    <ToggleGroup.Root aria-label="Align" defaultValue="right">
      <ToggleGroup.Item value="left">Left</ToggleGroup.Item>
      <ToggleGroup.Item value="right">Right</ToggleGroup.Item>
    </ToggleGroup.Root>
  );
  const { rerender } = render(
    <>
      <Button.Root variant="secondary">Outside</Button.Root>
      {segment}
    </>,
  );
  const outside = border('Outside');
  expect(border('Left'), 'an unpressed segment starts with the secondary button border').toBe(outside);

  const overrides: ThemeOverride = {
    'togglegroup.item.border.default': { colorSpace: 'oklch', components: [0.55, 0.22, 30] },
  };
  rerender(
    <ThemeProvider appearance="light" overrides={overrides}>
      <Button.Root variant="secondary">Outside</Button.Root>
      {segment}
    </ThemeProvider>,
  );
  expect(border('Outside'), 'a secondary button keeps its own border').toBe(outside);
  expect(border('Left'), 'the unpressed segment takes the token').not.toBe(outside);
  expect(border('Right'), 'the pressed segment keeps border.pressed').toBe(outside);
});

function labelOf(button: HTMLElement) {
  const label = button.querySelector('span');
  if (!label) throw new Error('missing label');
  return label;
}

it('keeps a one-item group as wide as its label', () => {
  render(
    <>
      <Button.Root variant="secondary">Alpha</Button.Root>
      <Button.Group aria-label="One button">
        <Button.Root variant="secondary">Alpha</Button.Root>
      </Button.Group>
      <ToggleGroup.Root aria-label="One toggle" defaultValue="alpha">
        <ToggleGroup.Item value="alpha">Alpha</ToggleGroup.Item>
      </ToggleGroup.Root>
    </>,
  );
  const [alone, grouped, toggled] = buttons() as [HTMLElement, HTMLElement, HTMLElement];
  const aloneWidth = alone.getBoundingClientRect().width;
  for (const button of [grouped, toggled]) {
    expect(button.getBoundingClientRect().width).toBeCloseTo(aloneWidth, 0);
    const label = labelOf(button);
    expect(label.scrollWidth).toBeLessThanOrEqual(label.clientWidth);
  }
});

it('rewraps when the container resizes without a render', async () => {
  render(
    <div style={{ width: 480 }}>
      <ToggleGroup.Root aria-label="Days" defaultValue="Monday">
        {days.map((value) => (
          <ToggleGroup.Item key={value} value={value}>
            {value}
          </ToggleGroup.Item>
        ))}
      </ToggleGroup.Root>
    </div>,
  );
  expect(rowsOf(buttons())).toHaveLength(1);
  const host = screen.getByRole('group', { name: 'Days' }).parentElement as HTMLElement;
  host.style.width = '160px';
  await expect.poll(() => {
    const rows = rowsOf(buttons());
    const end = rows[0]?.at(-1);
    return rows.length > 1 && end !== undefined && radius(end, 'topRight') > 0;
  }).toBe(true);
  expectJoinedRows(buttons(), false);
});

it('keeps a required item pressed on Space and Enter', async () => {
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
  await userEvent.keyboard(' ');
  await userEvent.click(left);
  expect(left).toHaveAttribute('aria-pressed', 'true');
  expect(seen).toEqual([]);
  await userEvent.click(screen.getByRole('button', { name: 'Center' }));
  expect(seen).toEqual(['center']);
});

it('follows button.secondary.border.default on an unpressed segment', () => {
  const overrides: ThemeOverride = {
    'button.secondary.border.default': { colorSpace: 'oklch', components: [0.55, 0.22, 30] },
  };
  render(
    <ThemeProvider appearance="light" overrides={overrides}>
      <Button.Root variant="secondary">Outside</Button.Root>
      <ToggleGroup.Root aria-label="Align" defaultValue="right">
        <ToggleGroup.Item value="left">Left</ToggleGroup.Item>
        <ToggleGroup.Item value="right">Right</ToggleGroup.Item>
      </ToggleGroup.Root>
    </ThemeProvider>,
  );
  const border = (name: string) => getComputedStyle(screen.getByRole('button', { name })).borderTopColor;
  const outside = border('Outside');
  expect(border('Left')).toBe(outside);
  expect(border('Right')).not.toBe(outside);
});

it('keeps a wrapped Anvil track inside its padding', () => {
  const anvil = PRESETS.find((preset) => preset.id === 'anvil');
  if (!anvil) throw new Error('missing Anvil preset');
  render(
    <ThemeProvider appearance="light" overrides={anvil.light}>
      <div style={{ width: 200 }}>
        <ToggleGroup.Root aria-label="Days" defaultValue="Monday">
          {days.map((value) => (
            <ToggleGroup.Item key={value} value={value}>
              {value}
            </ToggleGroup.Item>
          ))}
        </ToggleGroup.Root>
      </div>
    </ThemeProvider>,
  );
  const group = screen.getByRole('group', { name: 'Days' });
  const box = group.getBoundingClientRect();
  const style = getComputedStyle(group);
  const contentStart = box.left + parseFloat(style.borderLeftWidth) + parseFloat(style.paddingLeft);
  const contentEnd = box.right - parseFloat(style.borderRightWidth) - parseFloat(style.paddingRight);
  expect(group.scrollWidth).toBeLessThanOrEqual(group.clientWidth);
  const rows = rowsOf(buttons());
  expect(rows.length).toBeGreaterThan(1);
  let previousBottom = Number.NEGATIVE_INFINITY;
  for (const row of rows) {
    const start = row[0] as HTMLElement;
    const end = row[row.length - 1] as HTMLElement;
    expect(start.getBoundingClientRect().left).toBeCloseTo(contentStart, 0);
    expect(end.getBoundingClientRect().right).toBeLessThanOrEqual(contentEnd + 0.5);
    expect(radius(start, 'topLeft')).toBeGreaterThan(0);
    expect(radius(end, 'topRight')).toBeGreaterThan(0);
    const top = Math.min(...row.map((item) => item.getBoundingClientRect().top));
    expect(top).toBeGreaterThanOrEqual(previousBottom - 0.5);
    previousBottom = Math.max(...row.map((item) => item.getBoundingClientRect().bottom));
  }
});
