import { cleanup, render, screen, waitFor } from '@testing-library/react';
import axe from 'axe-core';
import { useState, type CSSProperties } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { Contents, type LinkRenderProps } from '../index.js';

afterEach(() => {
  cleanup();
  window.scrollTo(0, 0);
  history.replaceState(null, '', location.pathname + location.search);
});

const LINE = 40;

/** A page that scrolls in its own box, with a short last section. */
type PageProps = {
  dir?: 'rtl';
  list?: boolean;
  /** Adds a link to another page. */
  extra?: boolean;
  /** Adds a link to a section the page lacks, which changes the followed ids. */
  more?: boolean;
  /** Renders the links through a router-like render that drops the ref. */
  refless?: boolean;
  scroller?: CSSProperties;
};

const RefLess = ({ ref: _ref, ...props }: LinkRenderProps) => <a {...props} />;

function Page({ dir, list = true, extra = false, more = false, refless = false, scroller }: PageProps) {
  const render = refless ? RefLess : undefined;
  const tall = { blockSize: '400px', margin: 0 };
  return (
    <div data-appearance="light" data-density="comfortable" dir={dir} style={{ display: 'flex', gap: '1rem' }}>
      {list ? (
        <Contents.Root label="On this page" style={{ inlineSize: '12rem' }}>
          <Contents.Item>
            <Contents.Link href="#one" render={render}>
              One
            </Contents.Link>
          </Contents.Item>
          <Contents.Item>
            <Contents.Link href="#two" render={render}>
              Two
            </Contents.Link>
            <Contents.List>
              <Contents.Item>
                <Contents.Link href="#two-a" render={render}>
                  Two A
                </Contents.Link>
              </Contents.Item>
            </Contents.List>
          </Contents.Item>
          <Contents.Item>
            <Contents.Link href="#three" render={render}>
              Three
            </Contents.Link>
          </Contents.Item>
          {more ? (
            <Contents.Item>
              <Contents.Link href="#nowhere">Nowhere</Contents.Link>
            </Contents.Item>
          ) : null}
          {extra ? (
            <Contents.Item>
              <Contents.Link href="/elsewhere#two">Elsewhere</Contents.Link>
            </Contents.Item>
          ) : null}
        </Contents.Root>
      ) : null}
      <div
        data-testid="scroller"
        style={{
          overflowY: 'auto',
          blockSize: '300px',
          inlineSize: '20rem',
          scrollPaddingBlockStart: `${LINE}px`,
          ...scroller,
        }}
      >
        <h2 id="one" style={{ margin: 0 }}>
          One
        </h2>
        <p style={tall}>…</p>
        <h2 id="two" style={{ margin: 0 }}>
          Two
        </h2>
        <p style={tall}>…</p>
        <h3 id="two-a" style={{ margin: 0, scrollMarginBlockStart: '20px' }}>
          Two A
        </h3>
        <p style={tall}>…</p>
        <h2 id="three" style={{ margin: 0 }}>
          Three
        </h2>
        <p style={{ margin: 0 }}>…</p>
      </div>
    </div>
  );
}

const frames = async (count: number) => {
  for (let i = 0; i < count; i++) await new Promise(requestAnimationFrame);
};
const link = (name: string) => screen.getByRole('link', { name });
const current = () => document.querySelector('[aria-current="location"]')?.textContent ?? null;

function scrollTo(id: string, offset = 0) {
  const scroller = screen.getByTestId('scroller');
  const heading = document.getElementById(id)!;
  scroller.scrollTop += heading.getBoundingClientRect().top - scroller.getBoundingClientRect().top - LINE + offset;
}

