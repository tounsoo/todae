import { act, render, screen, waitFor } from '@testing-library/react';
import { cdp } from '@vitest/browser/context';
import axe from 'axe-core';
import { useEffect, useState } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { Alert, Conversation, Message } from '../index';

/** vitest types the session without its methods; Playwright's session has `send`. */
function emulateMedia(features: { name: string; value: string }[]) {
  return (
    cdp() as unknown as {
      send(method: string, params: object): Promise<unknown>;
    }
  ).send('Emulation.setEmulatedMedia', {
    features,
  });
}

const politeRegion = () => document.querySelector<HTMLElement>('body > [data-todae-announcer] > [aria-live="polite"]');

const frame = () => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));

afterEach(() => {
  for (const node of document.querySelectorAll('[data-todae-announcer]')) node.remove();
});

function Thread({ count, streaming = false, failed = false }: { count: number; streaming?: boolean; failed?: boolean }) {
  return (
    <div data-appearance="light" data-density="comfortable">
      <Conversation.Root style={{ blockSize: '200px', inlineSize: '400px' }}>
        <Conversation.Viewport data-testid="viewport">
          <Conversation.Content>
            {Array.from({ length: count }, (_, i) => (
              <Message.Root key={i} streaming={streaming && i === count - 1} aria-label={`Message ${i + 1}`}>
                <Message.Content style={{ blockSize: '60px' }}>Message {i + 1}</Message.Content>
                {failed && i === count - 1 && <Alert.Root tone="critical">Failed</Alert.Root>}
              </Message.Root>
            ))}
          </Conversation.Content>
        </Conversation.Viewport>
        <Conversation.ScrollButton data-testid="scroll" />
      </Conversation.Root>
    </div>
  );
}

const distanceToEnd = (el: HTMLElement) => el.scrollHeight - el.clientHeight - el.scrollTop;

