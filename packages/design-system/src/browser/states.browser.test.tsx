import { render, screen, waitFor } from '@testing-library/react';
import { cdp, userEvent } from '@vitest/browser/context';
import { useEffect, useState } from 'react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { usePopover } from '../hooks/usePopover.js';
import {
  BottomSheet,
  Button,
  Dialog,
  Field,
  Menu,
  OptionList,
  Popover,
  RadioGroup,
  Switch,
  Tabs,
  Toolbar,
} from '../index.js';

function Themed({ children, dir }: { children: React.ReactNode; dir?: 'rtl' }) {
  return (
    <main data-appearance="light" data-density="comfortable" dir={dir}>
      {children}
    </main>
  );
}

/** vitest types the session without its methods; Playwright's session has `send`. */
function emulateMedia(features: { name: string; value: string }[]) {
  return (cdp() as unknown as { send(method: string, params: object): Promise<unknown> }).send('Emulation.setEmulatedMedia', {
    features,
  });
}

function paint(element: Element, pseudo?: string): string {
  return getComputedStyle(element, pseudo).backgroundColor;
}

function canvas(): string {
  return system('Canvas');
}

function system(keyword: string): string {
  const probe = document.createElement('div');
  probe.style.cssText = `forced-color-adjust: none; background: ${keyword}`;
  document.body.append(probe);
  const color = paint(probe);
  probe.remove();
  return color;
}

/** Forced colors turn author backgrounds into Canvas, so a mark is visible only if it differs. */
function visible(element: Element, pseudo?: string): boolean {
  const color = paint(element, pseudo);
  return !/^rgba\(.*, 0\)$/.test(color) && color !== canvas();
}

