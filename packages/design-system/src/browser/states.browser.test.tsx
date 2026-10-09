import { render, screen, waitFor } from '@testing-library/react';
import { cdp, userEvent } from '@vitest/browser/context';
import { useState } from 'react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { usePopover } from '../hooks/usePopover';
import {
  BottomSheet,
  Button,
  Dialog,
  Menu,
  OptionList,
  Popover,
  RadioGroup,
  Switch,
  Tabs,
  Toolbar,
} from '../index';

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
  const probe = document.createElement('div');
  probe.style.cssText = 'forced-color-adjust: none; background: Canvas';
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
        <Switch data-testid="off">Off</Switch>
        <Switch defaultChecked data-testid="on">
          On
        </Switch>
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
        <OptionList.Root value={value} onChange={setValue} aria-label="Fruit">
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
});

describe('switch in rtl', () => {
  it('moves the checked thumb toward the inline end, which is left', () => {
    render(
      <Themed dir="rtl">
        <Switch defaultChecked data-testid="on">
          On
        </Switch>
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
          <OptionList.Root value={value} onChange={setValue} aria-label="Fruit">
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

  it('keeps the active option in view as the keyboard moves it', async () => {
    render(<PopoverList />);
    const list = await screen.findByRole('listbox');
    list.focus();
    const scrollY = window.scrollY;
    await userEvent.keyboard('{End}');
    const last = screen.getByRole('option', { name: 'Fruit 30' });
    const inView = (option: Element) => {
      const surface = screen.getByTestId('surface').getBoundingClientRect();
      const rect = option.getBoundingClientRect();
      return rect.top >= surface.top - 0.5 && rect.bottom <= surface.bottom + 0.5;
    };
    await waitFor(() => expect(inView(last)).toBe(true));
    await userEvent.keyboard('{Home}');
    await waitFor(() => expect(inView(screen.getByRole('option', { name: 'Fruit 1' }))).toBe(true));
    expect(window.scrollY).toBe(scrollY);
  });

  it('never scrolls the page for a list on the page', async () => {
    function PageList() {
      const [value, setValue] = useState<string | null>(null);
      return (
        <Themed>
          <OptionList.Root value={value} onChange={setValue} aria-label="Fruit">
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
