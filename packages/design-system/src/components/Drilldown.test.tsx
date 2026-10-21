import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Dialog, Drilldown, StringsProvider, type DrilldownChangeReason, type DrilldownRootProps } from '../index.js';

afterEach(cleanup);

function Settings(props: Partial<DrilldownRootProps>) {
  return (
    <Drilldown.Root {...(props.value === undefined ? { defaultValue: ['settings'], ...props } : props)}>
      <Drilldown.Back />
      <h2>
        <Drilldown.Label data-testid="title" />
      </h2>
      <Drilldown.Viewport>
        <Drilldown.View value="settings" label="Settings">
          <Drilldown.Trigger value="account">Account</Drilldown.Trigger>
          <Drilldown.Trigger value="notifications">Notifications</Drilldown.Trigger>
        </Drilldown.View>
        <Drilldown.View value="account" label="Account">
          <Drilldown.Trigger value="email">Email</Drilldown.Trigger>
        </Drilldown.View>
        <Drilldown.View value="notifications" label="Notifications">
          <input aria-label="Digest" />
        </Drilldown.View>
        <Drilldown.View value="email" label="Email">
          <input aria-label="Address" />
        </Drilldown.View>
      </Drilldown.Viewport>
    </Drilldown.Root>
  );
}

const click = (name: string) => fireEvent.click(screen.getByRole('button', { name }));
const group = (name: string) => screen.getByRole('group', { name });

