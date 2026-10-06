import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { renderToString } from 'react-dom/server';
import { useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Tabs, type TabsRootProps } from '../index';

afterEach(cleanup);

function Example(props: Partial<TabsRootProps> & { disabledB?: boolean }) {
  const { disabledB, ...root } = props;
  return (
    <Tabs.Root {...((root.value === undefined ? { defaultValue: 'a', ...root } : root) as TabsRootProps)}>
      <Tabs.List aria-label="Settings">
        <Tabs.Tab value="a">Account</Tabs.Tab>
        <Tabs.Tab value="b" disabled={disabledB}>
          Billing
        </Tabs.Tab>
        <Tabs.Tab value="c d">Team members</Tabs.Tab>
      </Tabs.List>
      <Tabs.Panel value="a">Account panel</Tabs.Panel>
      <Tabs.Panel value="b">Billing panel</Tabs.Panel>
      <Tabs.Panel value="c d" keepMounted>
        Team panel
      </Tabs.Panel>
    </Tabs.Root>
  );
}

const tab = (name: string) => screen.getByRole('tab', { name });
const key = (k: string) => fireEvent.keyDown(document.activeElement!, { key: k });

describe('Tabs', () => {
  it('wires tablist, tabs and panels', () => {
    render(<Example />);
    const list = screen.getByRole('tablist', { name: 'Settings' });
    expect(list.getAttribute('aria-orientation')).toBe('horizontal');
    const account = tab('Account');
    expect(account.getAttribute('aria-selected')).toBe('true');
    expect(account.tabIndex).toBe(0);
    expect(tab('Billing').tabIndex).toBe(-1);
    expect(tab('Billing').getAttribute('aria-selected')).toBe('false');
    const panel = screen.getByRole('tabpanel', { name: 'Account' });
    expect(account.getAttribute('aria-controls')).toBe(panel.id);
    expect(panel.textContent).toBe('Account panel');
    expect(panel.tabIndex).toBe(0);
  });

  it('never gives two values the same id', () => {
    render(
      <Tabs.Root defaultValue="a b">
        <Tabs.List aria-label="Ids">
          {['a b', 'a_b', 'a.b'].map((v) => (
            <Tabs.Tab key={v} value={v}>
              {v}
            </Tabs.Tab>
          ))}
        </Tabs.List>
      </Tabs.Root>,
    );
    const ids = screen.getAllByRole('tab').map((el) => el.id);
    expect(new Set(ids).size).toBe(3);
    for (const id of ids) expect(id).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  it('gives values with spaces safe, distinct ids', () => {
    render(<Example />);
    const team = tab('Team members');
    expect(team.id).not.toContain(' ');
    expect(team.getAttribute('aria-controls')).not.toContain(' ');
    expect(document.getElementById(team.getAttribute('aria-controls')!)?.getAttribute('aria-labelledby')).toBe(team.id);
  });

  it('renders only the selected panel unless keepMounted', () => {
    render(<Example />);
    expect(screen.queryByText('Billing panel')).toBeNull();
    const team = screen.getByText('Team panel');
    expect(team.closest('[role="tabpanel"]')?.hasAttribute('hidden')).toBe(true);
  });

  it('selects on click', () => {
    const onValueChange = vi.fn();
    render(<Example onValueChange={onValueChange} />);
    fireEvent.click(tab('Billing'));
    expect(onValueChange).toHaveBeenCalledWith('b');
    expect(tab('Billing').getAttribute('aria-selected')).toBe('true');
    expect(screen.getByRole('tabpanel').textContent).toBe('Billing panel');
  });

  it('selects on arrow keys with automatic activation', () => {
    const onValueChange = vi.fn();
    render(<Example onValueChange={onValueChange} />);
    act(() => tab('Account').focus());
    key('ArrowRight');
    expect(document.activeElement).toBe(tab('Billing'));
    expect(onValueChange).toHaveBeenLastCalledWith('b');
    key('End');
    expect(onValueChange).toHaveBeenLastCalledWith('c d');
    key('ArrowRight');
    expect(document.activeElement).toBe(tab('Account'));
    expect(tab('Account').getAttribute('aria-selected')).toBe('true');
  });

  it('only moves focus with manual activation, and keeps the tab stop on the selected tab', () => {
    const onValueChange = vi.fn();
    render(<Example activation="manual" onValueChange={onValueChange} />);
    act(() => tab('Account').focus());
    key('ArrowRight');
    expect(document.activeElement).toBe(tab('Billing'));
    expect(onValueChange).not.toHaveBeenCalled();
    expect(tab('Account').getAttribute('aria-selected')).toBe('true');
    fireEvent.click(tab('Billing'));
    expect(onValueChange).toHaveBeenCalledWith('b');
  });

  it('manual activation keeps one tab stop on the focused tab, and returns it to the selected tab on leaving', () => {
    render(<Example activation="manual" />);
    act(() => tab('Account').focus());
    key('ArrowRight');
    key('ArrowRight');
    const stops = () => screen.getAllByRole('tab').filter((el) => el.tabIndex === 0);
    expect(stops()).toEqual([tab('Team members')]);
    act(() => screen.getByRole('tabpanel').focus());
    expect(stops()).toEqual([tab('Account')]);
  });

  it('returns the tab stop to the selected tab when the focused tab turns disabled', async () => {
    const { rerender } = render(<Example activation="manual" defaultValue="c d" />);
    act(() => tab('Team members').focus());
    key('ArrowLeft');
    expect(document.activeElement).toBe(tab('Billing'));
    await act(async () => rerender(<Example activation="manual" defaultValue="c d" disabledB />));
    const stops = screen.getAllByRole('tab').filter((el) => el.tabIndex === 0);
    expect(stops).toEqual([tab('Team members')]);
  });

  it('keeps the tab stop on the focused tab across re-renders', () => {
    const { rerender } = render(<Example activation="manual" />);
    act(() => tab('Account').focus());
    key('ArrowRight');
    rerender(<Example activation="manual" />);
    const stops = screen.getAllByRole('tab').filter((el) => el.tabIndex === 0);
    expect(stops).toEqual([tab('Billing')]);
  });

  it('moves the tab stop to a tab selected while focus is outside the list', () => {
    function Outside() {
      const [value, setValue] = useState('a');
      return (
        <>
          <button type="button" onClick={() => setValue('b')}>
            Next
          </button>
          <Example activation="manual" value={value} onValueChange={setValue} />
        </>
      );
    }
    render(<Outside />);
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    const stops = screen.getAllByRole('tab').filter((el) => el.tabIndex === 0);
    expect(stops).toEqual([tab('Billing')]);
  });

  it('does not select when focus enters the list from outside', () => {
    const onValueChange = vi.fn();
    render(
      <>
        <button type="button">Before</button>
        <Example value="b" disabledB onValueChange={onValueChange} />
      </>,
    );
    act(() => screen.getByRole('button', { name: 'Before' }).focus());
    expect(tab('Account').tabIndex).toBe(0);
    act(() => tab('Account').focus());
    expect(onValueChange).not.toHaveBeenCalled();
    key('ArrowRight');
    expect(onValueChange).toHaveBeenLastCalledWith('c d');
  });

  it('skips disabled tabs', () => {
    render(<Example disabledB />);
    expect((tab('Billing') as HTMLButtonElement).disabled).toBe(true);
    act(() => tab('Account').focus());
    key('ArrowRight');
    expect(document.activeElement).toBe(tab('Team members'));
  });

  it('uses Up and Down when vertical', () => {
    render(<Example orientation="vertical" />);
    expect(screen.getByRole('tablist').getAttribute('aria-orientation')).toBe('vertical');
    act(() => tab('Account').focus());
    key('ArrowRight');
    expect(document.activeElement).toBe(tab('Account'));
    key('ArrowDown');
    expect(document.activeElement).toBe(tab('Billing'));
  });

  it('works controlled', () => {
    function Controlled() {
      const [value, setValue] = useState('b');
      return (
        <>
          <output>{value}</output>
          <Example value={value} onValueChange={setValue} />
        </>
      );
    }
    render(<Controlled />);
    expect(tab('Billing').getAttribute('aria-selected')).toBe('true');
    expect(tab('Billing').tabIndex).toBe(0);
    fireEvent.click(tab('Account'));
    expect(screen.getByRole('status').textContent).toBe('a');
  });

  it('a controlled root that ignores the change keeps its tab', () => {
    render(<Example value="a" onValueChange={() => undefined} />);
    fireEvent.click(tab('Billing'));
    expect(tab('Account').getAttribute('aria-selected')).toBe('true');
  });

  it('server-renders one tab stop on the selected tab', () => {
    const host = document.createElement('div');
    host.innerHTML = renderToString(<Example defaultValue="b" />);
    const stops = [...host.querySelectorAll('[role="tab"]')].filter((el) => el.getAttribute('tabindex') === '0');
    expect(stops.map((el) => el.textContent)).toEqual(['Billing']);
  });

  it('throws outside Tabs.Root', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    expect(() => render(<Tabs.Tab value="a">A</Tabs.Tab>)).toThrow('Tabs.Tab must render inside Tabs.Root');
    spy.mockRestore();
  });
});
