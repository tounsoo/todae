import { render, screen, waitFor } from '@testing-library/react';
import { userEvent } from '@vitest/browser/context';
import axe from 'axe-core';
import { useState, type ReactNode } from 'react';
import { hydrateRoot } from 'react-dom/client';
import { renderToString } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { Avatar, Grid, Pagination, paginationRange } from '../index';

/** axe without its WCAG 2 contrast rule: Todae checks contrast with APCA when tokens build. */
async function violations(): Promise<string[]> {
  const result = await axe.run(document.body, { rules: { 'color-contrast': { enabled: false } } });
  return result.violations.map((v) => `${v.id}: ${v.help}\n  ${v.nodes.map((n) => n.target.join(' ')).join('\n  ')}`);
}

function Themed({ children }: { children: ReactNode }) {
  return (
    <main data-appearance="light" data-density="comfortable">
      {children}
    </main>
  );
}

const PIXEL =
  'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="8" height="8"><rect width="8" height="8" fill="red"/></svg>');

describe('Avatar in a browser', () => {
  it('shows a loaded image over the fallback space, and is one named image', async () => {
    render(
      <Themed>
        <Avatar.Root label="Ada Lovelace" data-testid="root">
          <Avatar.Image src={PIXEL} data-testid="img" />
          <Avatar.Fallback>AL</Avatar.Fallback>
        </Avatar.Root>
      </Themed>,
    );
    await waitFor(() => expect(screen.getByTestId('root').getAttribute('data-status')).toBe('loaded'));
    expect(screen.queryByText('AL')).toBeNull();
    const root = screen.getByTestId('root').getBoundingClientRect();
    const img = screen.getByTestId('img').getBoundingClientRect();
    expect(img.width).toBe(root.width);
    expect(img.height).toBe(root.height);
    expect(root.width).toBe(root.height);
    expect(getComputedStyle(screen.getByTestId('img')).visibility).toBe('visible');
    expect(await violations()).toEqual([]);
  });

  it('keeps the fallback, and hides the broken image, when it fails to load', async () => {
    render(
      <Themed>
        <Avatar.Root label="Ada Lovelace" data-testid="root">
          <Avatar.Image src="data:image/png;base64,broken" data-testid="img" />
          <Avatar.Fallback>AL</Avatar.Fallback>
        </Avatar.Root>
      </Themed>,
    );
    await waitFor(() => expect(screen.getByTestId('root').getAttribute('data-status')).toBe('error'));
    expect(screen.getByText('AL')).toBeTruthy();
    expect(getComputedStyle(screen.getByTestId('img')).visibility).toBe('hidden');
    expect(await violations()).toEqual([]);
  });

  it('reads an image that loaded before hydration, an SVG with no intrinsic size included', async () => {
    // Only a viewBox: some engines report a natural width of 0 for it.
    const viewBoxOnly =
      'data:image/svg+xml,' +
      encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 8 8"><rect width="8" height="8"/></svg>');
    const tree = (
      <Themed>
        <Avatar.Root data-testid="root">
          <Avatar.Image src={viewBoxOnly} />
          <Avatar.Fallback>AL</Avatar.Fallback>
        </Avatar.Root>
      </Themed>
    );
    const container = document.createElement('div');
    container.innerHTML = renderToString(tree);
    document.body.append(container);
    const img = container.querySelector('img')!;
    // The load event fires before React attaches its handlers, as on a server-rendered page.
    if (!img.complete) await new Promise((resolve) => img.addEventListener('load', resolve, { once: true }));
    // Before hydration the loaded image already shows over the fallback.
    expect(getComputedStyle(img).visibility).toBe('visible');
    const root = hydrateRoot(container, tree);
    try {
      await waitFor(() => expect(container.querySelector('[data-testid="root"]')!.getAttribute('data-status')).toBe('loaded'));
    } finally {
      root.unmount();
      container.remove();
    }
  });

  it('sizes from the size tokens', () => {
    render(
      <Themed>
        <Avatar.Root size="sm" data-testid="sm" />
        <Avatar.Root size="lg" data-testid="lg" />
      </Themed>,
    );
    expect(screen.getByTestId('sm').getBoundingClientRect().width).toBeLessThan(
      screen.getByTestId('lg').getBoundingClientRect().width,
    );
  });
});