describe('state in forced colors', () => {
  beforeEach(async () => {
    await emulateMedia([{ name: 'forced-colors', value: 'active' }]);
    expect(matchMedia('(forced-colors: active)').matches).toBe(true);
  });

  afterEach(async () => {
    await emulateMedia([]);
  });

  it('paints the selected tab indicator', () => {
    render(
      <Themed>
        <Tabs.Root defaultValue="a">
          <Tabs.List aria-label="Sections">
            <Tabs.Tab value="a">Alpha</Tabs.Tab>
            <Tabs.Tab value="b">Beta</Tabs.Tab>
          </Tabs.List>
          <Tabs.Panel value="a">A</Tabs.Panel>
          <Tabs.Panel value="b">B</Tabs.Panel>
        </Tabs.Root>
      </Themed>,
    );
    expect(visible(screen.getByRole('tab', { name: 'Alpha' }), '::after')).toBe(true);
  });

  it('tells a pressed toggle from an unpressed one', () => {
    render(
      <Themed>
        <Button.Root variant="secondary" pressed onPressedChange={() => undefined}>
          Bold
        </Button.Root>
        <Button.Root variant="secondary" pressed={false} onPressedChange={() => undefined}>
          Italic
        </Button.Root>
      </Themed>,
    );
    expect(paint(screen.getByRole('button', { name: 'Bold' }))).not.toBe(paint(screen.getByRole('button', { name: 'Italic' })));
  });

  it('paints the switch thumb, the on-track and the radio dot', () => {
    render(
      <Themed>
        <Switch.Root data-testid="off">Off</Switch.Root>
        <Switch.Root defaultChecked data-testid="on">
          On
        </Switch.Root>
        <RadioGroup.Root aria-label="Plan" defaultValue="free">
          <RadioGroup.Item value="free" data-testid="radio">
            Free
          </RadioGroup.Item>
        </RadioGroup.Root>
      </Themed>,
    );
    // The test id lands on the input; its indicator is the next sibling.
    const indicator = (id: string) => screen.getByTestId(id).nextElementSibling!;
    expect(visible(indicator('off'), '::after')).toBe(true);
    expect(paint(indicator('on'))).not.toBe(paint(indicator('off')));
    expect(visible(indicator('radio'), '::after')).toBe(true);
  });

  it('keeps a pressed toggle marked while hovered', async () => {
    render(
      <Themed>
        <Button.Root variant="secondary" defaultPressed>
          Bold
        </Button.Root>
        <Button.Root variant="secondary" defaultPressed={false}>
          Italic
        </Button.Root>
      </Themed>,
    );
    const bold = screen.getByRole('button', { name: 'Bold' });
    await userEvent.hover(bold);
    expect(paint(bold)).toBe(system('Highlight'));
    expect(paint(screen.getByRole('button', { name: 'Italic' }))).not.toBe(system('Highlight'));
  });

  it('forces the focus ring of a pressed toggle and a checked switch', () => {
    render(
      <Themed>
        <Button.Root variant="secondary" defaultPressed>
          Bold
        </Button.Root>
        <Button.Root variant="secondary">Plain</Button.Root>
        <Switch.Root defaultChecked data-testid="on">
          On
        </Switch.Root>
        <Switch.Root data-testid="off">Off</Switch.Root>
      </Themed>,
    );
    const ring = (element: Element) => getComputedStyle(element).outlineColor;
    const focused = (element: HTMLElement) => {
      element.focus({ focusVisible: true } as FocusOptions);
      return element;
    };
    const plain = ring(focused(screen.getByRole('button', { name: 'Plain' })));
    expect(ring(focused(screen.getByRole('button', { name: 'Bold' })))).toBe(plain);
    const off = ring(focused(screen.getByTestId('off')).nextElementSibling!);
    expect(ring(focused(screen.getByTestId('on')).nextElementSibling!)).toBe(off);
  });

  it('tells a disabled checked switch thumb from its track', () => {
    render(
      <Themed>
        <Switch.Root defaultChecked disabled data-testid="on">
          On
        </Switch.Root>
      </Themed>,
    );
    const track = screen.getByTestId('on').nextElementSibling!;
    expect(paint(track, '::after')).not.toBe(paint(track));
  });

  it('paints toolbar and menu separators', async () => {
    render(
      <Themed>
        <Toolbar.Root aria-label="Format">
          <Button.Root>Cut</Button.Root>
          <Toolbar.Separator data-testid="toolbar-sep" />
          <Button.Root>Paste</Button.Root>
        </Toolbar.Root>
        <Menu.Root defaultOpen>
          <Menu.Trigger>Actions</Menu.Trigger>
          <Menu.Content>
            <Menu.Item>Rename</Menu.Item>
            <Menu.Separator data-testid="menu-sep" />
            <Menu.Item>Delete</Menu.Item>
          </Menu.Content>
        </Menu.Root>
      </Themed>,
    );
    expect(visible(screen.getByTestId('toolbar-sep'))).toBe(true);
    expect(visible(await screen.findByTestId('menu-sep'))).toBe(true);
  });

  it('outlines the highlighted option', async () => {
    function List() {
      const [value, setValue] = useState<string | null>(null);
      return (
        <OptionList.Root value={value} onValueChange={setValue} aria-label="Fruit">
          <OptionList.Option value="apple">Apple</OptionList.Option>
          <OptionList.Option value="pear">Pear</OptionList.Option>
        </OptionList.Root>
      );
    }
    render(
      <Themed>
        <List />
      </Themed>,
    );
    screen.getByRole('listbox').focus();
    await userEvent.keyboard('{ArrowDown}');
    const pear = screen.getByRole('option', { name: 'Pear' });
    await waitFor(() => expect(pear.hasAttribute('data-highlighted')).toBe(true));
    expect(getComputedStyle(pear).outlineStyle).toBe('solid');
  });

  it('outlines the focused option of an open select', async () => {
    render(
      <Themed>
        <Field.Root>
          <Field.Select aria-label="Fruit" value="apple" onValueChange={() => undefined}>
            <option value="apple">Apple</option>
            <option value="pear">Pear</option>
          </Field.Select>
        </Field.Root>
      </Themed>,
    );
    const select = screen.getByRole('combobox', { name: 'Fruit' }) as HTMLSelectElement;
    await userEvent.tab();
    expect(document.activeElement).toBe(select);
    await userEvent.keyboard(' ');
    try {
      await waitFor(() => expect(select.matches(':open')).toBe(true));
      await userEvent.keyboard('{ArrowDown}');
      const pear = select.options[1]!;
      await waitFor(() => expect(pear.matches(':focus-visible')).toBe(true));
      expect(getComputedStyle(pear).outlineStyle).toBe('solid');
    } finally {
      if (select.matches(':open')) await userEvent.keyboard('{Escape}');
    }
  });
});

