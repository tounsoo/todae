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

  function Framed({ ids, header = false, typing = false }: { ids: number[]; header?: boolean; typing?: boolean }) {
    return (
      <Conversation.Root>
        <Conversation.Viewport>
          <Conversation.Content>
            {header && <button type="button">Load earlier</button>}
            {ids.map((id) => (
              <Message.Root key={id} aria-label={`Message ${id}`}>
                <Message.Content>Message {id}</Message.Content>
              </Message.Root>
            ))}
            {typing && <div>Typing</div>}
          </Conversation.Content>
        </Conversation.Viewport>
      </Conversation.Root>
    );
  }

  it('marks a message added before something that stays at the end', async () => {
    const { rerender } = render(<Framed ids={[1, 2]} typing />);
    rerender(<Framed ids={[1, 2, 3]} typing />);
    expect(names(await marks())).toEqual(['Message 3']);
  });

  it('marks the first message and its reply before a typing indicator', async () => {
    const { rerender } = render(<Framed ids={[]} typing />);
    rerender(<Framed ids={[1, 2]} typing />);
    expect(names(await marks())).toEqual(['Message 1', 'Message 2']);
  });

  it('leaves older messages loaded under a header still', async () => {
    const { rerender } = render(<Framed ids={range(3, 5)} header />);
    rerender(<Framed ids={range(1, 5)} header />);
    expect(await marks()).toEqual([]);
  });

  it('counts messages, not the other children added with them', async () => {
    function Dated({ ids }: { ids: number[] }) {
      return (
        <Conversation.Root>
          <Conversation.Viewport>
            <Conversation.Content>
              <Message.Root aria-label="Message 1">
                <Message.Content>Message 1</Message.Content>
              </Message.Root>
              {ids.length > 0 && <div role="separator">Tuesday</div>}
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
    const dated = render(<Dated ids={[]} />);
    dated.rerender(<Dated ids={[2, 3]} />);
    expect(names(await marks())).toEqual(['Message 2', 'Message 3']);
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

  it('leaves one or two messages that replace every message still', async () => {
    const { rerender } = render(<Thread ids={range(1, 3)} />);
    rerender(<Thread ids={[4]} />);
    expect(await marks()).toEqual([]);
    rerender(<Thread ids={[6, 7]} />);
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
