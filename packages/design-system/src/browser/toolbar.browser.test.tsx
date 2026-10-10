import { cleanup, render, screen } from '@testing-library/react';
import { userEvent } from '@vitest/browser/context';
import { afterEach, describe, expect, it } from 'vitest';
import { Button, Menu, ToggleGroup, Toolbar } from '../index';

afterEach(cleanup);

function Bar() {
  return (
    <Toolbar.Root aria-label="Format">
      <ToggleGroup.Root aria-label="Style" selectionMode="multiple" defaultValue={['bold']}>
        <ToggleGroup.Item value="bold">Bold</ToggleGroup.Item>
        <ToggleGroup.Item value="italic">Italic</ToggleGroup.Item>
      </ToggleGroup.Root>
      <Toolbar.Separator data-testid="sep" />
      <Menu.Root>
        <Menu.Trigger variant="ghost">Insert</Menu.Trigger>
        <Menu.Content>
          <Menu.Item>Image</Menu.Item>
        </Menu.Content>
      </Menu.Root>
    </Toolbar.Root>
  );
}

const button = (name: string) => screen.getByRole('button', { name });

describe('Toolbar in a browser', () => {
  it('is one tab stop, moved through with arrow keys', async () => {
    render(
      <main data-appearance="light" data-density="comfortable">
        <button type="button">Before</button>
        <Bar />
        <button type="button">After</button>
      </main>,
    );
    button('Before').focus();
    await userEvent.tab();
    expect(document.activeElement).toBe(button('Bold'));
    await userEvent.keyboard('{ArrowRight}{ArrowRight}');
    expect(document.activeElement).toBe(button('Insert'));
    await userEvent.tab();
    expect(document.activeElement).toBe(button('After'));
    await userEvent.tab({ shift: true });
    expect(document.activeElement).toBe(button('Insert'));
  });

  it('opens a menu from a trigger inside it, and keeps the menu items out of its arrow keys', async () => {
    render(<Bar />);
    button('Insert').focus();
    await userEvent.keyboard('{ArrowDown}');
    const item = await screen.findByRole('menuitem', { name: 'Image' });
    expect(document.activeElement).toBe(item);
    await userEvent.keyboard('{Escape}');
    expect(document.activeElement).toBe(button('Insert'));
  });

  it('draws the separator and marks a pressed toggle beyond its color', () => {
    render(
      <main data-appearance="light" data-density="comfortable">
        <Bar />
      </main>,
    );
    expect(screen.getByTestId('sep').getBoundingClientRect().width).toBeGreaterThan(0);
    expect(getComputedStyle(button('Bold')).boxShadow).not.toBe('none');
    expect(getComputedStyle(button('Italic')).boxShadow).toBe('none');
  });

  it('gives a text input inside its own Tab stop, both ways', async () => {
    render(
      <>
        <button type="button">Before</button>
        <Toolbar.Root aria-label="t">
          <Button.Root>A</Button.Root>
          <Button.Root>A2</Button.Root>
          <input aria-label="Size" />
          <Button.Root>B</Button.Root>
          <Button.Root>B2</Button.Root>
        </Toolbar.Root>
        <button type="button">After</button>
      </>,
    );
    const size = screen.getByRole('textbox');
    button('Before').focus();
    const forward: HTMLElement[] = [];
    for (let i = 0; i < 4; i += 1) {
      await userEvent.tab();
      forward.push(document.activeElement as HTMLElement);
    }
    expect(forward).toEqual([button('A'), size, button('B'), button('After')]);
    const back: HTMLElement[] = [];
    for (let i = 0; i < 4; i += 1) {
      await userEvent.tab({ shift: true });
      back.push(document.activeElement as HTMLElement);
    }
    // Shift+Tab back into each run returns to the item Tab last left it from.
    expect(back).toEqual([button('B'), size, button('A'), button('Before')]);
  });

  it('is one Tab stop when it mounts hidden and is shown later, or a class hides a control', async () => {
    render(
      <>
        <button type="button">Before</button>
        <div data-testid="wrap" hidden>
          <Toolbar.Root aria-label="t">
            <Button.Root>A</Button.Root>
            <Button.Root>B</Button.Root>
          </Toolbar.Root>
        </div>
        <button type="button">After</button>
      </>,
    );
    screen.getByTestId('wrap').hidden = false;
    button('A').style.display = 'none';
    button('Before').focus();
    await userEvent.tab();
    expect(document.activeElement).toBe(button('B'));
    await userEvent.tab();
    expect(document.activeElement).toBe(button('After'));
  });

  it('draws a separator nested in a group of a vertical toolbar across it', () => {
    render(
      <main data-appearance="light" data-density="comfortable">
        <Toolbar.Root aria-label="t" orientation="vertical">
          <Toolbar.Group aria-label="g">
            <Button.Root>A</Button.Root>
            <Toolbar.Separator data-testid="nested" />
            <Button.Root>B</Button.Root>
          </Toolbar.Group>
        </Toolbar.Root>
      </main>,
    );
    const rect = screen.getByTestId('nested').getBoundingClientRect();
    expect(rect.height).toBeGreaterThan(0);
    expect(rect.width).toBeGreaterThan(rect.height);
  });

  it('lets Shift+Tab leave a toggle group after the arrow keys moved focus', async () => {
    render(
      <>
        <button type="button">Before</button>
        <ToggleGroup.Root aria-label="Align" defaultValue="center">
          <ToggleGroup.Item value="left">Left</ToggleGroup.Item>
          <ToggleGroup.Item value="center">Center</ToggleGroup.Item>
          <ToggleGroup.Item value="right">Right</ToggleGroup.Item>
        </ToggleGroup.Root>
      </>,
    );
    button('Before').focus();
    await userEvent.tab();
    expect(document.activeElement).toBe(button('Center'));
    await userEvent.keyboard('{ArrowRight}');
    await userEvent.tab({ shift: true });
    expect(document.activeElement).toBe(button('Before'));
    await userEvent.tab();
    expect(document.activeElement).toBe(button('Center'));
  });

  it('keeps the colors of a pressed toggle while it has keyboard focus', async () => {
    render(
      <main data-appearance="light" data-density="comfortable">
        <button type="button">Before</button>
        <Bar />
      </main>,
    );
    const resting = getComputedStyle(button('Bold')).backgroundColor;
    button('Before').focus();
    await userEvent.tab();
    expect(document.activeElement).toBe(button('Bold'));
    expect(button('Bold').matches(':focus-visible')).toBe(true);
    expect(getComputedStyle(button('Bold')).backgroundColor).toBe(resting);
  });

  it('returns Shift+Tab from a text input to the control Tab left the run from', async () => {
    render(
      <Toolbar.Root aria-label="t">
        <Button.Root>A</Button.Root>
        <Button.Root>B</Button.Root>
        <Button.Root>C</Button.Root>
        <input aria-label="Size" />
      </Toolbar.Root>,
    );
    button('B').focus();
    await userEvent.tab();
    expect(document.activeElement).toBe(screen.getByRole('textbox'));
    await userEvent.tab({ shift: true });
    expect(document.activeElement).toBe(button('B'));
  });

  it('lets Tab reach a disclosure between its controls', async () => {
    render(
      <Toolbar.Root aria-label="t">
        <Button.Root>A</Button.Root>
        <details>
          <summary>More</summary>
        </details>
        <Button.Root>B</Button.Root>
      </Toolbar.Root>,
    );
    button('A').focus();
    await userEvent.tab();
    expect(document.activeElement).toBe(screen.getByText('More'));
    await userEvent.tab();
    expect(document.activeElement).toBe(button('B'));
  });

  it('enters on the first control the first time, from either side', async () => {
    render(
      <>
        <Toolbar.Root aria-label="t">
          <Button.Root>A</Button.Root>
          <Button.Root>B</Button.Root>
        </Toolbar.Root>
        <button type="button">After</button>
      </>,
    );
    button('After').focus();
    await userEvent.tab({ shift: true });
    expect(document.activeElement).toBe(button('A'));
  });

  it('stops Shift+Tab from an open menu on its trigger, and remembers the trigger after Tab', async () => {
    render(
      <>
        <Toolbar.Root aria-label="t">
          <Button.Root>Undo</Button.Root>
          <Menu.Root>
            <Menu.Trigger>Insert</Menu.Trigger>
            <Menu.Content>
              <Menu.Item>Image</Menu.Item>
            </Menu.Content>
          </Menu.Root>
          <Button.Root>Redo</Button.Root>
        </Toolbar.Root>
        <button type="button">After</button>
      </>,
    );
    button('Insert').focus();
    await userEvent.keyboard('{ArrowDown}');
    await screen.findByRole('menuitem', { name: 'Image' });
    await userEvent.tab({ shift: true });
    expect(document.activeElement).toBe(button('Insert'));
    await userEvent.keyboard('{ArrowDown}');
    await screen.findByRole('menuitem', { name: 'Image' });
    await userEvent.tab();
    expect(document.activeElement).toBe(button('After'));
    await userEvent.tab({ shift: true });
    expect(document.activeElement).toBe(button('Insert'));
  });
});