describe('elements drawn as a button', () => {
  it('give a link the button look, and an a without href the disabled one', () => {
    render(
      <Themed>
        <Button.Root variant="secondary">Button</Button.Root>
        <Button.Root variant="secondary" disabled>
          Off
        </Button.Root>
        <Button.Root variant="secondary" render={(props) => <a {...props} href="/docs" />}>
          Link
        </Button.Root>
        <Button.Root variant="secondary" render={(props) => <a {...props} />}>
          Nowhere
        </Button.Root>
      </Themed>,
    );
    const button = getComputedStyle(screen.getByRole('button', { name: 'Button' }));
    const off = getComputedStyle(screen.getByRole('button', { name: 'Off' }));
    const link = getComputedStyle(screen.getByRole('link', { name: 'Link' }));
    const nowhere = getComputedStyle(screen.getByText('Nowhere').closest('a')!);
    for (const property of ['background-color', 'color', 'border-color', 'padding', 'border-radius'] as const) {
      expect({ property, link: link.getPropertyValue(property) }).toEqual({ property, link: button.getPropertyValue(property) });
      expect({ property, nowhere: nowhere.getPropertyValue(property) }).toEqual({ property, nowhere: off.getPropertyValue(property) });
    }
    expect(link.textDecorationLine).toBe('none');
    expect(nowhere.cursor).toBe('not-allowed');
  });

  it('draw an aria-disabled button like a disabled one, also while it has focus', async () => {
    render(
      <Themed>
        <Button.Root variant="secondary" disabled>
          Off
        </Button.Root>
        <Button.Root variant="secondary" aria-disabled="true">
          Held
        </Button.Root>
      </Themed>,
    );
    const off = getComputedStyle(screen.getByRole('button', { name: 'Off' }));
    const held = screen.getByRole('button', { name: 'Held' });
    await userEvent.hover(held);
    for (const property of ['background-color', 'color', 'border-color', 'cursor'] as const) {
      expect({ property, held: getComputedStyle(held).getPropertyValue(property) }).toEqual({ property, held: off.getPropertyValue(property) });
    }
    // It keeps focus and its ring, in the disabled colors.
    held.focus();
    await userEvent.keyboard('{Shift}');
    expect(document.activeElement).toBe(held);
    expect(getComputedStyle(held).outlineStyle).toBe('solid');
    expect(getComputedStyle(held).backgroundColor).toBe(off.backgroundColor);
  });

  it('join a link into a Button.Group like the buttons around it', () => {
    render(
      <Themed>
        <Button.Group aria-label="Pages">
          <Button.Root variant="secondary">First</Button.Root>
          <Button.Root variant="secondary" render={(props) => <a {...props} href="#middle" />}>
            Middle
          </Button.Root>
          <Button.Root variant="secondary" render={(props) => <a {...props} href="#last" />}>
            Last
          </Button.Root>
        </Button.Group>
      </Themed>,
    );
    const corners = (element: Element) => {
      const style = getComputedStyle(element);
      return [style.borderStartStartRadius, style.borderStartEndRadius, style.borderEndEndRadius, style.borderEndStartRadius].map((r) => r !== '0px');
    };
    expect(corners(screen.getByRole('button', { name: 'First' }))).toEqual([true, false, false, true]);
    expect(corners(screen.getByRole('link', { name: 'Middle' }))).toEqual([false, false, false, false]);
    expect(corners(screen.getByRole('link', { name: 'Last' }))).toEqual([false, true, true, false]);
  });

  it('draw a menu item link like the other items', async () => {
    render(
      <Themed>
        <Menu.Root defaultOpen>
          <Menu.Trigger>File</Menu.Trigger>
          <Menu.Content>
            <Menu.Item>Rename</Menu.Item>
            <Menu.Item render={(props) => <a {...props} href="#docs" />}>Docs</Menu.Item>
          </Menu.Content>
        </Menu.Root>
      </Themed>,
    );
    const docs = await screen.findByRole('menuitem', { name: 'Docs' });
    const rename = getComputedStyle(screen.getByRole('menuitem', { name: 'Rename' }));
    expect(getComputedStyle(docs).textDecorationLine).toBe('none');
    expect(getComputedStyle(docs).color).toBe(rename.color);
  });
});

