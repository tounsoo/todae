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

  it('follows right-to-left text for Left and Right', async () => {
    render(
      <div dir="rtl">
        <Bar />
      </div>,
    );
    button('Bold').focus();
    await userEvent.keyboard('{ArrowLeft}');
    expect(document.activeElement).toBe(button('Italic'));
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

  it('moves the tab stop off a control a class hides', async () => {
    render(
      <Toolbar.Root aria-label="t">
        <Button.Root>A</Button.Root>
        <Button.Root>B</Button.Root>
      </Toolbar.Root>,
    );
    expect(button('A').tabIndex).toBe(0);
    button('A').style.display = 'none';
    await expect.poll(() => button('B').tabIndex).toBe(0);
  });
});
