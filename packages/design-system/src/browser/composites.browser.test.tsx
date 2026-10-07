import { render, screen, waitFor } from '@testing-library/react';
import { userEvent } from '@vitest/browser/context';
import { useState, type ReactNode } from 'react';
import { describe, expect, it } from 'vitest';
import { Button } from '../components/Button';
import { Field } from '../components/Field';
import { Label } from '../components/Label';
import { Menu } from '../components/Menu';
import { Tabs } from '../components/Tabs';
import { useField } from '../hooks/useField';
import { useRovingFocus } from '../hooks/useRovingFocus';

function Themed({ children, dir }: { children: ReactNode; dir?: 'rtl' }) {
  return (
    <div data-appearance="light" data-density="comfortable" dir={dir}>
      {children}
    </div>
  );
}

function Toolbar() {
  const roving = useRovingFocus({ orientation: 'horizontal' });
  return (
    <div role="toolbar" aria-label="Tools" {...roving.getContainerProps()}>
      {['one', 'two', 'three'].map((v) => (
        <button key={v} type="button" {...roving.getItemProps(v)}>
          {v}
        </button>
      ))}
    </div>
  );
}

describe('useRovingFocus in a browser', () => {
  it('is one Tab stop and swaps Left and Right in rtl', async () => {
    render(
      <Themed dir="rtl">
        <button type="button">before</button>
        <Toolbar />
        <button type="button">after</button>
      </Themed>,
    );
    screen.getByRole('button', { name: 'before' }).focus();
    await userEvent.tab();
    expect(document.activeElement?.textContent).toBe('one');
    await userEvent.keyboard('{ArrowLeft}');
    expect(document.activeElement?.textContent).toBe('two');
    await userEvent.keyboard('{ArrowRight}');
    expect(document.activeElement?.textContent).toBe('one');
    await userEvent.keyboard('{ArrowLeft}');
    await userEvent.tab();
    expect(document.activeElement?.textContent).toBe('after');
    await userEvent.tab({ shift: true });
    expect(document.activeElement?.textContent).toBe('two');
  });
});

describe('Tabs in a browser', () => {
  it('selects with arrow keys and shows the panel', async () => {
    render(
      <Themed>
        <Tabs.Root defaultValue="a">
          <Tabs.List aria-label="Sections">
            <Tabs.Tab value="a">Alpha</Tabs.Tab>
            <Tabs.Tab value="b">Beta</Tabs.Tab>
          </Tabs.List>
          <Tabs.Panel value="a">Alpha panel</Tabs.Panel>
          <Tabs.Panel value="b">Beta panel</Tabs.Panel>
        </Tabs.Root>
      </Themed>,
    );
    await userEvent.click(screen.getByRole('tab', { name: 'Alpha' }));
    await userEvent.keyboard('{ArrowRight}');
    expect(screen.getByRole('tab', { name: 'Beta' }).getAttribute('aria-selected')).toBe('true');
    expect(screen.getByRole('tabpanel').textContent).toBe('Beta panel');
    await userEvent.tab();
    expect(document.activeElement).toBe(screen.getByRole('tabpanel'));
  });

  it('keeps a hidden panel hidden when an unlayered consumer class sets display', () => {
    const style = document.createElement('style');
    style.textContent = '.consumer-grid { display: grid; }';
    document.head.append(style);
    try {
      render(
        <Themed>
          <Tabs.Root defaultValue="a">
            <Tabs.List aria-label="Sections">
              <Tabs.Tab value="a">Alpha</Tabs.Tab>
              <Tabs.Tab value="b">Beta</Tabs.Tab>
            </Tabs.List>
            <Tabs.Panel value="a" className="consumer-grid">
              Alpha panel
            </Tabs.Panel>
            <Tabs.Panel value="b" className="consumer-grid" data-testid="beta">
              Beta panel
            </Tabs.Panel>
          </Tabs.Root>
        </Themed>,
      );
      expect(getComputedStyle(screen.getByTestId('beta')).display).toBe('none');
      expect(getComputedStyle(screen.getByRole('tabpanel')).display).toBe('grid');
    } finally {
      style.remove();
    }
  });
});

function MenuHarness() {
  const [last, setLast] = useState('');
  return (
    <Themed>
      <Menu.Root>
        <Menu.Trigger>Actions</Menu.Trigger>
        <Menu.Content>
          <Menu.Item onSelect={() => setLast('rename')}>Rename</Menu.Item>
          <Menu.Item onSelect={() => setLast('delete')}>Delete</Menu.Item>
        </Menu.Content>
      </Menu.Root>
      <button type="button">After</button>
      <output>{last}</output>
    </Themed>
  );
}

