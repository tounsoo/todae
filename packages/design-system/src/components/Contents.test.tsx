import { cleanup, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { StringsProvider } from '../providers/StringsProvider.js';
import { DEFAULT_STRINGS } from '../providers/strings.js';
import { Contents } from './Contents.js';
import type { LinkRenderProps } from './Link.js';

afterEach(cleanup);

describe('Contents', () => {
  it('is a nav landmark named by the contents string, holding a list with nested lists', () => {
    render(
      <Contents.Root>
        <Contents.Item>
          <Contents.Link href="#usage">Usage</Contents.Link>
          <Contents.List>
            <Contents.Item>
              <Contents.Link href="#sizes">Sizes</Contents.Link>
            </Contents.Item>
          </Contents.List>
        </Contents.Item>
      </Contents.Root>,
    );
    const nav = screen.getByRole('navigation', { name: 'On this page' });
    const [top, nested] = within(nav).getAllByRole('list');
    expect(top!.contains(nested!)).toBe(true);
    expect(within(nested!).getByRole('link', { name: 'Sizes' }).getAttribute('href')).toBe('#sizes');
  });

  it('takes its name from a visible label, aria-label, or StringsProvider', () => {
    const { rerender } = render(<Contents.Root label="In this guide" />);
    const nav = screen.getByRole('navigation', { name: 'In this guide' });
    expect(nav.hasAttribute('aria-label')).toBe(false);
    rerender(<Contents.Root label="In this guide" aria-label="Sections" />);
    expect(screen.getByRole('navigation', { name: 'In this guide' })).toBeTruthy();
    rerender(<Contents.Root aria-label="Sections" />);
    expect(screen.getByRole('navigation', { name: 'Sections' })).toBeTruthy();
    rerender(
      <StringsProvider strings={{ ...DEFAULT_STRINGS, contents: '이 페이지의 내용' }}>
        <Contents.Root />
      </StringsProvider>,
    );
    expect(screen.getByRole('navigation', { name: '이 페이지의 내용' })).toBeTruthy();
  });

  it('lets an aria-current you pass win, and hands a router every prop it would put on the a', () => {
    let received: LinkRenderProps = {};
    render(
      <Contents.Root>
        <Contents.Item>
          <Contents.Link
            href="#one"
            aria-current="false"
            render={(props) => {
              received = props;
              return <a {...props} />;
            }}
          >
            One
          </Contents.Link>
        </Contents.Item>
      </Contents.Root>,
    );
    expect(received.href).toBe('#one');
    expect(received['aria-current']).toBe('false');
    expect(typeof received.onClick).toBe('function');
  });

  it('throws when a link renders outside Contents.Root', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => render(<Contents.Link href="#a">A</Contents.Link>)).toThrow('Contents.Link must be rendered inside Contents.Root');
    vi.restoreAllMocks();
  });
});
