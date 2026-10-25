import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { userEvent } from '@vitest/browser/context';
import { afterEach, describe, expect, it } from 'vitest';
import { Tabs, Text, Tree } from '../index.js';

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
          <Text.Root lines={1} as="span">
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
    const phrase = 'Revenue report for the northern region, final copy';
    const textWidth = (el: HTMLElement) => {
      const range = document.createRange();
      range.selectNodeContents(el);
      return range.getBoundingClientRect().width;
    };
    const wide = (weight?: 'bold') => (
      <div style={{ inlineSize: '40rem' }}>
        <Text.Root lines={1} weight={weight} data-testid="probe">
          {phrase}
        </Text.Root>
      </div>
    );
    const probe = render(wide());
    const regularEl = screen.getByTestId('probe');
    const regularWidth = textWidth(regularEl);
    probe.rerender(wide('bold'));
    const boldEl = screen.getByTestId('probe');
    const boldWidth = textWidth(boldEl);
    probe.unmount();
    const room = Math.ceil((regularWidth + boldWidth) / 2);
    const box = (weight?: 'bold') => (
      <div style={{ inlineSize: room }}>
        <Text.Root lines={1} weight={weight} data-testid="t">
          {phrase}
        </Text.Root>
      </div>
    );
    const { rerender } = render(box());
    const el = screen.getByTestId('t');
    expect(regularWidth).toBeLessThan(boldWidth);
    expect(el.hasAttribute('data-todae-cut')).toBe(false);
    rerender(box('bold'));
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

  it("shows no child item's tip while a parent tree item has focus", async () => {
    render(
      <div style={{ inlineSize: '14rem' }}>
        <Tree.Root aria-label="Files" defaultExpanded={['src']}>
          <Tree.Item value="src">
            <Tree.Label>src</Tree.Label>
            <Tree.Group>
              <Tree.Item value="src/report">
                <Tree.Label>
                  <Text.Root as="span" lines={1} style={{ maxInlineSize: '6rem' }}>
                    {LONG}
                  </Text.Root>
                </Tree.Label>
              </Tree.Item>
            </Tree.Group>
          </Tree.Item>
        </Tree.Root>
      </div>,
    );
    await userEvent.tab();
    expect(document.activeElement?.getAttribute('aria-expanded')).toBe('true');
    await new Promise((resolve) => setTimeout(resolve, 400));
    expect(openTip()).toBeNull();
    await userEvent.keyboard('{ArrowDown}');
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

  it('releases a hover tip even when the product prevents pointer leave', async () => {
    render(
      <div style={{ inlineSize: '12rem' }}>
        <Text.Root lines={1} onPointerLeave={(event) => event.preventDefault()} data-testid="cut">
          {LONG}
        </Text.Root>
      </div>,
    );
    const cut = screen.getByTestId('cut');
    await userEvent.hover(cut);
    await waitFor(() => expect(openTip()).not.toBeNull());
    await userEvent.unhover(cut);
    await waitFor(() => expect(openTip()).toBeNull());
  });

  it('shows no tip when a click focuses a link that holds cut text', async () => {
    render(
      <div style={{ inlineSize: '12rem', paddingBlockStart: '4rem' }}>
        <a href="#report" data-testid="link" onClick={(event) => event.preventDefault()}>
          <Text.Root lines={1} as="span" data-testid="cut">
            {LONG}
          </Text.Root>
        </a>
        <button type="button" data-testid="away">
          Away
        </button>
      </div>,
    );
    await userEvent.click(screen.getByTestId('link'));
    expect(document.activeElement).toBe(screen.getByTestId('link'));
    await userEvent.hover(screen.getByTestId('away'));
    await new Promise((resolve) => setTimeout(resolve, 400));
    expect(openTip()).toBeNull();
  });

  it('shows no tip from an aria-activedescendant host, and looks past an element that cannot take focus', async () => {
    render(
      <div style={{ inlineSize: '12rem' }}>
        <div role="listbox" tabIndex={0} aria-label="Reports" aria-activedescendant="second" data-testid="list">
          <div role="option" id="first" aria-selected="false">
            <Text.Root as="span" lines={1}>
              {LONG}
            </Text.Root>
          </div>
          <div role="option" id="second" aria-selected="true">
            Second
          </div>
        </div>
        <a href="#row" data-testid="row">
          <button type="button" disabled>
            <Text.Root as="span" lines={1}>
              {`Row ${LONG}`}
            </Text.Root>
          </button>
        </a>
      </div>,
    );
    await userEvent.tab();
    expect(document.activeElement).toBe(screen.getByTestId('list'));
    await new Promise((resolve) => setTimeout(resolve, 400));
    expect(openTip()).toBeNull();
    await userEvent.tab();
    expect(document.activeElement).toBe(screen.getByTestId('row'));
    await waitFor(() => expect(openTip()?.textContent).toBe(`Row ${LONG}`));
  });

  it('shows no tip when a click focuses the text itself', async () => {
    render(
      <div style={{ inlineSize: '12rem', paddingBlockStart: '4rem' }}>
        <Text.Root lines={1} tabIndex={-1} data-testid="cut">
          {LONG}
        </Text.Root>
        <button type="button" data-testid="away">
          Away
        </button>
      </div>,
    );
    await userEvent.click(screen.getByTestId('cut'));
    expect(document.activeElement).toBe(screen.getByTestId('cut'));
    await userEvent.hover(screen.getByTestId('away'));
    await new Promise((resolve) => setTimeout(resolve, 400));
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