describe('Menu in a browser', () => {
  it('stays anchored to an icon-only trigger that also shows a tooltip', async () => {
    render(
      <Themed>
        <div style={{ paddingLeft: 200, paddingTop: 100 }}>
          <Menu.Root>
            <Menu.Trigger tooltip aria-label="More actions">
              <Button.Icon>
                <svg width="16" height="16" aria-hidden="true" />
              </Button.Icon>
            </Menu.Trigger>
            <Menu.Content>
              <Menu.Item>Rename</Menu.Item>
            </Menu.Content>
          </Menu.Root>
        </div>
      </Themed>,
    );
    const trigger = screen.getByRole('button', { name: 'More actions' });
    await waitFor(() => expect(getComputedStyle(trigger).getPropertyValue('anchor-name').split(',').length).toBe(2));
    await userEvent.click(trigger);
    const menu = screen.getByRole('menu');
    await waitFor(() => expect(menu.matches(':popover-open')).toBe(true));
    const t = trigger.getBoundingClientRect();
    const m = menu.getBoundingClientRect();
    expect(Math.abs(m.left - t.left)).toBeLessThan(2);
    expect(m.top).toBeGreaterThanOrEqual(t.bottom);
  });

  it('opens in the top layer under its trigger and focuses the first item', async () => {
    render(<MenuHarness />);
    const trigger = screen.getByRole('button', { name: 'Actions' });
    await userEvent.click(trigger);
    const menu = screen.getByRole('menu');
    await waitFor(() => expect(menu.matches(':popover-open')).toBe(true));
    await waitFor(() => expect(document.activeElement?.textContent).toBe('Rename'));
    const t = trigger.getBoundingClientRect();
    const m = menu.getBoundingClientRect();
    expect(Math.abs(m.left - t.left)).toBeLessThan(2);
    expect(m.top).toBeGreaterThanOrEqual(t.bottom);
  });

  it('chooses with Enter and returns focus to the trigger', async () => {
    render(<MenuHarness />);
    const trigger = screen.getByRole('button', { name: 'Actions' });
    trigger.focus();
    await userEvent.keyboard('{ArrowDown}');
    await waitFor(() => expect(document.activeElement?.textContent).toBe('Rename'));
    await userEvent.keyboard('{ArrowDown}{Enter}');
    expect(screen.getByRole('status').textContent).toBe('delete');
    await waitFor(() => expect(document.activeElement).toBe(trigger));
    expect(screen.getByRole('menu', { hidden: true }).matches(':popover-open')).toBe(false);
  });

  it('Tab closes the menu and moves focus past the trigger', async () => {
    render(<MenuHarness />);
    await userEvent.click(screen.getByRole('button', { name: 'Actions' }));
    await waitFor(() => expect(document.activeElement?.textContent).toBe('Rename'));
    await userEvent.tab();
    await waitFor(() => expect(screen.getByRole('menu', { hidden: true }).matches(':popover-open')).toBe(false));
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'After' }));
  });

  it('Escape closes and returns focus to the trigger', async () => {
    render(<MenuHarness />);
    const trigger = screen.getByRole('button', { name: 'Actions' });
    await userEvent.click(trigger);
    await waitFor(() => expect(document.activeElement?.textContent).toBe('Rename'));
    await userEvent.keyboard('{Escape}');
    await waitFor(() => expect(document.activeElement).toBe(trigger));
  });
});

describe('Field.Select in a browser', () => {
  it('uses the customizable select and keeps the field focus ring', async () => {
    function Size() {
      const [value, setValue] = useState('m');
      return (
        <Themed>
          <Label htmlFor="size">Size</Label>
          <Field.Root id="size" data-testid="shell">
            <Field.Select value={value} onChange={(event) => setValue(event.target.value)}>
              <option value="s">Small</option>
              <option value="m">Medium</option>
            </Field.Select>
          </Field.Root>
        </Themed>
      );
    }
    render(<Size />);
    const select = screen.getByRole('combobox', { name: 'Size' }) as HTMLSelectElement;
    expect(getComputedStyle(select).appearance).toBe('base-select');
    await userEvent.tab();
    expect(document.activeElement).toBe(select);
    expect(getComputedStyle(screen.getByTestId('shell')).outlineStyle).toBe('solid');
    await userEvent.selectOptions(select, 's');
    expect(select.value).toBe('s');
  });

  it('opens a focused select on a press beside it and closes an open one', async () => {
    render(
      <Themed>
        <Label htmlFor="fruit">Fruit</Label>
        <Field.Root id="fruit" data-testid="shell">
          <Field.Icon data-testid="icon">*</Field.Icon>
          <Field.Select value="a" onValueChange={() => {}}>
            <option value="a">Apple</option>
            <option value="b">Banana</option>
          </Field.Select>
        </Field.Root>
      </Themed>,
    );
    const select = screen.getByRole('combobox', { name: 'Fruit' }) as HTMLSelectElement;
    const icon = screen.getByTestId('icon');
    await userEvent.tab();
    expect(document.activeElement).toBe(select);
    expect(select.matches(':open')).toBe(false);
    await userEvent.click(icon);
    await waitFor(() => expect(select.matches(':open')).toBe(true));
    await userEvent.click(icon);
    await waitFor(() => expect(select.matches(':open')).toBe(false));
  });

  it('keeps the shell padding beside an Icon and drops it where the select meets the edge', () => {
    render(
      <Themed>
        <Field.Root aria-label="Size" data-testid="shell">
          <Field.Icon>
            <svg width="16" height="16" aria-hidden="true" />
          </Field.Icon>
          <Field.Select value="s" onChange={() => undefined}>
            <option value="s">Small</option>
          </Field.Select>
        </Field.Root>
      </Themed>,
    );
    const shell = getComputedStyle(screen.getByTestId('shell'));
    expect(parseFloat(shell.paddingInlineStart)).toBeGreaterThan(0);
    expect(shell.paddingInlineEnd).toBe('0px');
  });

  it('draws the focus ring when focus is inside a custom control', async () => {
    function Group() {
      const field = useField();
      return (
        <div {...field.getControlProps({}, { native: false })} role="group">
          <button type="button">One</button>
        </div>
      );
    }
    render(
      <Themed>
        <Field.Root aria-label="Choice" data-testid="shell">
          <Group />
        </Field.Root>
      </Themed>,
    );
    await userEvent.tab();
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'One' }));
    expect(getComputedStyle(screen.getByTestId('shell')).outlineStyle).toBe('solid');
  });
});
