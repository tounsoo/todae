import { render, screen, waitFor } from '@testing-library/react';
import axe from 'axe-core';
import type { ReactNode } from 'react';
import { describe, expect, it } from 'vitest';
import { Avatar, Grid } from '../index';

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

  it('reads an image that finished loading before its handlers were attached', async () => {
    // Load it once so the second element finds it complete from the cache.
    await new Promise((resolve) => {
      const warm = new Image();
      warm.onload = resolve;
      warm.src = PIXEL;
    });
    render(
      <Themed>
        <Avatar.Root data-testid="root">
          <Avatar.Image src={PIXEL} />
          <Avatar.Fallback>AL</Avatar.Fallback>
        </Avatar.Root>
      </Themed>,
    );
    await waitFor(() => expect(screen.getByTestId('root').getAttribute('data-status')).toBe('loaded'));
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