describe('Drilldown', () => {
  it('shows the first view as a named group, with no Back', () => {
    render(<Settings />);
    expect(group('Settings')).toBeTruthy();
    expect(screen.queryByRole('group', { name: 'Account' })).toBeNull();
    expect(screen.queryByRole('button', { name: /Back/ })).toBeNull();
    expect(screen.getByTestId('title').textContent).toBe('Settings');
  });

  it('names a view by its label only', () => {
    render(
      <Drilldown.Root defaultValue={['a']}>
        <Drilldown.View value="a" label="Settings" aria-label="Other" />
      </Drilldown.Root>,
    );
    expect(group('Settings')).toBeTruthy();
  });

  it('pushes a view with a trigger and goes back, keeping lower views mounted but hidden', () => {
    const onValueChange = vi.fn();
    render(<Settings onValueChange={onValueChange} />);
    click('Account');
    expect(onValueChange).toHaveBeenLastCalledWith(['settings', 'account'], 'push');
    expect(screen.getByTestId('title').textContent).toBe('Account');
    const settings = document.querySelector<HTMLElement>('[role="group"][aria-label="Settings"]');
    expect(settings?.hidden).toBe(true);
    expect(group('Account').hidden).toBe(false);
    click('Back to Settings');
    expect(onValueChange).toHaveBeenLastCalledWith(['settings'], 'back');
    expect(document.querySelector('[role="group"][aria-label="Account"]')).toBeNull();
    expect(screen.getByTestId('title').textContent).toBe('Settings');
  });

  it('follows a controlled stack, including a jump several views deep', () => {
    function Controlled() {
      const [stack, setStack] = useState<readonly string[]>(['settings']);
      const [reasons, setReasons] = useState<DrilldownChangeReason[]>([]);
      return (
        <>
          <button type="button" onClick={() => setStack(['settings', 'account', 'email'])}>
            Deep link
          </button>
          <output>{reasons.join(',')}</output>
          <Settings
            value={stack}
            onValueChange={(next, reason) => {
              setReasons((r) => [...r, reason]);
              if (reason !== 'push') setStack(next);
            }}
          />
        </>
      );
    }
    render(<Controlled />);
    click('Account');
    // The product kept the stack, so nothing moved.
    expect(screen.getByTestId('title').textContent).toBe('Settings');
    expect(screen.getByRole('status').textContent).toBe('push');
    click('Deep link');
    expect(screen.getByTestId('title').textContent).toBe('Email');
    click('Back to Account');
    expect(screen.getByTestId('title').textContent).toBe('Account');
  });

  it('pushes from a trigger drawn on another element, after its own click handler, which can keep the view', () => {
    const onValueChange = vi.fn();
    render(
      <Drilldown.Root defaultValue={['list']} onValueChange={onValueChange}>
        <Drilldown.Viewport>
          <Drilldown.View value="list" label="List">
            <Drilldown.Trigger value="item" render={(props) => <a {...props} href="#item" />}>
              Item
            </Drilldown.Trigger>
            <Drilldown.Trigger value="locked" onClick={(event) => event.preventDefault()}>
              Locked
            </Drilldown.Trigger>
          </Drilldown.View>
          <Drilldown.View value="item" label="Item" />
          <Drilldown.View value="locked" label="Locked" />
        </Drilldown.Viewport>
      </Drilldown.Root>,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Locked' }));
    expect(onValueChange).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('link', { name: 'Item' }));
    expect(onValueChange).toHaveBeenCalledWith(['list', 'item'], 'push');
  });

  it("names Back from its own text, aria-label, or the strings for the view below", () => {
    render(
      <StringsProvider strings={{ backTo: (label) => `${label}(으)로 돌아가기` }}>
        <Settings defaultValue={['settings', 'account']} />
      </StringsProvider>,
    );
    expect(screen.getByRole('button', { name: 'Settings(으)로 돌아가기' })).toBeTruthy();
    cleanup();
    render(
      <Drilldown.Root defaultValue={['a', 'b']}>
        <Drilldown.Back />
        <Drilldown.Viewport>
          <Drilldown.View value="a" label="" />
          <Drilldown.View value="b" label="B" />
        </Drilldown.Viewport>
      </Drilldown.Root>,
    );
    expect(screen.getByRole('button', { name: 'Back' })).toBeTruthy();
    cleanup();
    render(
      <Drilldown.Root defaultValue={['a', 'b']}>
        <Drilldown.Back>Done</Drilldown.Back>
        <Drilldown.Back aria-label="Up one level" />
        <Drilldown.View value="a" label="A" />
        <Drilldown.View value="b" label="B" />
      </Drilldown.Root>,
    );
    expect(screen.getByRole('button', { name: 'Done' }).hasAttribute('aria-label')).toBe(false);
    expect(screen.getByRole('button', { name: 'Up one level' })).toBeTruthy();
  });

  it('names Back from text its child renders later, after Back left at the first view and came back', async () => {
    let setText: (text: string) => void = () => undefined;
    function Later() {
      const [text, set] = useState('');
      setText = set;
      return <>{text}</>;
    }
    render(
      <Drilldown.Root defaultValue={['settings']}>
        <Drilldown.Back>
          <Later />
        </Drilldown.Back>
        <Drilldown.Viewport>
          <Drilldown.View value="settings" label="Settings">
            <Drilldown.Trigger value="account">Account</Drilldown.Trigger>
          </Drilldown.View>
          <Drilldown.View value="account" label="Account" />
        </Drilldown.Viewport>
      </Drilldown.Root>,
    );
    click('Account');
    expect(screen.getByRole('button', { name: 'Back to Settings' })).toBeTruthy();
    act(() => setText('Done'));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Done' }).hasAttribute('aria-label')).toBe(false));
  });

  it('goes back on Escape outside a modal, unless escape is close or something else took the key', () => {
    const onValueChange = vi.fn();
    render(<Settings defaultValue={['settings', 'account', 'email']} onValueChange={onValueChange} />);
    const address = screen.getByRole('textbox', { name: 'Address' });
    fireEvent.keyDown(address, { key: 'Escape', isComposing: true });
    expect(onValueChange).not.toHaveBeenCalled();
    address.addEventListener('keydown', (event) => event.preventDefault(), { once: true });
    fireEvent.keyDown(address, { key: 'Escape' });
    expect(onValueChange).not.toHaveBeenCalled();
    fireEvent.keyDown(address, { key: 'Escape' });
    expect(onValueChange).toHaveBeenLastCalledWith(['settings', 'account'], 'escape');
    fireEvent.keyDown(screen.getByRole('button', { name: 'Back to Settings' }), { key: 'Escape' });
    expect(onValueChange).toHaveBeenLastCalledWith(['settings'], 'escape');
    onValueChange.mockClear();
    fireEvent.keyDown(screen.getByRole('button', { name: 'Account' }), { key: 'Escape' });
    expect(onValueChange).not.toHaveBeenCalled();
    cleanup();
    render(<Settings defaultValue={['settings', 'account']} escape="close" onValueChange={onValueChange} />);
    fireEvent.keyDown(screen.getByRole('button', { name: 'Email' }), { key: 'Escape' });
    expect(onValueChange).not.toHaveBeenCalled();
  });

  it('starts over at defaultValue when the Dialog around it closes, without a change, but keeps a controlled stack', () => {
    const onValueChange = vi.fn();
    function InDialog({ open, value }: { open: boolean; value?: readonly string[] }) {
      return (
        <Dialog.Root open={open} onOpenChange={() => undefined} aria-label="Settings dialog">
          <Settings value={value} onValueChange={onValueChange} />
        </Dialog.Root>
      );
    }
    const { rerender } = render(<InDialog open />);
    click('Account');
    expect(screen.getByTestId('title').textContent).toBe('Account');
    // jsdom has no exit motion to wait for, so the dialog leaves at once.
    vi.useFakeTimers();
    rerender(<InDialog open={false} />);
    act(() => vi.runAllTimers());
    vi.useRealTimers();
    rerender(<InDialog open />);
    expect(screen.getByTestId('title').textContent).toBe('Settings');
    expect(onValueChange).toHaveBeenCalledTimes(1);
    rerender(<InDialog open value={['settings', 'notifications']} />);
    vi.useFakeTimers();
    rerender(<InDialog open={false} value={['settings', 'notifications']} />);
    act(() => vi.runAllTimers());
    vi.useRealTimers();
    rerender(<InDialog open value={['settings', 'notifications']} />);
    expect(screen.getByTestId('title').textContent).toBe('Notifications');
  });

  it('logs an error for an empty stack, a value with no view, a value twice in the stack, and two views with one value', () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const logged = () => error.mock.calls.map(([message]) => String(message));
    render(<Drilldown.Root defaultValue={[]} />);
    expect(logged()).toEqual([expect.stringContaining('the stack is empty')]);
    cleanup();
    error.mockClear();
    render(<Settings defaultValue={['settings', 'missing']} />);
    expect(logged()).toEqual([expect.stringContaining('no Drilldown.View has the value "missing"')]);
    cleanup();
    error.mockClear();
    render(<Settings value={['settings', 'account', 'settings']} />);
    expect(logged()).toEqual([expect.stringContaining('holds a value twice')]);
    cleanup();
    error.mockClear();
    render(
      <Drilldown.Root defaultValue={['a']}>
        <Drilldown.View value="a" label="A" />
        <Drilldown.View value="a" label="Also A" />
      </Drilldown.Root>,
    );
    expect(logged()).toEqual([expect.stringContaining('two Drilldown.Views have the value "a"')]);
    cleanup();
    error.mockClear();
    render(<Settings />);
    expect(error).not.toHaveBeenCalled();
    error.mockRestore();
  });

  it('throws when a part renders outside Drilldown.Root', () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    expect(() => render(<Drilldown.Label />)).toThrow('Drilldown.Label must render inside Drilldown.Root');
    vi.restoreAllMocks();
  });
});
