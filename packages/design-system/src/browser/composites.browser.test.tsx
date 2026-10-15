import { render, screen, waitFor } from '@testing-library/react';
import { userEvent } from '@vitest/browser/context';
import { useState, type ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { Button } from '../components/Button';
import { Calendar } from '../components/Calendar';
import { Field } from '../components/Field';
import { formatDate, parseDate } from '../components/dateText';
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
});

describe('Field.Select in a browser', () => {
  it('uses the customizable select and keeps the field focus ring', async () => {
    function Size() {
      const [value, setValue] = useState('m');
      return (
        <Themed>
          <Label.Root htmlFor="size">Size</Label.Root>
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
        <Label.Root htmlFor="fruit">Fruit</Label.Root>
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

describe('Field.ColorPicker in a browser', () => {
  function Accent({
    disabled,
    affix = true,
    name,
    onClick,
  }: {
    disabled?: boolean;
    affix?: boolean;
    name?: string;
    onClick?: () => void;
  }) {
    const [value, setValue] = useState('#3366ff');
    return (
      <Themed>
        <Label.Root htmlFor="accent">Accent</Label.Root>
        <Field.Root id="accent" name={name} disabled={disabled} onClick={onClick} data-testid="shell">
          <Field.ColorPicker value={value} onValueChange={setValue} />
          {affix ? <Field.Affix data-testid="value">{value}</Field.Affix> : null}
        </Field.Root>
      </Themed>
    );
  }

  it('is a labelled button drawn as a square swatch one field line tall', async () => {
    render(<Accent />);
    const button = screen.getByRole('button', { name: 'Accent' });
    expect(button.getAttribute('aria-haspopup')).toBe('dialog');
    const swatch = button.getBoundingClientRect();
    expect(swatch.width).toBe(swatch.height);
    expect(swatch.height).toBeCloseTo(screen.getByTestId('value').getBoundingClientRect().height, 0);
    expect(getComputedStyle(button).backgroundColor).toBe('rgb(51, 102, 255)');
    await userEvent.tab();
    expect(document.activeElement).toBe(button);
    expect(getComputedStyle(screen.getByTestId('shell')).outlineStyle).toBe('solid');
    // The shell's ring is the only one.
    expect(getComputedStyle(button).outlineStyle).toBe('none');
  });

  it('opens the picker, reports a picked color, and closes on Escape back to the button', async () => {
    render(<Accent />);
    const button = screen.getByRole('button', { name: 'Accent' });
    await userEvent.click(button);
    const dialog = await screen.findByRole('dialog', { name: 'Color picker' });
    await waitFor(() => expect(dialog.matches(':popover-open')).toBe(true));
    expect(button.getAttribute('aria-expanded')).toBe('true');
    expect(button.getAttribute('aria-controls')).toBe(dialog.id);
    // With no element of its own to focus, the picker focuses its first tabbable.
    await waitFor(() => expect(document.activeElement).toBe(screen.getByRole('slider', { name: 'Saturation' })));
    const hue = screen.getByRole('slider', { name: 'Hue' });
    hue.focus();
    await userEvent.keyboard('{Home}');
    expect(screen.getByTestId('value').textContent).toBe('#ff3333');
    await userEvent.keyboard('{Escape}');
    await waitFor(() => expect(dialog.matches(':popover-open')).toBe(false));
    expect(document.activeElement).toBe(button);
    expect(button.hasAttribute('aria-controls')).toBe(false);
  });

  it('picks saturation and brightness from a press in the area', async () => {
    render(<Accent />);
    await userEvent.click(screen.getByRole('button', { name: 'Accent' }));
    const area = screen.getByRole('slider', { name: 'Saturation' }).parentElement!;
    await waitFor(() => expect(area.getBoundingClientRect().width).toBeGreaterThan(0));
    const rect = area.getBoundingClientRect();
    area.dispatchEvent(
      new PointerEvent('pointerdown', { bubbles: true, button: 0, pointerId: 1, clientX: rect.left + 1, clientY: rect.top + 1 }),
    );
    // The top-left corner is white: no saturation, full brightness.
    await waitFor(() => expect(screen.getByTestId('value').textContent).toMatch(/^#f[a-f0-9]f[a-f0-9]f[a-f0-9]$/));
    expect(document.activeElement).toBe(screen.getByRole('slider', { name: 'Saturation' }));
  });

  it('opens its picker on a press elsewhere in the field', async () => {
    render(<Accent />);
    const button = screen.getByRole('button', { name: 'Accent' });
    await userEvent.click(screen.getByTestId('value'));
    await waitFor(() => expect(button.getAttribute('aria-expanded')).toBe('true'));
    // The open picker takes focus, as a dialog does.
    expect(screen.getByRole('dialog', { name: 'Color picker' }).contains(document.activeElement)).toBe(true);
  });

  it('closes on a second press in the field or on the label, running the shell handler once a press', async () => {
    const onClick = vi.fn();
    render(<Accent onClick={onClick} />);
    const button = screen.getByRole('button', { name: 'Accent' });
    await userEvent.click(screen.getByTestId('value'));
    await waitFor(() => expect(button.getAttribute('aria-expanded')).toBe('true'));
    expect(onClick).toHaveBeenCalledTimes(1);
    await userEvent.click(screen.getByTestId('value'));
    await waitFor(() => expect(button.getAttribute('aria-expanded')).toBe('false'));
    expect(onClick).toHaveBeenCalledTimes(2);
    expect(screen.queryByRole('dialog')).toBeNull();
    await userEvent.click(button);
    await waitFor(() => expect(button.getAttribute('aria-expanded')).toBe('true'));
    await userEvent.click(screen.getByText('Accent'));
    await waitFor(() => expect(button.getAttribute('aria-expanded')).toBe('false'));
  });

  it('keeps focus in the picker on a press between its parts', async () => {
    render(<Accent />);
    await userEvent.click(screen.getByRole('button', { name: 'Accent' }));
    const hue = screen.getByRole('slider', { name: 'Hue' });
    hue.focus();
    const group = screen.getByRole('group');
    group.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true, button: 0 }));
    expect(document.activeElement).toBe(hue);
  });

  it('sends its value with a form under the field name', () => {
    render(
      <form data-testid="form">
        <Accent name="accent" />
      </form>,
    );
    const form = screen.getByTestId('form') as HTMLFormElement;
    expect([...new FormData(form).entries()]).toEqual([['accent', '#3366ff']]);
  });

  it('sends its value with the form its form attribute names', () => {
    render(
      <>
        <form id="other" data-testid="other" />
        <Themed>
          <Field.Root aria-label="Accent" name="accent">
            <Field.ColorPicker value="#3366ff" form="other" />
          </Field.Root>
        </Themed>
      </>,
    );
    const form = screen.getByTestId('other') as HTMLFormElement;
    expect([...new FormData(form).entries()]).toEqual([['accent', '#3366ff']]);
  });

  it('reports a close for disabling once, to an owner that keeps it open', async () => {
    const spy = vi.fn();
    function Vetoing({ disabled, note }: { disabled?: boolean; note?: string }) {
      return (
        <Themed>
          <Field.Root aria-label="Accent" disabled={disabled} data-note={note}>
            <Field.ColorPicker value="#3366ff" open onOpenChange={(open, reason) => spy(open, reason)} />
          </Field.Root>
        </Themed>
      );
    }
    const { rerender } = render(<Vetoing />);
    await screen.findByRole('dialog', { name: 'Color picker' });
    rerender(<Vetoing disabled />);
    rerender(<Vetoing disabled note="again" />);
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(spy.mock.calls).toEqual([[false, 'disabled']]);
  });

  it('closes an open picker when the field is disabled, and keeps it closed when enabled again', async () => {
    const onOpenChange = vi.fn();
    function Toggled({ disabled }: { disabled?: boolean }) {
      return (
        <Themed>
          <button type="button">before</button>
          <Field.Root aria-label="Accent" disabled={disabled}>
            <Field.ColorPicker value="#3366ff" onOpenChange={onOpenChange} />
          </Field.Root>
        </Themed>
      );
    }
    const { rerender } = render(<Toggled />);
    await userEvent.click(screen.getByRole('button', { name: 'Accent' }));
    await screen.findByRole('dialog', { name: 'Color picker' });
    rerender(<Toggled disabled />);
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(onOpenChange).toHaveBeenLastCalledWith(false, 'disabled');
    const before = screen.getByRole('button', { name: 'before' });
    before.focus();
    rerender(<Toggled />);
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(screen.getByRole('button', { name: 'Accent' }).getAttribute('aria-expanded')).toBe('false');
    expect(document.activeElement).toBe(before);
  });

  function WithText({ swatchFirst = true }: { swatchFirst?: boolean }) {
    const [color, setColor] = useState('#3366ff');
    const [text, setText] = useState(color);
    const swatch = (
      <Field.ColorPicker
        value={color}
        onValueChange={(next) => {
          setColor(next);
          setText(next);
        }}
      />
    );
    return (
      <Themed>
        <form data-testid="form">
          <Label.Root htmlFor="hex">Accent</Label.Root>
          <Field.Root id="hex" name="accent" data-testid="shell">
            {swatchFirst ? swatch : null}
            <Field.TextInput
              value={text}
              onChange={() => undefined}
              onValueChange={setText}
            />
            {swatchFirst ? null : swatch}
            <Field.Affix data-testid="affix">hex</Field.Affix>
          </Field.Root>
        </form>
      </Themed>
    );
  }

  for (const swatchFirst of [true, false]) {
    it(`leaves the field to a text input beside it (swatch ${swatchFirst ? 'first' : 'last'})`, async () => {
      render(<WithText swatchFirst={swatchFirst} />);
      const input = screen.getByRole('textbox', { name: 'Accent' });
      const button = screen.getByRole('button', { name: 'Color picker' });
      expect(input.id).toBe('hex');
      expect(button.id).toBe('');
      expect(document.querySelectorAll('#hex')).toHaveLength(1);
      expect([...new FormData(screen.getByTestId('form') as HTMLFormElement).entries()]).toEqual([['accent', '#3366ff']]);
      // A press elsewhere in the field focuses the input and opens nothing.
      await userEvent.click(screen.getByTestId('affix'));
      expect(document.activeElement).toBe(input);
      expect(button.getAttribute('aria-expanded')).toBe('false');
      // The swatch still opens the picker, and a picked color reaches the input.
      await userEvent.click(button);
      const hue = await screen.findByRole('slider', { name: 'Hue' });
      hue.focus();
      await userEvent.keyboard('{Home}');
      expect((input as HTMLInputElement).value).toBe('#ff3333');
      await userEvent.keyboard('{Escape}');
      expect(document.activeElement).toBe(button);
      expect(getComputedStyle(screen.getByTestId('shell')).outlineStyle).toBe('solid');
    });
  }

  it('is as wide as the swatch on its own, and disabled with the field', () => {
    render(<Accent affix={false} disabled />);
    const button = screen.getByRole('button', { name: 'Accent' }) as HTMLButtonElement;
    const shell = screen.getByTestId('shell');
    const style = getComputedStyle(shell);
    const inset = parseFloat(style.paddingLeft) + parseFloat(style.paddingRight) + parseFloat(style.borderLeftWidth) * 2;
    expect(shell.getBoundingClientRect().width).toBeCloseTo(button.getBoundingClientRect().width + inset, 0);
    expect(button.disabled).toBe(true);
    expect(style.cursor).toBe('not-allowed');
    expect(getComputedStyle(button).cursor).toBe('not-allowed');
  });
});

const plainDate = (text: string) => Temporal.PlainDate.from(text);

describe('Calendar in a browser', () => {
  it('swaps Left and Right in a right-to-left page', async () => {
    render(
      <Themed dir="rtl">
        <Calendar.Root aria-label="Start" locale="en-US" defaultValue={plainDate('2026-10-13')}>
          <Calendar.Header />
          <Calendar.Grid />
        </Calendar.Root>
      </Themed>,
    );
    screen.getByRole('button', { name: 'Tuesday, October 13, 2026' }).focus();
    await userEvent.keyboard('{ArrowLeft}');
    expect(document.activeElement?.getAttribute('aria-label')).toBe('Wednesday, October 14, 2026');
    await userEvent.keyboard('{ArrowRight}{ArrowRight}');
    expect(document.activeElement?.getAttribute('aria-label')).toBe('Monday, October 12, 2026');
    // The years swap them too.
    await userEvent.click(screen.getByRole('button', { name: 'October 2026' }));
    screen.getByRole('button', { name: '2026' }).focus();
    await userEvent.keyboard('{ArrowLeft}');
    expect(document.activeElement?.textContent).toBe('2027');
    await userEvent.keyboard('{ArrowRight}{ArrowRight}');
    expect(document.activeElement?.textContent).toBe('2025');
  });

  it('is one Tab stop in the grid, after the month buttons', async () => {
    render(
      <Themed>
        <Calendar.Root aria-label="Start" locale="en-US" defaultValue={plainDate('2026-10-13')}>
          <Calendar.Header />
          <Calendar.Grid />
        </Calendar.Root>
        <button type="button">after</button>
      </Themed>,
    );
    await userEvent.tab();
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Previous month' }));
    await userEvent.tab();
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'October 2026' }));
    await userEvent.tab();
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Next month' }));
    await userEvent.tab();
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Tuesday, October 13, 2026' }));
    await userEvent.tab();
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'after' }));
  });
});