describe('Contents in a browser', () => {
  it('marks the last section whose heading has passed the scroll padding line', async () => {
    render(<Page />);
    await waitFor(() => expect(current()).toBe('One'));
    scrollTo('two', -10);
    await waitFor(() => expect(current()).toBe('One'));
    scrollTo('two');
    await waitFor(() => expect(current()).toBe('Two'));
    // Two A's own scroll margin puts its line 20px lower.
    scrollTo('two-a', -30);
    await waitFor(() => expect(current()).toBe('Two'));
    scrollTo('two-a', -10);
    await waitFor(() => expect(current()).toBe('Two A'));
    expect(link('Two A').getAttribute('aria-current')).toBe('location');
    expect(link('Two').hasAttribute('aria-current')).toBe(false);
  });

  it('follows a jump from the end straight back to the top', async () => {
    render(<Page />);
    const scroller = screen.getByTestId('scroller');
    scroller.scrollTop = scroller.scrollHeight;
    await waitFor(() => expect(current()).toBe('Two A'));
    scroller.scrollTop = 0;
    await waitFor(() => expect(current()).toBe('One'));
  });

  it('keeps a picked short last section current until the person scrolls', async () => {
    render(<Page />);
    await waitFor(() => expect(current()).toBe('One'));
    link('Three').click();
    await waitFor(() => expect(current()).toBe('Three'));
    // The box cannot scroll Three up to the line, so the heading above it has passed the line instead.
    const scroller = screen.getByTestId('scroller');
    expect(scroller.scrollTop).toBe(scroller.scrollHeight - scroller.clientHeight);
    scroller.dispatchEvent(new WheelEvent('wheel', { bubbles: true, deltaY: -10 }));
    await waitFor(() => expect(current()).toBe('Two A'));
  });

  it('drops a pick once its section has been in view and leaves it', async () => {
    render(<Page />);
    link('Two').click();
    await waitFor(() => expect(current()).toBe('Two'));
    // Let the observer see the section in view before scrolling away.
    await frames(2);
    screen.getByTestId('scroller').scrollTop = 0;
    await waitFor(() => expect(current()).toBe('One'));
  });

  it('picks the section a hash change names where the page shows it, and drops the pick for any other hash', async () => {
    history.replaceState(null, '', '#three');
    render(<Page />);
    // Loaded with a hash the page doesn't show, as after a restored scroll position.
    await waitFor(() => expect(current()).toBe('One'));
    const scroller = screen.getByTestId('scroller');
    history.replaceState(null, '', '#two');
    window.dispatchEvent(new HashChangeEvent('hashchange'));
    await frames(2);
    expect(current()).toBe('One');
    scroller.scrollTop = scroller.scrollHeight;
    await waitFor(() => expect(current()).toBe('Two A'));
    history.replaceState(null, '', '#three');
    window.dispatchEvent(new HashChangeEvent('hashchange'));
    await waitFor(() => expect(current()).toBe('Three'));
    history.replaceState(null, '', '#nothing');
    window.dispatchEvent(new HashChangeEvent('hashchange'));
    await waitFor(() => expect(current()).toBe('Two A'));
  });

  it('starts at the section the page hash names when the page shows it', async () => {
    const { rerender } = render(<Page list={false} />);
    const scroller = screen.getByTestId('scroller');
    scroller.scrollTop = scroller.scrollHeight;
    history.replaceState(null, '', '#three');
    rerender(<Page />);
    await waitFor(() => expect(current()).toBe('Three'));
  });

  it('keeps releasing a pick after the links change', async () => {
    const { rerender } = render(<Page />);
    link('Two').click();
    await waitFor(() => expect(current()).toBe('Two'));
    await frames(2);
    rerender(<Page more />);
    await waitFor(() => expect(link('Nowhere')).toBeTruthy());
    await frames(2);
    screen.getByTestId('scroller').scrollTop = 0;
    await waitFor(() => expect(current()).toBe('One'));
  });

  it('never marks or picks a link to another page', async () => {
    render(<Page extra />);
    await waitFor(() => expect(current()).toBe('One'));
    const elsewhere = link('Elsewhere');
    elsewhere.addEventListener('click', (event) => event.preventDefault());
    elsewhere.click();
    await frames(2);
    expect(current()).toBe('One');
    expect(elsewhere.hasAttribute('aria-current')).toBe(false);
  });

  it('follows headings that mount after the links', async () => {
    function Late() {
      const [shown, setShown] = useState(false);
      return (
        <>
          <button type="button" onClick={() => setShown(true)}>
            Show
          </button>
          <Contents.Root>
            <Contents.Item>
              <Contents.Link href="#late">Late</Contents.Link>
            </Contents.Item>
          </Contents.Root>
          {shown ? <h2 id="late">Late</h2> : null}
          <div style={{ blockSize: '150vh' }} />
        </>
      );
    }
    render(<Late />);
    await frames(2);
    expect(current()).toBeNull();
    screen.getByRole('button', { name: 'Show' }).click();
    await frames(2);
    window.scrollTo(0, document.getElementById('late')!.getBoundingClientRect().top + window.scrollY);
    await waitFor(() => expect(current()).toBe('Late'));
  });

  it('follows the page when a wrapper only hides overflow sideways', async () => {
    render(
      <div style={{ overflowX: 'hidden' }}>
        <Contents.Root>
          <Contents.Item>
            <Contents.Link href="#page-one">One</Contents.Link>
          </Contents.Item>
          <Contents.Item>
            <Contents.Link href="#page-two">Two</Contents.Link>
          </Contents.Item>
        </Contents.Root>
        <h2 id="page-one">One</h2>
        <div style={{ blockSize: '150vh' }} />
        <h2 id="page-two">Two</h2>
        <div style={{ blockSize: '150vh' }} />
      </div>,
    );
    window.scrollTo(0, document.getElementById('page-two')!.getBoundingClientRect().top + window.scrollY);
    await waitFor(() => expect(current()).toBe('Two'));
    window.scrollTo(0, 0);
    await waitFor(() => expect(current()).not.toBe('Two'));
  });

  it('works through a render that drops the ref', async () => {
    render(<Page refless />);
    await waitFor(() => expect(current()).toBe('One'));
    link('Three').click();
    await waitFor(() => expect(current()).toBe('Three'));
  });

  it('keeps a pick while keys go to a field', async () => {
    render(
      <>
        <input aria-label="Search" />
        <Page />
      </>,
    );
    link('Three').click();
    await waitFor(() => expect(current()).toBe('Three'));
    const search = screen.getByRole('textbox', { name: 'Search' });
    search.focus();
    search.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', bubbles: true }));
    await frames(2);
    expect(current()).toBe('Three');
    document.body.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true }));
    await waitFor(() => expect(current()).toBe('Two A'));
  });

  it('reads a percentage scroll padding against the scroller, from inside its border', async () => {
    // 20% of the 300px box is 60px; the 10px border moves the padding edge down too.
    render(<Page scroller={{ scrollPaddingBlockStart: '20%', borderBlockStart: '10px solid' }} />);
    const scroller = screen.getByTestId('scroller');
    const at = (id: string, offset: number) => {
      const top = scroller.getBoundingClientRect().top + scroller.clientTop;
      scroller.scrollTop += document.getElementById(id)!.getBoundingClientRect().top - top - 60 + offset;
    };
    at('two', -5);
    await waitFor(() => expect(current()).toBe('One'));
    at('two', 0);
    await waitFor(() => expect(current()).toBe('Two'));
  });

  it('measures again when the scroller resizes', async () => {
    const { rerender } = render(<Page />);
    await waitFor(() => expect(current()).toBe('One'));
    rerender(<Page scroller={{ blockSize: '100px' }} />);
    await frames(2);
    // Two sits 30px below the line, inside the shorter box: still not passed.
    scrollTo('two', -30);
    await waitFor(() => expect(current()).toBe('One'));
    scrollTo('two', 5);
    await waitFor(() => expect(current()).toBe('Two'));
  });

  it('follows a heading renamed to a section the list names', async () => {
    render(<Page more />);
    await waitFor(() => expect(current()).toBe('One'));
    document.getElementById('one')!.id = 'nowhere';
    await waitFor(() => expect(current()).toBe('Nowhere'));
  });

  it('draws the marker on the rule beside the current link, and indents nested links', async () => {
    for (const dir of [undefined, 'rtl'] as const) {
      render(<Page dir={dir} />);
      await waitFor(() => expect(current()).toBe('One'));
      const list = screen.getAllByRole('list')[0]!;
      const style = getComputedStyle(list);
      const rule = parseFloat(dir ? style.borderRightWidth : style.borderLeftWidth);
      const listBox = list.getBoundingClientRect();
      const ruleCentre = dir ? listBox.right - rule / 2 : listBox.left + rule / 2;
      const marker = getComputedStyle(link('One'), '::before');
      expect(marker.backgroundColor).not.toBe('rgba(0, 0, 0, 0)');
      const linkBox = link('One').getBoundingClientRect();
      const width = parseFloat(marker.width);
      const start = dir ? linkBox.right - parseFloat(marker.right) - width : linkBox.left + parseFloat(marker.left);
      expect(start + width / 2).toBeCloseTo(ruleCentre, 0);
      expect(getComputedStyle(link('Two'), '::before').backgroundColor).toBe('rgba(0, 0, 0, 0)');
      // A nested link keeps its box on the rule and moves its text in.
      const nested = link('Two A');
      expect(nested.getBoundingClientRect().left).toBeCloseTo(link('Two').getBoundingClientRect().left, 0);
      const pad = (el: Element) => parseFloat(getComputedStyle(el)[dir ? 'paddingRight' : 'paddingLeft']);
      expect(pad(nested)).toBeGreaterThan(pad(link('Two')));
      cleanup();
    }
  });

  it('has no axe violations', async () => {
    render(<Page />);
    await waitFor(() => expect(current()).toBe('One'));
    const results = await axe.run(screen.getByRole('navigation'), {
      rules: { 'color-contrast': { enabled: false } },
    });
    expect(results.violations).toEqual([]);
  });
});
