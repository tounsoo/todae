import { render, screen } from '@testing-library/react';
import { userEvent } from '@vitest/browser/context';
import type { ReactNode } from 'react';
import { describe, expect, it } from 'vitest';
import { BottomSheet, Button, Checkbox, Pagination, Tabs } from '../index';

function Themed({ children }: { children: ReactNode }) {
  return (
    <div data-appearance="light" data-density="comfortable">
      {children}
    </div>
  );
}

function rootVar(name: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

describe('shared focus ring tokens in a browser', () => {
  it('draws Button and Tabs rings from focus.ring, inset where the tab list would clip it', async () => {
    render(
      <Themed>
        <Button.Root>Save</Button.Root>
        <Tabs.Root defaultValue="a">
          <Tabs.List aria-label="Sections">
            <Tabs.Tab value="a">Alpha</Tabs.Tab>
          </Tabs.List>
          <Tabs.Panel value="a">Alpha panel</Tabs.Panel>
        </Tabs.Root>
      </Themed>,
    );
    expect(rootVar('--todae-focus-ring-width')).toBe('2px');
    await userEvent.tab();
    const button = getComputedStyle(screen.getByRole('button', { name: 'Save' }));
    expect(button.outlineWidth).toBe('2px');
    expect(button.outlineOffset).toBe('2px');
    await userEvent.tab();
    const tab = getComputedStyle(screen.getByRole('tab', { name: 'Alpha' }));
    expect(tab.outlineWidth).toBe('2px');
    expect(tab.outlineOffset).toBe('-2px');
  });

  it('moves an inset tab ring with a wider focus.ring.width', async () => {
    render(
      <div data-appearance="light" data-density="comfortable" style={{ ['--todae-focus-ring-width' as string]: '3px' }}>
        <Tabs.Root defaultValue="a">
          <Tabs.List aria-label="Sections">
            <Tabs.Tab value="a">Alpha</Tabs.Tab>
          </Tabs.List>
          <Tabs.Panel value="a">Alpha panel</Tabs.Panel>
        </Tabs.Root>
      </div>,
    );
    await userEvent.tab();
    const tab = getComputedStyle(screen.getByRole('tab', { name: 'Alpha' }));
    expect(tab.outlineWidth).toBe('3px');
    expect(tab.outlineOffset).toBe('-3px');
  });
});

describe('disabled and hover styles in a browser', () => {
  it('greys a disabled Checkbox with the placeholder color and the not-allowed cursor', () => {
    render(
      <Themed>
        <Checkbox.Root disabled data-testid="box">
          Remember me
        </Checkbox.Root>
        <span data-testid="placeholder" style={{ color: 'var(--todae-color-fg-placeholder)' }} />
      </Themed>,
    );
    const input = screen.getByRole('checkbox');
    const root = input.closest('label') ?? input.parentElement!;
    expect(getComputedStyle(root).color).toBe(getComputedStyle(screen.getByTestId('placeholder')).color);
    expect(getComputedStyle(input).cursor).toBe('not-allowed');
  });

  it('gives Button and Pagination the same disabled color as other controls', () => {
    render(
      <Themed>
        <span data-testid="placeholder" style={{ color: 'var(--todae-color-fg-placeholder)' }} />
        <Button.Root disabled>Save</Button.Root>
        <Pagination.Root aria-label="Pages">
          <Pagination.Item>
            <button type="button" disabled>
              Next
            </button>
          </Pagination.Item>
        </Pagination.Root>
      </Themed>,
    );
    const save = getComputedStyle(screen.getByRole('button', { name: 'Save' }));
    const next = getComputedStyle(screen.getByRole('button', { name: 'Next' }));
    const placeholder = getComputedStyle(screen.getByTestId('placeholder')).color;
    expect(save.color).toBe(placeholder);
    expect(next.color).toBe(placeholder);
    expect(next.cursor).toBe('not-allowed');
  });

  it('greys the Pagination ellipsis like a disabled step, but with the default cursor', () => {
    render(
      <Themed>
        <span data-testid="placeholder" style={{ color: 'var(--todae-color-fg-placeholder)' }} />
        <Pagination.Root aria-label="Pages">
          <Pagination.Ellipsis data-testid="gap" />
        </Pagination.Root>
      </Themed>,
    );
    const gap = getComputedStyle(screen.getByTestId('gap').firstElementChild!);
    expect(gap.color).toBe(getComputedStyle(screen.getByTestId('placeholder')).color);
    expect(gap.cursor).toBe('default');
  });
});

describe('BottomSheet padding in a browser', () => {
  it('keeps the bottom padding when the screen has no safe-area inset', async () => {
    render(
      <Themed>
        <BottomSheet.Root open onOpenChange={() => undefined}>
          <BottomSheet.Header>
            <BottomSheet.Title>Sort</BottomSheet.Title>
          </BottomSheet.Header>
          <BottomSheet.Body>Newest first</BottomSheet.Body>
        </BottomSheet.Root>
      </Themed>,
    );
    const sheet = getComputedStyle(await screen.findByRole('dialog'));
    expect(parseFloat(sheet.paddingBottom)).toBeGreaterThan(0);
    expect(sheet.paddingBottom).toBe(sheet.paddingTop);
  });

  it('draws the grabber ring from focus.ring in the sheet ring color', async () => {
    render(
      // The private inputs a theme sets, above the element that resolves the tokens.
      <div style={{ ['--_todae-sheet-ring-focus' as string]: 'rgb(200, 0, 0)', ['--_todae-focus-ring-width' as string]: '3px' }}>
        <Themed>
          <BottomSheet.Root open onOpenChange={() => undefined}>
            <BottomSheet.Grabber />
            <BottomSheet.Title>Sort</BottomSheet.Title>
            <BottomSheet.Body>Newest first</BottomSheet.Body>
          </BottomSheet.Root>
        </Themed>
      </div>,
    );
    await screen.findByRole('dialog');
    const grabber = screen.getByRole('button');
    grabber.focus();
    await userEvent.tab();
    await userEvent.tab({ shift: true });
    expect(document.activeElement).toBe(grabber);
    const style = getComputedStyle(grabber);
    expect(style.outlineStyle).toBe('solid');
    expect(style.outlineWidth).toBe('3px');
    expect(style.outlineOffset).toBe('2px');
    expect(style.outlineColor).toBe('rgb(200, 0, 0)');
  });
});
