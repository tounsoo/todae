import { render, screen, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it } from 'vitest';
import { Alert, Breadcrumbs, Button, Checkbox, Disclosure, Field, GlyphsProvider } from '../index';

function Themed({ children }: { children: ReactNode }) {
  return (
    <main data-appearance="light" data-density="comfortable">
      {children}
    </main>
  );
}

/** An icon as a library renders one: an svg with its own size attributes. */
function LibraryIcon({ testId }: { testId?: string }) {
  return (
    <svg data-testid={testId} width="24" height="24" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M6 9l6 6 6-6" stroke="currentColor" fill="none" />
    </svg>
  );
}

const px = (el: Element, name: string) => parseFloat(getComputedStyle(el).getPropertyValue(name)) * 16;

describe('Glyphs in a browser', () => {
  it('sizes a library icon in Button.Icon to button.icon.size, and makes an icon-only button a square as tall as a labeled one', () => {
    render(
      <Themed>
        <Button.Root variant="secondary">Label</Button.Root>
        <Button.Root variant="secondary" aria-label="Settings" tooltip={false}>
          <Button.Icon>
            <LibraryIcon testId="icon" />
          </Button.Icon>
        </Button.Root>
      </Themed>,
    );
    const labeled = screen.getByRole('button', { name: 'Label' }).getBoundingClientRect();
    const button = screen.getByRole('button', { name: 'Settings' });
    const box = button.getBoundingClientRect();
    const icon = screen.getByTestId('icon').getBoundingClientRect();
    const size = px(button, '--todae-button-icon-size');
    expect(icon.width).toBeCloseTo(size, 0);
    expect(icon.height).toBeCloseTo(size, 0);
    expect(box.height).toBeCloseTo(labeled.height, 0);
    expect(box.width).toBeCloseTo(box.height, 0);
  });

  it("gives an empty Alert.Close Todae's cross, whole and centered, or the provider's icon", () => {
    const alert = (
      <Alert.Root tone="info" role="none">
        <Alert.Title>Saved</Alert.Title>
        <Alert.Close />
      </Alert.Root>
    );
    const { rerender } = render(<Themed>{alert}</Themed>);
    const close = () => screen.getByRole('button', { name: 'Dismiss' });
    const cross = close().querySelector('svg')!.getBoundingClientRect();
    const box = close().getBoundingClientRect();
    expect(cross.width).toBeGreaterThan(0);
    expect(cross.left).toBeGreaterThanOrEqual(box.left);
    expect(cross.right).toBeLessThanOrEqual(box.right);
    expect(cross.left - box.left).toBeCloseTo(box.right - cross.right, 0);
    expect(box.width).toBeCloseTo(box.height, 0);
    rerender(
      <Themed>
        <GlyphsProvider glyphs={{ close: <LibraryIcon testId="close" /> }}>{alert}</GlyphsProvider>
      </Themed>,
    );
    expect(screen.getByTestId('close').getBoundingClientRect().width).toBeCloseTo(px(close(), '--todae-button-icon-size'), 0);
  });

  it('shows the check glyph only while a checkbox is checked', async () => {
    render(
      <Themed>
        <Checkbox data-testid="box">Terms</Checkbox>
      </Themed>,
    );
    const input = screen.getByRole('checkbox');
    const check = input.parentElement!.querySelector('svg')!;
    expect(getComputedStyle(check).visibility).toBe('hidden');
    input.click();
    await waitFor(() => expect(getComputedStyle(check).visibility).toBe('visible'));
    const indicator = check.closest('[aria-hidden="true"]')!.getBoundingClientRect();
    expect(check.getBoundingClientRect().width).toBeGreaterThan(indicator.width / 2);
  });

  it('hides a text check glyph while unchecked, as it does an svg', () => {
    render(
      <Themed>
        <GlyphsProvider glyphs={{ check: '✓' }}>
          <Checkbox>Terms</Checkbox>
        </GlyphsProvider>
      </Themed>,
    );
    const glyph = screen.getByText('✓');
    expect(getComputedStyle(glyph).visibility).toBe('hidden');
  });

  it('draws the chevron over the select picker icon, inside the field, and turns it in a closed disclosure', () => {
    render(
      <Themed>
        <GlyphsProvider glyphs={{ chevron: <LibraryIcon /> }}>
          <Field.Root data-testid="field">
            <Field.Select aria-label="Plan" value="a" onValueChange={() => undefined}>
              <option value="a">Starter</option>
            </Field.Select>
          </Field.Root>
          <Disclosure.Root data-testid="closed">
            <Disclosure.Summary>More</Disclosure.Summary>
            <p>Hidden</p>
          </Disclosure.Root>
          <Disclosure.Root open data-testid="open">
            <Disclosure.Summary>Less</Disclosure.Summary>
            <p>Shown</p>
          </Disclosure.Root>
        </GlyphsProvider>
      </Themed>,
    );
    const select = screen.getByRole('combobox', { name: 'Plan' });
    const glyph = select.nextElementSibling!.querySelector('svg')!;
    const field = select.parentElement!.getBoundingClientRect();
    const chevron = glyph.getBoundingClientRect();
    expect(chevron.width).toBeCloseTo(px(select, '--todae-field-icon-size'), 0);
    expect(chevron.right).toBeLessThan(field.right);
    expect(chevron.right).toBeGreaterThan(field.right - field.width / 4);
    expect(chevron.top).toBeGreaterThan(field.top);
    expect(chevron.bottom).toBeLessThan(field.bottom);
    expect(getComputedStyle(select, '::picker-icon').visibility).toBe('hidden');
    const closed = screen.getByTestId('closed').querySelector('[data-todae-glyph]')!;
    const open = screen.getByTestId('open').querySelector('[data-todae-glyph]')!;
    expect(getComputedStyle(closed).rotate).toBe('-90deg');
    expect(getComputedStyle(open).rotate).toBe('none');
    expect(getComputedStyle(screen.getByText('More')).listStyleType).toBe('none');
  });

  it('hides the first breadcrumb separator glyph and mirrors the rest in right-to-left', () => {
    render(
      <Themed>
        <GlyphsProvider glyphs={{ separator: <LibraryIcon /> }}>
          <div dir="rtl">
            <Breadcrumbs.Root>
              <Breadcrumbs.Item>
                <a href="#a">One</a>
              </Breadcrumbs.Item>
              <Breadcrumbs.Item current>Two</Breadcrumbs.Item>
            </Breadcrumbs.Root>
          </div>
        </GlyphsProvider>
      </Themed>,
    );
    const [first, second] = [...document.querySelectorAll('nav li')].map((li) => li.querySelector('[data-todae-glyph]')!);
    expect(first!.getBoundingClientRect().width).toBe(0);
    expect(getComputedStyle(second!).scale).toBe('-1 1');
    expect(getComputedStyle(second!.closest('li')!, '::before').content).toBe('none');
  });
});