describe('Field.DatePicker in a browser', () => {
  function Start({ withInput = false, onClick }: { withInput?: boolean; onClick?: () => void }) {
    const [value, setValue] = useState<Temporal.PlainDate | null>(plainDate('2026-10-13'));
    const [text, setText] = useState('10/13/2026');
    return (
      <Themed>
        <Label.Root htmlFor="start">Start</Label.Root>
        <Field.Root id="start" data-testid="shell" onClick={onClick}>
          {withInput ? (
            <Field.TextInput
              value={text}
              onChange={(event) => {
                setText(event.target.value);
                const date = parseDate(event.target.value, { locale: 'en-US' });
                if (date) setValue(date);
              }}
            />
          ) : null}
          <Field.DatePicker
            value={value}
            onValueChange={(date) => {
              setValue(date);
              setText(formatDate(date, { locale: 'en-US' }));
            }}
            locale="en-US"
            showValue={!withInput}
          />
          <Field.Affix data-testid="affix">UTC</Field.Affix>
        </Field.Root>
        <output data-testid="value">{value?.toString() ?? ''}</output>
      </Themed>
    );
  }

  it('opens a calendar on the date, picks a date from the keyboard, and returns focus to the button', async () => {
    render(<Start />);
    const button = screen.getByRole('button', { name: 'Start' });
    await userEvent.click(button);
    const dialog = await screen.findByRole('dialog', { name: 'Choose date' });
    await waitFor(() => expect(dialog.matches(':popover-open')).toBe(true));
    expect(button.getAttribute('aria-controls')).toBe(dialog.id);
    await waitFor(() =>
      expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Tuesday, October 13, 2026' })),
    );
    await userEvent.keyboard('{ArrowDown}{Enter}');
    expect(screen.getByTestId('value').textContent).toBe('2026-10-20');
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(button.getAttribute('aria-expanded')).toBe('false');
    await waitFor(() => expect(document.activeElement).toBe(button));
    expect(button.textContent).toBe('Oct 20, 2026');
  });

  it.each(['compact', 'comfortable', 'spacious'] as const)(
    'shows a six-week month whole, without scrolling, at %s density',
    async (density) => {
      render(
        <div data-appearance="light" data-density={density}>
          <Label.Root htmlFor="when">When</Label.Root>
          <Field.Root id="when">
            <Field.DatePicker value={plainDate('2022-10-21')} locale="en-US" />
          </Field.Root>
        </div>,
      );
      await userEvent.click(screen.getByRole('button', { name: 'When' }));
      const dialog = await screen.findByRole('dialog', { name: 'Choose date' });
      await waitFor(() => expect(dialog.matches(':popover-open')).toBe(true));
      // October 2022 starts on a Saturday, so it spans six weeks.
      expect(screen.getByRole('grid').querySelectorAll('tbody tr')).toHaveLength(6);
      expect(dialog.scrollHeight).toBeLessThanOrEqual(dialog.clientHeight);
    },
  );

  it('picks a year in the open calendar from the keyboard, and stays open on its month', async () => {
    render(<Start />);
    await userEvent.click(screen.getByRole('button', { name: 'Start' }));
    const dialog = await screen.findByRole('dialog', { name: 'Choose date' });
    await waitFor(() => expect(document.activeElement?.getAttribute('aria-label')).toBe('Tuesday, October 13, 2026'));
    await userEvent.keyboard('{Shift>}{Tab}{/Shift}{Shift>}{Tab}{/Shift}');
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'October 2026' }));
    await userEvent.keyboard('{Enter}');
    await userEvent.tab();
    await userEvent.tab();
    expect(document.activeElement?.textContent).toBe('2026');
    await userEvent.keyboard('{ArrowLeft}{Enter}');
    await waitFor(() => expect(document.activeElement?.getAttribute('aria-label')).toBe('Monday, October 13, 2025'));
    expect(dialog.matches(':popover-open')).toBe(true);
    expect(screen.getByTestId('value').textContent).toBe('2026-10-13');
  });

  it('closes on a pick of the date it already has', async () => {
    const onOpenChange = vi.fn();
    render(
      <Themed>
        <Field.Root aria-label="Start">
          <Field.DatePicker value={plainDate('2026-10-13')} locale="en-US" onOpenChange={onOpenChange} />
        </Field.Root>
      </Themed>,
    );
    await userEvent.click(screen.getByRole('button', { name: 'Start' }));
    await screen.findByRole('dialog');
    await waitFor(() =>
      expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Tuesday, October 13, 2026' })),
    );
    await userEvent.keyboard('{Enter}');
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(onOpenChange).toHaveBeenLastCalledWith(false, 'select');
  });

  it('closes on Escape without picking, and reports why it closed', async () => {
    const onOpenChange = vi.fn();
    render(
      <Themed>
        <Field.Root aria-label="Start">
          <Field.DatePicker value={plainDate('2026-10-13')} onOpenChange={onOpenChange} />
        </Field.Root>
      </Themed>,
    );
    const button = screen.getByRole('button', { name: 'Start' });
    await userEvent.click(button);
    await screen.findByRole('dialog');
    await userEvent.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(onOpenChange.mock.calls).toEqual([
      [true, 'trigger'],
      [false, 'escape'],
    ]);
    expect(document.activeElement).toBe(button);
  });

  it('opens on a press elsewhere in the field when it is the control', async () => {
    render(<Start />);
    await userEvent.click(screen.getByTestId('affix'));
    await screen.findByRole('dialog', { name: 'Choose date' });
  });

  it('beside a text input read with parseDate, stays in step with typing and picking', async () => {
    render(<Start withInput />);
    const input = screen.getByLabelText('Start') as HTMLInputElement;
    const button = screen.getByRole('button', { name: 'Choose date' });
    // A press elsewhere focuses the input and opens nothing.
    await userEvent.click(screen.getByTestId('affix'));
    expect(document.activeElement).toBe(input);
    expect(button.getAttribute('aria-expanded')).toBe('false');
    await userEvent.click(button);
    await screen.findByRole('dialog', { name: 'Choose date' });
    await userEvent.click(screen.getByRole('button', { name: 'Thursday, October 1, 2026' }));
    expect(input.value).toBe('10/1/2026');
    expect(screen.queryByRole('dialog')).toBeNull();
    // A typed date moves the calendar to its month.
    await userEvent.clear(input);
    await userEvent.type(input, 'Mar 2, 2027');
    await waitFor(() => expect(screen.getByTestId('value').textContent).toBe('2027-03-02'));
    await userEvent.click(button);
    await screen.findByText('March 2027');
  });

  it('draws the focus ring on the shell', async () => {
    render(<Start />);
    await userEvent.tab();
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Start' }));
    expect(getComputedStyle(screen.getByTestId('shell')).outlineStyle).toBe('solid');
  });
});