describe('Conversation in a browser', () => {
  it('opens at the end, as a region named Conversation', () => {
    render(<Thread count={10} />);
    const viewport = screen.getByRole('region', { name: 'Conversation' });
    expect(viewport.scrollHeight).toBeGreaterThan(viewport.clientHeight);
    expect(distanceToEnd(viewport)).toBeLessThanOrEqual(1);
    expect(screen.getByTestId('scroll').hidden).toBe(true);
  });

  it('follows the end while the content grows', async () => {
    const { rerender } = render(<Thread count={10} />);
    rerender(<Thread count={14} />);
    await frame();
    expect(distanceToEnd(screen.getByTestId('viewport'))).toBeLessThanOrEqual(1);
  });

  it('stops following when the reader scrolls up, and shows the scroll button', async () => {
    const { rerender } = render(<Thread count={10} />);
    const viewport = screen.getByTestId('viewport');
    await frame();
    viewport.scrollTop = 0;
    await frame();
    rerender(<Thread count={14} />);
    await frame();
    expect(viewport.scrollTop).toBe(0);
    await waitFor(() => expect(screen.getByTestId('scroll').hidden).toBe(false));
    expect(screen.getByTestId('scroll').getAttribute('aria-label')).toBe('Scroll to latest message');
  });

  it('scrolls to the end from the button, and hands its focus to the viewport', async () => {
    await emulateMedia([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
    try {
      render(<Thread count={10} />);
      const viewport = screen.getByTestId('viewport');
      await frame();
      viewport.scrollTop = 0;
      const button = await waitFor(() => {
        const el = screen.getByTestId('scroll');
        expect(el.hidden).toBe(false);
        return el;
      });
      button.focus();
      act(() => button.click());
      await frame();
      expect(distanceToEnd(viewport)).toBeLessThanOrEqual(1);
      expect(button.hidden).toBe(true);
      expect(document.activeElement).toBe(viewport);
    } finally {
      await emulateMedia([]);
    }
  });

  it('reaches the end from the button while a message keeps growing', async () => {
    function Growing() {
      const [count, setCount] = useState(40);
      const [grow, setGrow] = useState(false);
      useEffect(() => {
        if (!grow) return;
        const timer = setInterval(() => setCount((c) => c + 1), 16);
        return () => clearInterval(timer);
      }, [grow]);
      return (
        <>
          <Thread count={count} />
          <button type="button" data-testid="grow" onClick={() => setGrow(true)}>
            Grow
          </button>
        </>
      );
    }
    render(<Growing />);
    const viewport = screen.getByTestId('viewport');
    await frame();
    viewport.scrollTop = 0;
    await waitFor(() => expect(screen.getByTestId('scroll').hidden).toBe(false));
    act(() => screen.getByTestId('grow').click());
    act(() => screen.getByTestId('scroll').click());
    await waitFor(() => expect(distanceToEnd(viewport)).toBeLessThanOrEqual(1), { timeout: 2000 });
    expect(screen.getByTestId('scroll').hidden).toBe(true);
  });

  it('stops following when the reader scrolls up a pixel or two at a time', async () => {
    const { rerender } = render(<Thread count={10} />);
    const viewport = screen.getByTestId('viewport');
    await frame();
    for (let i = 0; i < 3; i++) {
      viewport.scrollTop -= 1;
      await frame();
    }
    const top = viewport.scrollTop;
    rerender(<Thread count={14} />);
    await frame();
    expect(viewport.scrollTop).toBe(top);
    expect(screen.getByTestId('scroll').hidden).toBe(false);
  });

  it('follows again once the end comes to the reader', async () => {
    const { rerender } = render(<Thread count={10} />);
    const viewport = screen.getByTestId('viewport');
    await frame();
    viewport.scrollTop = 0;
    await waitFor(() => expect(screen.getByTestId('scroll').hidden).toBe(false));
    rerender(<Thread count={1} />);
    await waitFor(() => expect(screen.getByTestId('scroll').hidden).toBe(true));
    rerender(<Thread count={12} />);
    await frame();
    expect(distanceToEnd(viewport)).toBeLessThanOrEqual(1);
  });

  it('draws the scroll button over positioned parts of a message, and keeps focus clear of it', async () => {
    render(<Thread count={10} />);
    const viewport = screen.getByTestId('viewport');
    await frame();
    for (const content of viewport.querySelectorAll<HTMLElement>('article > div')) content.style.position = 'relative';
    viewport.scrollTop = 0;
    const button = await waitFor(() => {
      const el = screen.getByTestId('scroll');
      expect(el.hidden).toBe(false);
      return el;
    });
    await frame();
    const box = button.getBoundingClientRect();
    expect(button.contains(document.elementFromPoint(box.left + box.width / 2, box.top + box.height / 2))).toBe(true);
    const padding = parseFloat(getComputedStyle(viewport).scrollPaddingBottom);
    expect(padding).toBeGreaterThanOrEqual(viewport.getBoundingClientRect().bottom - box.top);
  });

  it('announces when a message starts and finishes arriving', async () => {
    const { rerender } = render(<Thread count={3} />);
    rerender(<Thread count={4} streaming />);
    await waitFor(() => expect(politeRegion()?.textContent).toBe('New message'));
    rerender(<Thread count={4} />);
    await waitFor(() => expect(politeRegion()?.textContent).toBe('Message complete'));
  });

  it('leaves a failed message to its alert', async () => {
    const { rerender } = render(<Thread count={3} streaming />);
    rerender(<Thread count={4} streaming />);
    await waitFor(() => expect(politeRegion()?.textContent).toBe('New message'));
    rerender(<Thread count={4} failed />);
    await new Promise((resolve) => setTimeout(resolve, 300));
    expect(politeRegion()?.textContent).toBe('New message');
  });

  it('reads only the start when one message finishes as another starts', async () => {
    function Turns({ step }: { step: number }) {
      return (
        <Conversation.Root style={{ blockSize: '200px' }}>
          <Conversation.Viewport>
            <Conversation.Content>
              <Message.Root streaming={step === 1} aria-label="Tool">
                <Message.Content>Tool</Message.Content>
              </Message.Root>
              {step === 2 && (
                <Message.Root streaming aria-label="Reply">
                  <Message.Content>Reply</Message.Content>
                </Message.Root>
              )}
            </Conversation.Content>
          </Conversation.Viewport>
        </Conversation.Root>
      );
    }
    const { rerender } = render(<Turns step={0} />);
    rerender(<Turns step={1} />);
    await waitFor(() => expect(politeRegion()?.textContent).toBe('New message'));
    act(() => politeRegion()!.replaceChildren());
    rerender(<Turns step={2} />);
    await waitFor(() => expect(politeRegion()?.textContent).toBe('New message'));
  });

  it('shows the chevron when its children render nothing', async () => {
    render(
      <Conversation.Root style={{ blockSize: '100px' }}>
        <Conversation.Viewport>
          <Conversation.Content>
            <div style={{ blockSize: '400px' }} />
          </Conversation.Content>
        </Conversation.Viewport>
        <Conversation.ScrollButton data-testid="scroll">{false}</Conversation.ScrollButton>
      </Conversation.Root>,
    );
    const button = screen.getByTestId('scroll');
    expect(button.querySelector('[data-todae-glyph] svg')).not.toBeNull();
    expect(button.getAttribute('aria-label')).toBe('Scroll to latest message');
  });

  it.each([
    ['[false, false]', [false, false]],
    ['true', true],
  ])('shows the chevron when its children are %s', (_, children) => {
    render(
      <Conversation.Root>
        <Conversation.Viewport>
          <Conversation.Content />
        </Conversation.Viewport>
        <Conversation.ScrollButton data-testid="scroll">{children}</Conversation.ScrollButton>
      </Conversation.Root>,
    );
    const button = screen.getByTestId('scroll');
    expect(button.querySelector('[data-todae-glyph] svg')).not.toBeNull();
    expect(button.getAttribute('aria-label')).toBe('Scroll to latest message');
  });

  it('keeps following when content above shrinks as the end grows', async () => {
    function Collapsing({ step }: { step: number }) {
      return (
        <Conversation.Root style={{ blockSize: '200px' }}>
          <Conversation.Viewport data-testid="viewport">
            <Conversation.Content>
              <div style={{ blockSize: step ? '20px' : '120px' }} />
              {Array.from({ length: 10 }, (_, i) => (
                <div key={i} style={{ blockSize: '60px' }} />
              ))}
              <div style={{ blockSize: step ? '160px' : '60px' }} />
            </Conversation.Content>
          </Conversation.Viewport>
          <Conversation.ScrollButton data-testid="scroll" />
        </Conversation.Root>
      );
    }
    const { rerender } = render(<Collapsing step={0} />);
    const viewport = screen.getByTestId('viewport');
    await frame();
    rerender(<Collapsing step={1} />);
    viewport.dispatchEvent(new Event('scroll'));
    await frame();
    expect(distanceToEnd(viewport)).toBeLessThanOrEqual(1);
    expect(screen.getByTestId('scroll').hidden).toBe(true);
  });

  it('keeps the reader in place while hidden and shown again', async () => {
    function Hideable({ hidden }: { hidden: boolean }) {
      return (
        <div hidden={hidden}>
          <Thread count={10} />
        </div>
      );
    }
    const { rerender } = render(<Hideable hidden={false} />);
    const viewport = screen.getByTestId('viewport');
    await frame();
    viewport.scrollTop = 100;
    await waitFor(() => expect(screen.getByTestId('scroll').hidden).toBe(false));
    rerender(<Hideable hidden />);
    await frame();
    rerender(<Hideable hidden={false} />);
    await frame();
    expect(viewport.scrollTop).toBe(100);
    expect(screen.getByTestId('scroll').hidden).toBe(false);
  });

  it.each([
    ['the density changes', (root: HTMLElement) => root.setAttribute('data-density', 'spacious')],
    ['its inset changes', (root: HTMLElement) => root.style.setProperty('--todae-conversation-scroll-button-inset', '120px')],
  ])('keeps the scroll padding past the shown button when %s', async (_, change) => {
    const { container } = render(<Thread count={10} />);
    const viewport = screen.getByTestId('viewport');
    await frame();
    viewport.scrollTop = 0;
    const button = await waitFor(() => {
      const el = screen.getByTestId('scroll');
      expect(el.hidden).toBe(false);
      return el;
    });
    await frame();
    change(container.querySelector<HTMLElement>('[data-density]')!);
    await frame();
    const cover = viewport.getBoundingClientRect().bottom - button.getBoundingClientRect().top;
    expect(parseFloat(getComputedStyle(viewport).scrollPaddingBottom)).toBeGreaterThanOrEqual(cover - 0.5);
  });

  it('turns scroll anchoring off in the same task that following starts', async () => {
    render(<Thread count={10} />);
    const viewport = screen.getByTestId('viewport');
    await frame();
    viewport.scrollTop = 0;
    await waitFor(() => expect(viewport.hasAttribute('data-following')).toBe(false));
    viewport.scrollTop = viewport.scrollHeight;
    viewport.dispatchEvent(new Event('scroll'));
    expect(getComputedStyle(viewport).overflowAnchor).toBe('none');
  });

  it('passes axe', async () => {
    render(
      <main>
        <Thread count={10} />
      </main>,
    );
    const results = await axe.run(document.body, { rules: { 'color-contrast': { enabled: false } } });
    expect(results.violations).toEqual([]);
  });
});