describe('switch in rtl', () => {
  it('moves the checked thumb toward the inline end, which is left', () => {
    render(
      <Themed dir="rtl">
        <Switch.Root defaultChecked data-testid="on">
          On
        </Switch.Root>
      </Themed>,
    );
    const track = screen.getByTestId('on').nextElementSibling!;
    // The thumb starts at the inline start (the right edge), so it must travel left.
    expect(new DOMMatrix(getComputedStyle(track, '::after').transform).m41).toBeLessThan(0);
  });
});

describe('close buttons', () => {
  it('take their name from visible text, and say Close only without it', async () => {
    render(
      <Themed>
        <Dialog.Root open onOpenChange={() => undefined} aria-label="Edit">
          <Dialog.Close>Cancel</Dialog.Close>
          <Dialog.Close>
            <Button.Icon>
              <svg width="16" height="16" aria-hidden="true" />
            </Button.Icon>
          </Dialog.Close>
        </Dialog.Root>
      </Themed>,
    );
    expect(await screen.findByRole('button', { name: 'Cancel' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Close' })).toBeTruthy();
  });

  it('do the same in a bottom sheet', async () => {
    render(
      <Themed>
        <BottomSheet.Root open onOpenChange={() => undefined} aria-label="Edit">
          <BottomSheet.Close>Cancel</BottomSheet.Close>
          <BottomSheet.Close aria-label="닫기">×</BottomSheet.Close>
        </BottomSheet.Root>
      </Themed>,
    );
    expect(await screen.findByRole('button', { name: 'Cancel' })).toBeTruthy();
    expect(screen.getByRole('button', { name: '닫기' })).toBeTruthy();
  });

  it('take a name a child renders later from its own state', async () => {
    function Later() {
      const [text, setText] = useState('');
      useEffect(() => {
        const timer = setTimeout(() => setText('Cancel'), 20);
        return () => clearTimeout(timer);
      }, []);
      return <>{text}</>;
    }
    render(
      <Themed>
        <Dialog.Root open onOpenChange={() => undefined} aria-label="Edit">
          <Dialog.Close>
            <Later />
          </Dialog.Close>
        </Dialog.Root>
      </Themed>,
    );
    expect(await screen.findByRole('button', { name: 'Close' })).toBeTruthy();
    expect(await screen.findByRole('button', { name: 'Cancel' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Close' })).toBeNull();
  });
});

describe('OptionList scrolling', () => {
  const FRUITS = Array.from({ length: 30 }, (_, i) => `Fruit ${i + 1}`);

  function PopoverList() {
    const [value, setValue] = useState<string | null>(null);
    const popover = usePopover({ defaultOpen: true });
    return (
      <Themed>
        <Button.Root {...popover.getTriggerProps()}>Pick</Button.Root>
        <Popover.Root {...popover.getPopoverProps()} data-testid="surface">
          <OptionList.Root value={value} onValueChange={setValue} aria-label="Fruit">
            {FRUITS.map((fruit) => (
              <OptionList.Option key={fruit} value={fruit}>
                {fruit}
              </OptionList.Option>
            ))}
          </OptionList.Root>
        </Popover.Root>
      </Themed>
    );
  }

  /** In view inside the surface's scrollport: within its border and padding. */
  function inView(option: Element) {
    const surface = screen.getByTestId('surface');
    const style = getComputedStyle(surface);
    const top = surface.getBoundingClientRect().top + surface.clientTop + parseFloat(style.paddingTop);
    const bottom = surface.getBoundingClientRect().top + surface.clientTop + surface.clientHeight - parseFloat(style.paddingBottom);
    const rect = option.getBoundingClientRect();
    return rect.top >= top - 0.5 && rect.bottom <= bottom + 0.5;
  }

  it('keeps the active option in view as the keyboard moves it', async () => {
    render(<PopoverList />);
    const list = await screen.findByRole('listbox');
    list.focus();
    const scrollY = window.scrollY;
    await userEvent.keyboard('{End}');
    await waitFor(() => expect(inView(screen.getByRole('option', { name: 'Fruit 30' }))).toBe(true));
    await userEvent.keyboard('{Home}');
    await waitFor(() => expect(screen.getByTestId('surface').scrollTop).toBe(0));
    expect(window.scrollY).toBe(scrollY);
  });

  it('reveals the active option when opening and moving happen together', async () => {
    function Opener() {
      const [open, setOpen] = useState(false);
      const [active, setActive] = useState<string | null>(null);
      const popover = usePopover({ open, onOpenChange: setOpen });
      return (
        <Themed>
          <Button.Root
            onClick={() => {
              setOpen(true);
              setActive('Fruit 30');
            }}
          >
            Last
          </Button.Root>
          <Popover.Root {...popover.getPopoverProps()} data-testid="surface">
            <OptionList.Root value={null} onValueChange={() => undefined} activeValue={active} aria-label="Fruit">
              {FRUITS.map((fruit) => (
                <OptionList.Option key={fruit} value={fruit}>
                  {fruit}
                </OptionList.Option>
              ))}
            </OptionList.Root>
          </Popover.Root>
        </Themed>
      );
    }
    render(<Opener />);
    await userEvent.click(screen.getByRole('button', { name: 'Last' }));
    await waitFor(() => expect(inView(screen.getByRole('option', { name: 'Fruit 30' }))).toBe(true));
  });

  it('reveals the selected option when the popover opens', async () => {
    function Selected() {
      const popover = usePopover();
      return (
        <Themed>
          <Button.Root {...popover.getTriggerProps()}>Pick</Button.Root>
          <Popover.Root {...popover.getPopoverProps()} data-testid="surface">
            <OptionList.Root value="Fruit 25" onValueChange={() => undefined} aria-label="Fruit">
              {FRUITS.map((fruit) => (
                <OptionList.Option key={fruit} value={fruit}>
                  {fruit}
                </OptionList.Option>
              ))}
            </OptionList.Root>
          </Popover.Root>
        </Themed>
      );
    }
    render(<Selected />);
    await userEvent.click(screen.getByRole('button', { name: 'Pick' }));
    await waitFor(() => expect(inView(screen.getByRole('option', { name: 'Fruit 25' }))).toBe(true));
  });

  it('does not scroll a container on mount or when options change', async () => {
    function Shell({ count }: { count: number }) {
      return (
        <Themed>
          <div data-testid="shell" style={{ height: 200, overflow: 'auto' }}>
            <div style={{ height: 1000 }} />
            <OptionList.Root value={null} onValueChange={() => undefined} activeValue={null} aria-label="Fruit">
              {FRUITS.slice(0, count).map((fruit) => (
                <OptionList.Option key={fruit} value={fruit}>
                  {fruit}
                </OptionList.Option>
              ))}
            </OptionList.Root>
          </div>
        </Themed>
      );
    }
    const { rerender } = render(<Shell count={0} />);
    rerender(<Shell count={30} />);
    await new Promise((resolve) => requestAnimationFrame(resolve));
    expect(screen.getByTestId('shell').scrollTop).toBe(0);
  });

  const frame = () => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));

  function Wrapped({ items }: { items: string[] }) {
    return (
      <>
        {items.map((item) => (
          <OptionList.Option key={item} value={item}>
            {item}
          </OptionList.Option>
        ))}
      </>
    );
  }

  it('does not scroll a container on mount when options register late', async () => {
    render(
      <Themed>
        <div data-testid="shell" style={{ height: 200, overflow: 'auto' }}>
          <div style={{ height: 1000 }} />
          <OptionList.Root value={null} onValueChange={() => undefined} activeValue="Fruit 25" aria-label="Fruit">
            <Wrapped items={FRUITS} />
          </OptionList.Root>
        </div>
      </Themed>,
    );
    await frame();
    expect(screen.getByTestId('shell').scrollTop).toBe(0);
  });

  it('does not scroll a container when the active option is filtered out and back', async () => {
    function Shell({ count }: { count: number }) {
      return (
        <Themed>
          <div data-testid="shell" style={{ height: 200, overflow: 'auto' }}>
            <div style={{ height: 1000 }} />
            <OptionList.Root value={null} onValueChange={() => undefined} activeValue="Fruit 25" aria-label="Fruit">
              <Wrapped items={FRUITS.slice(0, count)} />
            </OptionList.Root>
          </div>
        </Themed>
      );
    }
    const { rerender } = render(<Shell count={30} />);
    await frame();
    rerender(<Shell count={10} />);
    await frame();
    rerender(<Shell count={30} />);
    await frame();
    expect(screen.getByTestId('shell').scrollTop).toBe(0);
  });

  it('reveals a new active option that arrives with new options', async () => {
    const VEG = Array.from({ length: 30 }, (_, i) => `Veg ${i + 1}`);
    function Swap({ items, active }: { items: string[]; active: string }) {
      const popover = usePopover({ defaultOpen: true });
      return (
        <Themed>
          <Button.Root {...popover.getTriggerProps()}>Pick</Button.Root>
          <Popover.Root {...popover.getPopoverProps()} data-testid="surface">
            <OptionList.Root value={null} onValueChange={() => undefined} activeValue={active} aria-label="Fruit">
              <Wrapped items={items} />
            </OptionList.Root>
          </Popover.Root>
        </Themed>
      );
    }
    const { rerender } = render(<Swap items={FRUITS} active="Fruit 1" />);
    await screen.findByRole('listbox');
    await frame();
    rerender(<Swap items={VEG} active="Veg 30" />);
    await waitFor(() => expect(inView(screen.getByRole('option', { name: 'Veg 30' }))).toBe(true));
  });

  it('reveals a requested option that renders after the request', async () => {
    function Late({ items, active }: { items: string[]; active: string }) {
      const popover = usePopover({ defaultOpen: true });
      return (
        <Themed>
          <Button.Root {...popover.getTriggerProps()}>Pick</Button.Root>
          <Popover.Root {...popover.getPopoverProps()} data-testid="surface">
            <OptionList.Root value={null} onValueChange={() => undefined} activeValue={active} aria-label="Fruit">
              <Wrapped items={items} />
            </OptionList.Root>
          </Popover.Root>
        </Themed>
      );
    }
    const { rerender } = render(<Late items={FRUITS.slice(0, 20)} active="Fruit 1" />);
    await screen.findByRole('listbox');
    await frame();
    rerender(<Late items={FRUITS.slice(0, 20)} active="Fruit 30" />);
    await frame();
    rerender(<Late items={FRUITS} active="Fruit 30" />);
    await waitFor(() => expect(inView(screen.getByRole('option', { name: 'Fruit 30' }))).toBe(true));
  });

  function Driven({
    open,
    items,
    active,
    disabled,
    note,
  }: {
    open: boolean;
    items: string[];
    active: string;
    disabled?: string;
    note?: string;
  }) {
    const popover = usePopover({ open, onOpenChange: () => undefined });
    return (
      <Themed>
        <Button.Root {...popover.getTriggerProps()}>Pick</Button.Root>
        <Popover.Root {...popover.getPopoverProps()} data-testid="surface">
          <OptionList.Root value={null} onValueChange={() => undefined} activeValue={active} aria-label="Fruit" title={note}>
            {items.map((item) => (
              <OptionList.Option key={item} value={item} disabled={item === disabled}>
                {item}
              </OptionList.Option>
            ))}
          </OptionList.Root>
        </Popover.Root>
      </Themed>
    );
  }

  it('does not scroll back on a later commit after a request made while closed', async () => {
    const { rerender } = render(<Driven open={false} items={FRUITS} active="Fruit 1" />);
    await frame();
    rerender(<Driven open={false} items={FRUITS} active="Fruit 30" />);
    await frame();
    rerender(<Driven open items={FRUITS} active="Fruit 30" />);
    await waitFor(() => expect(inView(screen.getByRole('option', { name: 'Fruit 30' }))).toBe(true));
    const surface = screen.getByTestId('surface');
    surface.scrollTop = 0;
    await frame();
    rerender(<Driven open items={FRUITS} active="Fruit 30" note="refreshed" />);
    await frame();
    expect(surface.scrollTop).toBe(0);
  });

  it('does not scroll when an awaited option arrives disabled', async () => {
    const { rerender } = render(<Driven open items={FRUITS.slice(0, 20)} active="Fruit 1" />);
    await screen.findByRole('listbox');
    await frame();
    rerender(<Driven open items={FRUITS.slice(0, 20)} active="Fruit 30" />);
    await frame();
    const surface = screen.getByTestId('surface');
    surface.scrollTop = surface.scrollHeight;
    await frame();
    const scrolled = surface.scrollTop;
    expect(scrolled).toBeGreaterThan(0);
    rerender(<Driven open items={FRUITS} active="Fruit 30" disabled="Fruit 30" />);
    await frame();
    const first = screen.getByRole('option', { name: 'Fruit 1' });
    expect(screen.getByRole('listbox').getAttribute('aria-activedescendant')).toBe(first.id);
    expect(surface.scrollTop).toBe(scrolled);
  });

  it('reveals an option requested while closed that renders after opening', async () => {
    const { rerender } = render(<Driven open={false} items={FRUITS.slice(0, 20)} active="Fruit 1" />);
    await frame();
    rerender(<Driven open={false} items={FRUITS.slice(0, 20)} active="Fruit 30" />);
    await frame();
    rerender(<Driven open items={FRUITS.slice(0, 20)} active="Fruit 30" />);
    await screen.findByRole('listbox');
    await frame();
    rerender(<Driven open items={FRUITS} active="Fruit 30" />);
    await waitFor(() => expect(inView(screen.getByRole('option', { name: 'Fruit 30' }))).toBe(true));
  });

  it('reveals the option it falls back to, not a disabled requested one', async () => {
    function Disabled({ active }: { active: string }) {
      const popover = usePopover({ defaultOpen: true });
      return (
        <Themed>
          <Button.Root {...popover.getTriggerProps()}>Pick</Button.Root>
          <Popover.Root {...popover.getPopoverProps()} data-testid="surface">
            <OptionList.Root value={null} onValueChange={() => undefined} activeValue={active} aria-label="Fruit">
              {FRUITS.map((fruit) => (
                <OptionList.Option key={fruit} value={fruit} disabled={fruit === 'Fruit 25'}>
                  {fruit}
                </OptionList.Option>
              ))}
            </OptionList.Root>
          </Popover.Root>
        </Themed>
      );
    }
    const { rerender } = render(<Disabled active="Fruit 2" />);
    await screen.findByRole('listbox');
    await frame();
    rerender(<Disabled active="Fruit 30" />);
    await waitFor(() => expect(inView(screen.getByRole('option', { name: 'Fruit 30' }))).toBe(true));
    await frame();
    rerender(<Disabled active="Fruit 25" />);
    await frame();
    const first = screen.getByRole('option', { name: 'Fruit 1' });
    expect(screen.getByRole('listbox').getAttribute('aria-activedescendant')).toBe(first.id);
    expect(inView(first)).toBe(true);
  });

  it('falls back to the first enabled new option when a disabled one is requested with new options', async () => {
    const VEG = Array.from({ length: 30 }, (_, i) => `Veg ${i + 1}`);
    function Swap({ items, active }: { items: string[]; active: string }) {
      const popover = usePopover({ defaultOpen: true });
      return (
        <Themed>
          <Button.Root {...popover.getTriggerProps()}>Pick</Button.Root>
          <Popover.Root {...popover.getPopoverProps()} data-testid="surface">
            <OptionList.Root value={null} onValueChange={() => undefined} activeValue={active} aria-label="Food">
              {items.map((item) => (
                <OptionList.Option key={item} value={item} disabled={item === 'Veg 30'}>
                  {item}
                </OptionList.Option>
              ))}
            </OptionList.Root>
          </Popover.Root>
        </Themed>
      );
    }
    const { rerender } = render(<Swap items={FRUITS} active="Fruit 1" />);
    await screen.findByRole('listbox');
    await frame();
    rerender(<Swap items={FRUITS} active="Fruit 30" />);
    await waitFor(() => expect(inView(screen.getByRole('option', { name: 'Fruit 30' }))).toBe(true));
    rerender(<Swap items={VEG} active="Veg 30" />);
    await frame();
    const first = screen.getByRole('option', { name: 'Veg 1' });
    expect(screen.getByRole('listbox').getAttribute('aria-activedescendant')).toBe(first.id);
    expect(inView(first)).toBe(true);
  });

  it('keeps a percentage scroll-padding below the active option', async () => {
    function Padded() {
      const [value, setValue] = useState<string | null>(null);
      const popover = usePopover({ defaultOpen: true });
      return (
        <Themed>
          <Button.Root {...popover.getTriggerProps()}>Pick</Button.Root>
          <Popover.Root {...popover.getPopoverProps()} data-testid="surface" style={{ scrollPaddingBlock: '25%' }}>
            <OptionList.Root value={value} onValueChange={setValue} aria-label="Fruit">
              <Wrapped items={FRUITS} />
            </OptionList.Root>
          </Popover.Root>
        </Themed>
      );
    }
    render(<Padded />);
    const list = await screen.findByRole('listbox');
    list.focus();
    for (let i = 0; i < 12; i++) await userEvent.keyboard('{ArrowDown}');
    await frame();
    const surface = screen.getByTestId('surface');
    const option = surface.querySelector('[data-highlighted]')!;
    const bottom = surface.getBoundingClientRect().top + surface.clientTop + surface.clientHeight - parseFloat(getComputedStyle(surface).paddingBottom);
    expect(bottom - option.getBoundingClientRect().bottom).toBeGreaterThanOrEqual(surface.clientHeight * 0.25 - 1);
  });

  it('never scrolls the page for a list on the page', async () => {
    function PageList() {
      const [value, setValue] = useState<string | null>(null);
      return (
        <Themed>
          <OptionList.Root value={value} onValueChange={setValue} aria-label="Fruit">
            {FRUITS.map((fruit) => (
              <OptionList.Option key={fruit} value={fruit}>
                {fruit}
              </OptionList.Option>
            ))}
          </OptionList.Root>
        </Themed>
      );
    }
    render(<PageList />);
    window.scrollTo(0, 0);
    screen.getByRole('listbox').focus({ preventScroll: true });
    await userEvent.keyboard('{End}');
    expect(document.scrollingElement!.scrollTop).toBe(0);
  });
});
