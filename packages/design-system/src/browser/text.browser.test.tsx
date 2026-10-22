import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { userEvent } from '@vitest/browser/context';
import { afterEach, describe, expect, it } from 'vitest';
import { Tabs, Text } from '../index.js';

afterEach(cleanup);

const LONG = 'Quarterly revenue report for the northern region, with every branch office and its numbers';

const openTip = () => document.querySelector<HTMLElement>('[role="tooltip"]:popover-open');

describe('Text.Root lines', () => {
  it('clamps the text to its lines and leaves text that fits alone', () => {
    render(
      <div style={{ inlineSize: '12rem' }}>
        <Text.Root lines={2} data-testid="cut">
          {LONG}
        </Text.Root>
        <Text.Root lines={2} data-testid="fits">
          Short
        </Text.Root>
      </div>,
    );
    const cut = screen.getByTestId('cut');
    const lineHeight = parseFloat(getComputedStyle(cut).lineHeight);
    expect(cut.getBoundingClientRect().height).toBeCloseTo(lineHeight * 2, 0);
    expect(cut.scrollHeight).toBeGreaterThan(cut.clientHeight);
    const fits = screen.getByTestId('fits');
    expect(fits.scrollHeight).toBe(fits.clientHeight);
  });

  it('ends a word longer than the line in the ellipsis instead of cutting it', () => {
    render(
      <div style={{ inlineSize: '8rem' }}>
        <Text.Root lines={1} data-testid="t">
          quarterly-revenue-report-northern-region-final.pdf
        </Text.Root>
      </div>,
    );
    const el = screen.getByTestId('t');
    expect(el.scrollWidth).toBe(el.clientWidth);
    expect(el.scrollHeight).toBeGreaterThan(el.clientHeight);
  });

  it('shows the full text in a tip on hover only when it is cut, hidden from assistive tech', async () => {
    render(
      <div style={{ inlineSize: '12rem' }}>
        <Text.Root lines={1} data-testid="cut">
          {LONG}
        </Text.Root>
        <Text.Root lines={1} data-testid="fits">
          Short
        </Text.Root>
      </div>,
    );
    await userEvent.hover(screen.getByTestId('fits'));
    await new Promise((resolve) => setTimeout(resolve, 600));
    expect(openTip()).toBeNull();

    const cut = screen.getByTestId('cut');
    await userEvent.hover(cut);
    await waitFor(() => expect(openTip()?.textContent).toBe(LONG));
    expect(openTip()!.getAttribute('aria-hidden')).toBe('true');
    expect(cut.hasAttribute('aria-describedby')).toBe(false);

    await userEvent.unhover(cut);
    await waitFor(() => expect(openTip()).toBeNull());
  });

  it('places the tip by the text', async () => {
    render(
      <div style={{ inlineSize: '12rem', marginBlockStart: '6rem', marginInlineStart: '4rem' }}>
        <Text.Root lines={1} data-testid="cut">
          {LONG}
        </Text.Root>
      </div>,
    );
    const cut = screen.getByTestId('cut');
    await userEvent.hover(cut);
    await waitFor(() => expect(openTip()).not.toBeNull());
    const tip = openTip()!.getBoundingClientRect();
    const text = cut.getBoundingClientRect();
    expect(tip.bottom).toBeLessThanOrEqual(text.top + 1);
    expect(text.top - tip.bottom).toBeLessThan(24);
  });

  it('shows the tip of the first cut text a focused element holds, and hides it on blur', async () => {
    render(
      <div style={{ inlineSize: '12rem' }}>
        <a href="#report" data-testid="link">
          <Text.Root lines={1} as="span">
            {LONG}
          </Text.Root>
          <Text.Root lines={1} as="span" size="s">
            {`Second ${LONG}`}
          </Text.Root>
        </a>
        <button type="button">After</button>
      </div>,
    );
    await userEvent.tab();
    expect(document.activeElement).toBe(screen.getByTestId('link'));
    await waitFor(() => expect(openTip()?.textContent).toBe(LONG));
    expect(document.querySelectorAll('[role="tooltip"]:popover-open')).toHaveLength(1);
    // The tip is not part of the link's name.
    let name = '';
    screen.getByRole('link', { name: (computed) => ((name = computed), true) });
    expect(name.replace(/\s+/g, ' ')).toBe(`${LONG} Second ${LONG}`);

    await userEvent.tab();
    await waitFor(() => expect(openTip()).toBeNull());
  });

  it('keeps a focus-held tip open when the pointer leaves', async () => {
    render(
      <div style={{ inlineSize: '12rem' }}>
        <a href="#report" data-testid="link">
          <Text.Root lines={1} as="span" data-testid="cut">
            {LONG}
          </Text.Root>
        </a>
      </div>,
    );
    const cut = screen.getByTestId('cut');
    await userEvent.hover(cut);
    await waitFor(() => expect(openTip()).not.toBeNull());
    await new Promise((resolve) => setTimeout(resolve, 50));
    await userEvent.tab();
    expect(document.activeElement).toBe(screen.getByTestId('link'));
    await userEvent.unhover(cut);
    await new Promise((resolve) => setTimeout(resolve, 400));
    expect(openTip()).not.toBeNull();
  });

  it('takes the first Escape for a tip opened by focus, as a visible tip must be dismissable', async () => {
    render(
      <div style={{ inlineSize: '12rem' }}>
        <a href="#report" data-testid="link">
          <Text.Root lines={1} as="span">
            {LONG}
          </Text.Root>
        </a>
      </div>,
    );
    await userEvent.tab();
    await waitFor(() => expect(openTip()).not.toBeNull());
    const pressed: boolean[] = [];
    window.addEventListener('keydown', (event) => pressed.push(event.defaultPrevented), { once: true });
    await userEvent.keyboard('{Escape}');
    await waitFor(() => expect(openTip()).toBeNull());
    expect(pressed).toEqual([true]);
    expect(document.activeElement).toBe(screen.getByTestId('link'));
  });

  it('measures again when a prop change cuts the text without changing its box', async () => {
    const { rerender } = render(
      <div style={{ inlineSize: '20rem' }}>
        <Text.Root lines={1} size="s" data-testid="t">
          Revenue report for the north
        </Text.Root>
      </div>,
    );
    const el = screen.getByTestId('t');
    expect(el.hasAttribute('data-todae-cut')).toBe(false);
    rerender(
      <div style={{ inlineSize: '20rem' }}>
        <Text.Root lines={1} size="2xl" data-testid="t">
          Revenue report for the north
        </Text.Root>
      </div>,
    );
    await waitFor(() => expect(el.hasAttribute('data-todae-cut')).toBe(true));
  });

  it('keeps the same element when lines comes and goes, and adds nothing after the text until the tip opens', async () => {
    const box = (lines?: number) => (
      <div style={{ inlineSize: '12rem' }} data-testid="box">
        <Text.Root lines={lines} data-testid="t">
          {LONG}
        </Text.Root>
      </div>
    );
    const { rerender } = render(box());
    const el = screen.getByTestId('t');
    rerender(box(1));
    expect(screen.getByTestId('t')).toBe(el);
    await waitFor(() => expect(el.hasAttribute('data-todae-cut')).toBe(true));
    expect(screen.getByTestId('box').childElementCount).toBe(1);
    rerender(box());
    expect(screen.getByTestId('t')).toBe(el);
    expect(el.hasAttribute('data-todae-cut')).toBe(false);
  });

  it('shows no tip when a container focused by script takes focus, and one for a tab stop', async () => {
    render(
      <div style={{ inlineSize: '12rem' }}>
        <main tabIndex={-1} data-testid="main">
          <Text.Root lines={1}>{LONG}</Text.Root>
        </main>
        <section tabIndex={0} aria-label="Report" data-testid="stop">
          <Text.Root lines={1}>{`Second ${LONG}`}</Text.Root>
        </section>
      </div>,
    );
    screen.getByTestId('main').focus();
    await new Promise((resolve) => setTimeout(resolve, 400));
    expect(openTip()).toBeNull();
    screen.getByTestId('stop').focus();
    await waitFor(() => expect(openTip()?.textContent).toBe(`Second ${LONG}`));
  });

  it('shows the tip when arrow keys bring focus to a roving item that holds cut text', async () => {
    render(
      <div style={{ inlineSize: '16rem' }}>
        <Tabs.Root defaultValue="a">
          <Tabs.List aria-label="Reports">
            <Tabs.Tab value="a">North</Tabs.Tab>
            <Tabs.Tab value="b">
              <Text.Root as="span" lines={1} style={{ maxInlineSize: '6rem' }}>
                {LONG}
              </Text.Root>
            </Tabs.Tab>
          </Tabs.List>
        </Tabs.Root>
      </div>,
    );
    await userEvent.tab();
    await userEvent.keyboard('{ArrowRight}');
    expect(document.activeElement?.textContent).toContain('Quarterly');
    await waitFor(() => expect(openTip()?.textContent).toBe(LONG));
  });

  it('opens no tip on hover when the product prevents pointer enter', async () => {
    render(
      <div style={{ inlineSize: '12rem' }}>
        <Text.Root lines={1} onPointerEnter={(event) => event.preventDefault()} data-testid="cut">
          {LONG}
        </Text.Root>
      </div>,
    );
    await userEvent.hover(screen.getByTestId('cut'));
    await new Promise((resolve) => setTimeout(resolve, 600));
    expect(openTip()).toBeNull();
  });

  it('follows a new element when as changes', async () => {
    const view = (as: 'p' | 'span') => (
      <div style={{ inlineSize: '12rem' }}>
        <Text.Root as={as} lines={1} data-testid="cut">
          {LONG}
        </Text.Root>
      </div>
    );
    const { rerender } = render(view('p'));
    rerender(view('span'));
    const cut = screen.getByTestId('cut');
    expect(cut.tagName).toBe('SPAN');
    await waitFor(() => expect(cut.hasAttribute('data-todae-cut')).toBe(true));
    await userEvent.hover(cut);
    await waitFor(() => expect(openTip()?.textContent).toBe(LONG));
  });

  it('drops the tip when the text comes to fit', async () => {
    render(
      <div style={{ inlineSize: '12rem' }} data-testid="box">
        <Text.Root lines={1} data-testid="cut">
          {LONG}
        </Text.Root>
      </div>,
    );
    const cut = screen.getByTestId('cut');
    await userEvent.hover(cut);
    await waitFor(() => expect(openTip()).not.toBeNull());
    screen.getByTestId('box').style.inlineSize = '200rem';
    await waitFor(() => expect(openTip()).toBeNull());
  });

  it('draws no tip with tooltip={false}', async () => {
    render(
      <div style={{ inlineSize: '12rem' }}>
        <Text.Root lines={1} tooltip={false} data-testid="cut">
          {LONG}
        </Text.Root>
      </div>,
    );
    await userEvent.hover(screen.getByTestId('cut'));
    await new Promise((resolve) => setTimeout(resolve, 600));
    expect(openTip()).toBeNull();
  });
});
