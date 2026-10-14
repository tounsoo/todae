import { cleanup, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { GlyphsProvider } from '../providers/GlyphsProvider';
import type { LinkRenderProps } from './Link';
import { Nav } from './Nav';

afterEach(cleanup);

function Docs({ open }: { open?: boolean }) {
  return (
    <Nav.Root aria-label="Docs">
      <Nav.Group label="Foundations">
        <Nav.Item>
          <Nav.Link href="/tokens">Tokens</Nav.Link>
        </Nav.Item>
      </Nav.Group>
      <Nav.Group label="Components">
        <Nav.Item>
          <Nav.Link href="/field">Field</Nav.Link>
          <Nav.Branch label="Field pages" open={open}>
            <Nav.Item>
              <Nav.Link href="/field/select" aria-current="page">
                Select
              </Nav.Link>
            </Nav.Item>
          </Nav.Branch>
        </Nav.Item>
      </Nav.Group>
    </Nav.Root>
  );
}

describe('Nav', () => {
  it('is a named nav landmark whose groups are lists named by their labels', () => {
    render(<Docs />);
    const nav = screen.getByRole('navigation', { name: 'Docs' });
    const foundations = within(nav).getByRole('list', { name: 'Foundations' });
    expect(within(foundations).getByRole('link', { name: 'Tokens' }).getAttribute('href')).toBe('/tokens');
    expect(within(nav).getByRole('list', { name: 'Components' })).toBeTruthy();
  });

  it('gives a group with no label a plain list', () => {
    render(
      <Nav.Root aria-label="Docs">
        <Nav.Group>
          <Nav.Item>
            <Nav.Link href="/a">A</Nav.Link>
          </Nav.Item>
        </Nav.Group>
      </Nav.Root>,
    );
    const list = screen.getByRole('list');
    expect(list.hasAttribute('aria-labelledby')).toBe(false);
    expect(list.previousElementSibling).toBeNull();
  });

  it('passes aria-current through, and hands a router every prop it would put on the a', () => {
    let received: LinkRenderProps = {};
    render(
      <Nav.Link
        href="/a"
        aria-current="page"
        className="mine"
        render={(props) => {
          received = props;
          return <a {...props} data-router="" />;
        }}
      >
        A
      </Nav.Link>,
    );
    const link = screen.getByRole('link', { name: 'A' });
    expect(link.getAttribute('aria-current')).toBe('page');
    expect(link.hasAttribute('data-router')).toBe(true);
    expect(received).toMatchObject({ href: '/a', 'aria-current': 'page', children: 'A' });
    expect(String(received.className)).toMatch(/\bmine\b/);
  });

  it('nests a branch as a disclosure whose toggle the label names', () => {
    render(<Docs open />);
    const toggle = screen.getByText('Field pages').closest('summary')!;
    const details = toggle.parentElement as HTMLDetailsElement;
    expect(details.tagName).toBe('DETAILS');
    expect(details.open).toBe(true);
    // The child pages are a list inside the details, after the toggle.
    const list = within(details).getByRole('list');
    expect(within(list).getByRole('link', { name: 'Select' })).toBeTruthy();
    expect(toggle.querySelector('[data-todae-glyph] svg')).not.toBeNull();
  });

  it('opens a branch when open turns true, as navigation into it does', () => {
    const { rerender } = render(<Docs open={false} />);
    const details = screen.getByText('Field pages').closest('details')!;
    expect(details.open).toBe(false);
    rerender(<Docs open />);
    expect(details.open).toBe(true);
  });

  it('closes a branch when open turns false, even after the user opened it', () => {
    const { rerender } = render(<Docs open />);
    const details = screen.getByText('Field pages').closest('details')!;
    rerender(<Docs open={false} />);
    expect(details.open).toBe(false);
  });

  it('names a group\'s list with aria-label, and leaves a label of true unrendered', () => {
    render(
      <Nav.Root aria-label="Docs">
        <Nav.Group aria-label="Pages" label={true as never}>
          <Nav.Item>
            <Nav.Link href="/a">A</Nav.Link>
          </Nav.Item>
        </Nav.Group>
      </Nav.Root>,
    );
    const list = screen.getByRole('list', { name: 'Pages' });
    expect(list.previousElementSibling).toBeNull();
    expect(list.parentElement?.hasAttribute('aria-label')).toBe(false);
  });

  it('draws the chevron GlyphsProvider sets', () => {
    render(
      <GlyphsProvider glyphs={{ chevron: <i data-testid="chevron" /> }}>
        <Docs />
      </GlyphsProvider>,
    );
    const glyph = screen.getByTestId('chevron');
    expect(glyph.parentElement?.hasAttribute('data-todae-glyph')).toBe(true);
    expect(glyph.parentElement?.getAttribute('aria-hidden')).toBe('true');
  });
});
