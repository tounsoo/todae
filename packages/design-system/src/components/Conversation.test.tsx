import { act, cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { Conversation, Message } from '../index.js';

afterEach(cleanup);

function Thread({ ids }: { ids: number[] }) {
  return (
    <Conversation.Root>
      <Conversation.Viewport>
        <Conversation.Content>
          {ids.map((id) => (
            <Message.Root key={id} aria-label={`Message ${id}`}>
              <Message.Content>Message {id}</Message.Content>
            </Message.Root>
          ))}
        </Conversation.Content>
      </Conversation.Viewport>
    </Conversation.Root>
  );
}

const range = (from: number, to: number) => Array.from({ length: to - from + 1 }, (_, i) => from + i);
// The marks land a microtask after the messages do.
const marks = async () => {
  await act(async () => {});
  return screen.queryAllByRole('article').filter((message) => message.hasAttribute('data-todae-entering'));
};
const names = (messages: HTMLElement[]) => messages.map((message) => message.getAttribute('aria-label'));

describe('Conversation.Content entrance', () => {
  it('leaves the messages it mounts with still', async () => {
    render(<Thread ids={range(1, 5)} />);
    expect(await marks()).toEqual([]);
  });

  it('marks the messages added at the end', async () => {
    const { rerender } = render(<Thread ids={range(1, 5)} />);
    rerender(<Thread ids={range(1, 6)} />);
    expect(names(await marks())).toEqual(['Message 6']);
    rerender(<Thread ids={range(1, 8)} />);
    // An earlier mark lasts until its animation ends, which jsdom never runs.
    expect(names(await marks())).toEqual(['Message 6', 'Message 7', 'Message 8']);
  });

  it('marks the first message of an empty conversation, and its reply', async () => {
    const { rerender } = render(<Thread ids={[]} />);
    rerender(<Thread ids={[1]} />);
    expect(names(await marks())).toEqual(['Message 1']);
    cleanup();
    const second = render(<Thread ids={[]} />);
    second.rerender(<Thread ids={[1, 2]} />);
    expect(names(await marks())).toEqual(['Message 1', 'Message 2']);
  });

  it('marks a message added before something that stays at the end', async () => {
    function Typing({ ids }: { ids: number[] }) {
      return (
        <Conversation.Root>
          <Conversation.Viewport>
            <Conversation.Content>
              {ids.map((id) => (
                <Message.Root key={id} aria-label={`Message ${id}`}>
                  <Message.Content>Message {id}</Message.Content>
                </Message.Root>
              ))}
              <div>Typing</div>
            </Conversation.Content>
          </Conversation.Viewport>
        </Conversation.Root>
      );
    }
    const { rerender } = render(<Typing ids={[1, 2]} />);
    rerender(<Typing ids={[1, 2, 3]} />);
    expect(names(await marks())).toEqual(['Message 3']);
  });

  it('leaves history that fills an empty or replaced list still', async () => {
    const { rerender } = render(<Thread ids={[]} />);
    rerender(<Thread ids={range(1, 3)} />);
    expect(await marks()).toEqual([]);
    rerender(<Thread ids={range(11, 13)} />);
    expect(await marks()).toEqual([]);
  });

  it('leaves more than two messages added at once still, as history', async () => {
    const { rerender } = render(<Thread ids={range(1, 2)} />);
    rerender(<Thread ids={range(1, 5)} />);
    expect(await marks()).toEqual([]);
  });

  it('leaves older messages added above still', async () => {
    const { rerender } = render(<Thread ids={range(3, 5)} />);
    rerender(<Thread ids={range(1, 5)} />);
    expect(await marks()).toEqual([]);
  });

  it('leaves a message that moves to the end still', async () => {
    const { rerender } = render(<Thread ids={[1, 2, 3]} />);
    rerender(<Thread ids={[2, 3, 1]} />);
    expect(await marks()).toEqual([]);
  });

  it('clears the mark when the animation ends', async () => {
    const { rerender } = render(<Thread ids={range(1, 2)} />);
    rerender(<Thread ids={range(1, 3)} />);
    const [message] = await marks();
    message!.dispatchEvent(new Event('animationend', { bubbles: true }));
    expect(message!.hasAttribute('data-todae-entering')).toBe(false);
  });
});
