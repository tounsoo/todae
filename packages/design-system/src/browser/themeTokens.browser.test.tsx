import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { Button, Card, Label, Table, Tabs, ThemeProvider, ToggleGroup, type ThemeOverride, type ThemeShadowLayer } from '../index';

afterEach(cleanup);

const hard: ThemeShadowLayer = {
  color: { colorSpace: 'oklch', components: [0.2, 0, 0] },
  offsetX: { value: 3, unit: 'px' },
  offsetY: { value: 3, unit: 'px' },
  blur: { value: 0, unit: 'px' },
  spread: { value: 0, unit: 'px' },
};
const caps: ThemeOverride = {
  'button.base.font.letter-spacing': { value: 0.05, unit: 'rem' },
  'button.base.font.text-transform': 'uppercase',
  'tabs.font.letter-spacing': { value: 0.05, unit: 'rem' },
  'tabs.font.text-transform': 'uppercase',
  'field.label.font.letter-spacing': { value: 0.05, unit: 'rem' },
  'field.label.font.text-transform': 'uppercase',
  'table.header.font.letter-spacing': { value: 0.05, unit: 'rem' },
  'table.header.font.text-transform': 'uppercase',
  'card.shadow': hard,
  'button.primary.shadow': hard,
  'button.secondary.shadow': hard,
  'button.ghost.shadow': hard,
};
const HARD = 'oklch(0.2 0 0) 3px 3px 0px 0px';

function Themed() {
  return (
    <ThemeProvider appearance="light" overrides={caps}>
      <Card.Root data-testid="card">
        <Card.Body>
          <Button.Root>Save</Button.Root>
          <Button.Root variant="ghost">Skip</Button.Root>
          <Button.Root variant="secondary">Back</Button.Root>
          <ToggleGroup.Root aria-label="View" defaultValue="list">
            <ToggleGroup.Item value="list">List</ToggleGroup.Item>
            <ToggleGroup.Item value="board">Board</ToggleGroup.Item>
          </ToggleGroup.Root>
          <Button.Root disabled>Off</Button.Root>
          <Button.Group aria-label="Range">
            <Button.Root>Day</Button.Root>
            <Button.Root aria-pressed="true">Week</Button.Root>
          </Button.Group>
          <Tabs.Root defaultValue="a">
            <Tabs.List aria-label="Sections">
              <Tabs.Tab value="a">Alpha</Tabs.Tab>
            </Tabs.List>
            <Tabs.Panel value="a">Alpha panel</Tabs.Panel>
          </Tabs.Root>
          <Label.Root htmlFor="x">Name</Label.Root>
          <input id="x" />
          <Table.Root>
            <Table.Head>
              <Table.Row>
                <Table.HeaderCell scope="col">Invoice</Table.HeaderCell>
              </Table.Row>
            </Table.Head>
          </Table.Root>
        </Card.Body>
      </Card.Root>
    </ThemeProvider>
  );
}

describe('theme tokens for case, spacing and shadows in a browser', () => {
  it('reach Button, Tabs, Label and the Table header', () => {
    render(<Themed />);
    for (const el of [
      screen.getByRole('button', { name: 'Save' }),
      screen.getByRole('tab', { name: 'Alpha' }),
      screen.getByText('Name'),
      screen.getByRole('columnheader', { name: 'Invoice' }),
    ]) {
      const style = getComputedStyle(el);
      expect(style.textTransform, el.textContent!).toBe('uppercase');
      expect(style.letterSpacing, el.textContent!).toBe('0.8px');
    }
  });

  it('draws card and per-variant button shadows, but not while disabled or joined in a group', () => {
    render(<Themed />);
    const shadow = (name: string) => getComputedStyle(screen.getByRole('button', { name })).boxShadow;
    expect(getComputedStyle(screen.getByTestId('card')).boxShadow).toBe(HARD);
    expect(shadow('Save')).toBe(HARD);
    expect(shadow('Skip')).toBe(HARD);
    expect(shadow('Back')).toBe(HARD);
    expect(shadow('Board')).not.toContain('3px 3px');
    expect(shadow('Off')).not.toContain('3px 3px');
    expect(shadow('Day')).not.toContain('3px 3px');
    expect(shadow('Week')).toContain('inset');
    expect(shadow('Week')).not.toContain('3px 3px');
  });
});
