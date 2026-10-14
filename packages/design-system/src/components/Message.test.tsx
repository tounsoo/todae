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
});
