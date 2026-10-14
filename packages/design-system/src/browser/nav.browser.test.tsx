import { render, screen } from '@testing-library/react';
import { cdp, userEvent } from '@vitest/browser/context';
import { describe, expect, it } from 'vitest';
import { Nav } from '../components/Nav';
import { ScrollArea } from '../components/ScrollArea';

function Docs({ dir }: { dir?: 'rtl' }) {
  return (
    <div data-appearance="light" data-density="comfortable" dir={dir}>
      <ScrollArea.Root focusable={false} style={{ inlineSize: '14rem', blockSize: '20rem' }}>
        <Nav.Root aria-label="Docs">
          <Nav.Group label="Components">
            <Nav.Item>
              <Nav.Link href="#button">Button</Nav.Link>
            </Nav.Item>
            <Nav.Item>
              <Nav.Link href="#field">Field</Nav.Link>
              <Nav.Branch label="Field pages" open>
                <Nav.Item>
                  <Nav.Link href="#select" aria-current="page">
                    Select
                  </Nav.Link>
                </Nav.Item>
              </Nav.Branch>
            </Nav.Item>
            <Nav.Item>
              <Nav.Branch label="Reports">
                <Nav.Item>
                  <Nav.Link href="#usage">Usage</Nav.Link>
                </Nav.Item>
              </Nav.Branch>
            </Nav.Item>
          </Nav.Group>
        </Nav.Root>
      </ScrollArea.Root>
    </div>
  );
}

const box = (el: Element) => el.getBoundingClientRect();

/** vitest types the session without its methods; Playwright's session has `send`. */
function emulateMedia(features: { name: string; value: string }[]) {
  return (cdp() as unknown as { send(method: string, params: object): Promise<unknown> }).send('Emulation.setEmulatedMedia', {
    features,
  });
}

const toggle = (name: string) => screen.getByText(name).closest('summary')!;

describe('Nav in a browser', () => {
  it('puts the toggle after a link at the end of its row, named by its hidden label', () => {
    render(<Docs />);
    const field = box(screen.getByRole('link', { name: 'Field' }));
    const summary = toggle('Field pages');
    const button = box(summary);
    expect(button.top).toBeCloseTo(field.top, 0);
    expect(button.bottom).toBeCloseTo(field.bottom, 0);
    expect(button.right).toBeCloseTo(field.right, 0);
    // The label is clipped to nothing on screen.
    expect(box(screen.getByText('Field pages')).width).toBeLessThanOrEqual(1);
    // A branch on its own shows its label as the row's text.
    expect(box(screen.getByText('Reports')).width).toBeGreaterThan(20);
  });

  it('mirrors the end toggle in right-to-left', () => {
    render(<Docs dir="rtl" />);
    const field = box(screen.getByRole('link', { name: 'Field' }));
    expect(box(toggle('Field pages')).left).toBeCloseTo(field.left, 0);
  });

  it('is a Tab stop per link and toggle, and opens a branch from the keyboard', async () => {
    render(<Docs />);
    await userEvent.keyboard('{Tab}');
    expect(document.activeElement).toBe(screen.getByRole('link', { name: 'Button' }));
    await userEvent.keyboard('{Tab}{Tab}');
    expect(document.activeElement).toBe(toggle('Field pages'));
    await userEvent.keyboard('{Tab}{Tab}');
    const reports = toggle('Reports');
    expect(document.activeElement).toBe(reports);
    await userEvent.keyboard('{Enter}');
    expect((reports.parentElement as HTMLDetailsElement).open).toBe(true);
  });

  it('draws the focus ring inside the row, so a narrow scroll area keeps it whole', async () => {
    render(<Docs />);
    const link = screen.getByRole('link', { name: 'Button' });
    await userEvent.keyboard('{Tab}');
    expect(document.activeElement).toBe(link);
    const style = getComputedStyle(link);
    expect(style.outlineStyle).toBe('solid');
    expect(parseFloat(style.outlineOffset)).toBe(-parseFloat(style.outlineWidth));
  });

  it('keeps the current link drawn as current under the pointer', async () => {
    render(<Docs />);
    const current = screen.getByRole('link', { name: 'Select' });
    const before = getComputedStyle(current).backgroundColor;
    expect(before).not.toBe(getComputedStyle(screen.getByRole('link', { name: 'Button' })).backgroundColor);
    await userEvent.hover(current);
    expect(getComputedStyle(current).backgroundColor).toBe(before);
  });

  it('draws the toggle on a current link in the same system colors under forced colors', async () => {
    render(
      <div data-appearance="light" data-density="comfortable">
        <Nav.Root aria-label="Docs">
          <Nav.Group>
            <Nav.Item>
              <Nav.Link href="#field" aria-current="page">
                Field
              </Nav.Link>
              <Nav.Branch label="Field pages">
                <Nav.Item>
                  <Nav.Link href="#select">Select</Nav.Link>
                </Nav.Item>
              </Nav.Branch>
            </Nav.Item>
          </Nav.Group>
        </Nav.Root>
      </div>,
    );
    await emulateMedia([{ name: 'forced-colors', value: 'active' }]);
    try {
      expect(matchMedia('(forced-colors: active)').matches).toBe(true);
      const link = screen.getByRole('link', { name: 'Field' });
      const chevron = toggle('Field pages').querySelector('[data-todae-glyph]')!;
      expect(getComputedStyle(chevron).color).toBe(getComputedStyle(link).color);
      expect(getComputedStyle(toggle('Field pages')).backgroundColor).toBe('rgba(0, 0, 0, 0)');
    } finally {
      await emulateMedia([]);
    }
  });
});
