import { act, render, screen, waitFor } from '@testing-library/react';
import { cdp } from '@vitest/browser/context';
import axe from 'axe-core';
import { useState } from 'react';
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

  it('keeps following after a smooth scroll from the button while the content grows', async () => {
    function Growing() {
      const [count, setCount] = useState(10);
      return (
        <>
          <Thread count={count} />
          <button type="button" data-testid="grow" onClick={() => setCount((c) => c + 2)}>
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
    act(() => screen.getByTestId('scroll').click());
    act(() => screen.getByTestId('grow').click());
    await waitFor(() => expect(distanceToEnd(viewport)).toBeLessThanOrEqual(1), { timeout: 3000 });
    await waitFor(() => expect(screen.getByTestId('scroll').hidden).toBe(true));
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
