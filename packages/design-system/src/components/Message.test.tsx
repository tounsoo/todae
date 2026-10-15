import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { Message } from './Message';

afterEach(cleanup);

describe('Message', () => {
  it('renders an article from the assistant by default, with its parts in order', () => {
    render(
      <Message.Root aria-label="Assistant">
        <Message.Avatar>A</Message.Avatar>
        <Message.Header>Assistant</Message.Header>
        <Message.Content>Hello.</Message.Content>
        <Message.Actions>
          <button type="button">Copy</button>
        </Message.Actions>
      </Message.Root>,
    );
    const message = screen.getByRole('article', { name: 'Assistant' });
    expect(message.tagName).toBe('ARTICLE');
    expect(message.dataset.from).toBe('assistant');
    expect(message.hasAttribute('aria-busy')).toBe(false);
    expect(message.hasAttribute('data-streaming')).toBe(false);
    expect([...message.children].map((child) => child.textContent)).toEqual(['A', 'Assistant', 'Hello.', 'Copy']);
  });

  it('sets data-from to who wrote it', () => {
    render(
      <>
        <Message.Root data-testid="user" from="user" />
        <Message.Root data-testid="system" from="system" />
      </>,
    );
    expect(screen.getByTestId('user').dataset.from).toBe('user');
    expect(screen.getByTestId('system').dataset.from).toBe('system');
  });

  it('marks a streaming message busy, and clears it when streaming ends', () => {
    const { rerender } = render(<Message.Root data-testid="m" streaming />);
    const message = screen.getByTestId('m');
    expect(message.getAttribute('aria-busy')).toBe('true');
    expect(message.hasAttribute('data-streaming')).toBe(true);
    rerender(<Message.Root data-testid="m" streaming={false} />);
    expect(message.hasAttribute('aria-busy')).toBe(false);
    expect(message.hasAttribute('data-streaming')).toBe(false);
  });

  it("lets the product's own aria-busy win", () => {
    render(<Message.Root data-testid="m" aria-busy="false" streaming />);
    expect(screen.getByTestId('m').getAttribute('aria-busy')).toBe('false');
  });

  it('writes the time for the locale in its own zone, with a machine-readable dateTime', () => {
    const sent = Temporal.ZonedDateTime.from('2026-10-14T21:41:30.250+09:00[Asia/Seoul]');
    render(
      <>
        <Message.Time data-testid="en" value={sent} locale="en-US" />
        <Message.Time data-testid="ko" value={sent} locale="ko" />
        <Message.Time data-testid="date" value={sent} locale="en-US" dateStyle="medium" timeStyle="short" />
        <Message.Time data-testid="own" value={sent}>
          2 min ago
        </Message.Time>
      </>,
    );
    // ICU versions differ in which space they put before AM and PM.
    const text = (id: string) => screen.getByTestId(id).textContent?.replace(/\s/gu, ' ');
    const en = screen.getByTestId('en');
    expect(en.tagName).toBe('TIME');
    expect(text('en')).toBe('9:41 PM');
    expect(en.getAttribute('datetime')).toBe('2026-10-14T21:41:30+09:00');
    expect(text('ko')).toBe('오후 9:41');
    expect(text('date')).toBe('Oct 14, 2026, 9:41 PM');
    expect(screen.getByTestId('own').textContent).toBe('2 min ago');
    expect(screen.getByTestId('own').getAttribute('datetime')).toBe('2026-10-14T21:41:30+09:00');
  });

  it('marks actions that show only on hover or focus', () => {
    render(
      <>
        <Message.Actions data-testid="always" />
        <Message.Actions data-testid="hover" reveal="hover" />
      </>,
    );
    expect(screen.getByTestId('always').dataset.reveal).toBe('always');
    expect(screen.getByTestId('hover').dataset.reveal).toBe('hover');
  });
});
