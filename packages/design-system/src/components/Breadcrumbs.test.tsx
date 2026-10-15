import { cleanup, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { Breadcrumbs } from './Breadcrumbs.js';

afterEach(cleanup);

function Trail(props: Parameters<typeof Breadcrumbs.Root>[0]) {
  return (
    <Breadcrumbs.Root {...props}>
      <Breadcrumbs.Item>
        <a href="/">Home</a>
      </Breadcrumbs.Item>
      <Breadcrumbs.Item>
        <a href="/settings">Settings</a>
      </Breadcrumbs.Item>
      <Breadcrumbs.Item current>Billing</Breadcrumbs.Item>
    </Breadcrumbs.Root>
  );
}

describe('Breadcrumbs', () => {
  it('is a named nav landmark around an ordered list', () => {
    render(<Trail />);
    const nav = screen.getByRole('navigation', { name: 'Breadcrumb' });
    const list = within(nav).getByRole('list');
    expect(list.tagName).toBe('OL');
    expect(list.getAttribute('role')).toBe('list');
    expect(within(list).getAllByRole('listitem')).toHaveLength(3);
  });

  it('marks only the current item with aria-current="page"', () => {
    render(<Trail />);
    const current = document.querySelectorAll('[aria-current]');
    expect(current).toHaveLength(1);
    expect(current[0]?.getAttribute('aria-current')).toBe('page');
    expect(current[0]?.textContent).toBe('Billing');
  });

  it('takes a name in your language, or one from another element', () => {
    const { unmount } = render(<Trail aria-label="이동 경로" />);
    expect(screen.getByRole('navigation', { name: '이동 경로' })).toBeTruthy();
    unmount();
    render(
      <>
        <h2 id="trail">You are here</h2>
        <Trail aria-labelledby="trail" />
      </>,
    );
    const nav = screen.getByRole('navigation', { name: 'You are here' });
    expect(nav.hasAttribute('aria-label')).toBe(false);
  });

  it('sets a separator as a CSS string, escaping what CSS reads differently', () => {
    const { unmount } = render(<Trail separator="›" />);
    expect(screen.getByRole('navigation').style.getPropertyValue('--_glyph')).toBe('"›"');
    unmount();
    render(<Trail separator={'a"\\\n'} />);
    expect(screen.getByRole('navigation').style.getPropertyValue('--_glyph')).toBe('"a\\"\\\\\\a "');
  });

  it('leaves the default glyph to the stylesheet, so a CSS rule can change it', () => {
    render(<Trail />);
    expect(screen.getByRole('navigation').style.getPropertyValue('--_glyph')).toBe('');
  });

  it('keeps the default name when the label passed is empty', () => {
    render(<Trail aria-label="" />);
    expect(screen.getByRole('navigation', { name: 'Breadcrumb' })).toBeTruthy();
  });
});