describe('Grid in a browser', () => {
  it('lays out a fixed number of equal columns', () => {
    render(
      <Themed>
        <div style={{ width: 600 }}>
          <Grid columns={3} data-testid="grid">
            <div data-testid="a">A</div>
            <div data-testid="b">B</div>
            <div data-testid="c">C</div>
            <div data-testid="d">D</div>
          </Grid>
        </div>
      </Themed>,
    );
    const box = (id: string) => screen.getByTestId(id).getBoundingClientRect();
    expect(box('a').top).toBe(box('c').top);
    expect(box('d').top).toBeGreaterThan(box('a').top);
    expect(box('d').left).toBe(box('a').left);
    expect(box('a').width).toBe(box('b').width);
  });

  it('fits as many columns as the width allows, and never overflows a narrow container', () => {
    render(
      <Themed>
        <div style={{ width: 400 }}>
          <Grid minItemSize="150px" data-testid="wide">
            <div data-testid="w1">1</div>
            <div data-testid="w2">2</div>
            <div data-testid="w3">3</div>
          </Grid>
        </div>
        <div style={{ width: 100 }}>
          <Grid minItemSize="150px" data-testid="narrow">
            <div data-testid="n1">1</div>
          </Grid>
        </div>
      </Themed>,
    );
    const box = (id: string) => screen.getByTestId(id).getBoundingClientRect();
    expect(box('w1').top).toBe(box('w2').top);
    expect(box('w3').top).toBeGreaterThan(box('w1').top);
    expect(box('n1').width).toBeLessThanOrEqual(100);
  });
});

describe('Pagination in a browser', () => {
  function Pages({ initial = 10 }: { initial?: number }) {
    const [page, setPage] = useState(initial);
    const count = 20;
    const step = (to: number, label: string, id: string) => (
      <Pagination.Item>
        <button
          type="button"
          data-testid={id}
          aria-disabled={to < 1 || to > count ? true : undefined}
          onClick={() => to >= 1 && to <= count && setPage(to)}
        >
          {label}
        </button>
      </Pagination.Item>
    );
    return (
      <Themed>
        <Pagination.Root>
          {step(page - 1, 'Previous', 'prev')}
          {paginationRange({ page, count }).map((item) =>
            typeof item === 'number' ? (
              <Pagination.Item key={item}>
                <button
                  type="button"
                  data-testid={`page-${item}`}
                  aria-current={item === page ? 'page' : undefined}
                  onClick={() => setPage(item)}
                >
                  {item}
                </button>
              </Pagination.Item>
            ) : (
              <Pagination.Ellipsis key={item} />
            ),
          )}
          {step(page + 1, 'Next', 'next')}
        </Pagination.Root>
      </Themed>
    );
  }

  it('fills the current page, drops the link underline, mutes a step with nowhere to go, and passes axe', async () => {
    render(
      <Themed>
        <Pagination.Root>
          <Pagination.Item>
            <a role="link" aria-disabled="true" data-testid="prev">
              Previous
            </a>
          </Pagination.Item>
          <Pagination.Item>
            <a href="#page-1" data-testid="page-1">
              1
            </a>
          </Pagination.Item>
          <Pagination.Item>
            <a href="#page-2" aria-current="page" data-testid="page-2">
              2
            </a>
          </Pagination.Item>
          <Pagination.Ellipsis />
        </Pagination.Root>
      </Themed>,
    );
    const style = (id: string) => getComputedStyle(screen.getByTestId(id));
    expect(style('page-1').textDecorationLine).toBe('none');
    expect(style('page-2').backgroundColor).not.toBe(style('page-1').backgroundColor);
    expect(style('prev').color).not.toBe(style('page-1').color);
    expect(await violations()).toEqual([]);
  });

  it('draws a current page without href as current, not muted', () => {
    render(
      <Themed>
        <Pagination.Root>
          <Pagination.Item>
            <a href="#page-1" aria-current="page" data-testid="linked">
              1
            </a>
          </Pagination.Item>
          <Pagination.Item>
            <a aria-current="page" data-testid="plain">
              2
            </a>
          </Pagination.Item>
        </Pagination.Root>
      </Themed>,
    );
    const linked = getComputedStyle(screen.getByTestId('linked'));
    const plain = getComputedStyle(screen.getByTestId('plain'));
    expect(plain.color).toBe(linked.color);
    expect(plain.backgroundColor).toBe(linked.backgroundColor);
    expect(plain.cursor).not.toBe('default');
  });

  it('keeps focus on the control the user pressed, at the ends too', async () => {
    render(<Pages initial={2} />);
    await userEvent.click(screen.getByTestId('page-3'));
    expect(document.activeElement).toBe(screen.getByTestId('page-3'));
    expect(screen.getByTestId('page-3').getAttribute('aria-current')).toBe('page');
    await userEvent.click(screen.getByTestId('prev'));
    await userEvent.click(screen.getByTestId('prev'));
    expect(document.activeElement).toBe(screen.getByTestId('prev'));
    expect(screen.getByTestId('prev').getAttribute('aria-disabled')).toBe('true');
    // The current page keeps its fill under the pointer.
    const fill = getComputedStyle(screen.getByTestId('page-1')).backgroundColor;
    await userEvent.hover(screen.getByTestId('page-1'));
    expect(getComputedStyle(screen.getByTestId('page-1')).backgroundColor).toBe(fill);
    expect(await violations()).toEqual([]);
  });
});
