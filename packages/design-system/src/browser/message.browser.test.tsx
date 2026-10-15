import { render, screen } from '@testing-library/react';
import { cdp, userEvent } from '@vitest/browser/context';
import axe from 'axe-core';
import { describe, expect, it } from 'vitest';
import { Avatar, Message, Prose } from '../index';

/** vitest types the session without its methods; Playwright's session has `send`. */
const session = () => cdp() as unknown as { send(method: string, params: object): Promise<unknown> };

function emulateMedia(features: { name: string; value: string }[]) {
  return session().send('Emulation.setEmulatedMedia', { features });
}

describe('Message.Root in a browser', () => {
  it('puts a user message at the end side in a bubble, with the avatar after it', () => {
    render(
      <div data-appearance="light" data-density="comfortable" style={{ inlineSize: '600px' }}>
        <Message.Root data-testid="user" from="user">
          <Message.Avatar data-testid="user-avatar">
            <Avatar.Root>
              <Avatar.Fallback>B</Avatar.Fallback>
            </Avatar.Root>
          </Message.Avatar>
          <Message.Content data-testid="user-content">Short question</Message.Content>
        </Message.Root>
        <Message.Root data-testid="assistant">
          <Message.Avatar data-testid="assistant-avatar">
            <Avatar.Root>
              <Avatar.Fallback>T</Avatar.Fallback>
            </Avatar.Root>
          </Message.Avatar>
          <Message.Header data-testid="assistant-header">Todae</Message.Header>
          <Message.Content data-testid="assistant-content">Answer</Message.Content>
        </Message.Root>
        <Message.Root data-testid="system" from="system">
          <Message.Content data-testid="system-content">Model changed</Message.Content>
        </Message.Root>
      </div>,
    );
    const box = (id: string) => screen.getByTestId(id).getBoundingClientRect();
    const style = (id: string) => getComputedStyle(screen.getByTestId(id));
    // The user's bubble ends at the avatar, which ends at the message's end.
    expect(box('user-avatar').right).toBeCloseTo(box('user').right, 0);
    expect(box('user-content').right).toBeLessThan(box('user-avatar').left);
    expect(box('user-content').width).toBeLessThan(300);
    expect(style('user-content').backgroundColor).not.toBe('rgba(0, 0, 0, 0)');
    expect(parseFloat(style('user-content').paddingInlineStart)).toBeGreaterThan(0);
    // The assistant's parts sit in a column after its avatar, with no bubble.
    expect(box('assistant-avatar').left).toBeCloseTo(box('assistant').left, 0);
    expect(box('assistant-header').left).toBeGreaterThan(box('assistant-avatar').right);
    expect(box('assistant-content').left).toBe(box('assistant-header').left);
    expect(box('assistant-content').top).toBeGreaterThan(box('assistant-header').bottom);
    expect(style('assistant-content').backgroundColor).toBe('rgba(0, 0, 0, 0)');
    const center = (r: DOMRect) => r.left + r.width / 2;
    expect(center(box('system-content'))).toBeCloseTo(center(box('system')), 0);
  });

  it('mirrors a user message in RTL', () => {
    render(
      <div data-appearance="light" data-density="comfortable" dir="rtl" style={{ inlineSize: '600px' }}>
        <Message.Root data-testid="user" from="user">
          <Message.Avatar data-testid="avatar">
            <Avatar.Root>
              <Avatar.Fallback>B</Avatar.Fallback>
            </Avatar.Root>
          </Message.Avatar>
          <Message.Content data-testid="content">Hi</Message.Content>
        </Message.Root>
      </div>,
    );
    const box = (id: string) => screen.getByTestId(id).getBoundingClientRect();
    expect(box('avatar').left).toBeCloseTo(box('user').left, 0);
    expect(box('content').left).toBeGreaterThan(box('avatar').right);
  });

  it('draws nothing of its own while streaming', () => {
    render(
      <div data-appearance="light" data-density="comfortable">
        <Message.Root data-testid="message" streaming>
          <Message.Content>
            <Prose.Root>
              <p>Intro</p>
              <ul>
                <li>Item</li>
              </ul>
            </Prose.Root>
          </Message.Content>
        </Message.Root>
      </div>,
    );
    const message = screen.getByTestId('message');
    const drawn = [message, ...message.querySelectorAll('*')].filter((el) =>
      ['::before', '::after'].some((pseudo) => !['none', 'normal'].includes(getComputedStyle(el, pseudo).content)),
    );
    expect(drawn).toEqual([]);
  });

  it('centers every part of a system message', () => {
    render(
      <div data-appearance="light" data-density="comfortable" style={{ inlineSize: '600px' }}>
        <Message.Root data-testid="system" from="system">
          <Message.Header>
            <span data-testid="header-text">System</span>
          </Message.Header>
          <Message.Content>
            <span data-testid="content-text">Model changed</span>
          </Message.Content>
          <Message.Actions>
            <button type="button" data-testid="button">
              Undo
            </button>
          </Message.Actions>
        </Message.Root>
      </div>,
    );
    const center = (id: string) => {
      const r = screen.getByTestId(id).getBoundingClientRect();
      return r.left + r.width / 2;
    };
    for (const id of ['header-text', 'content-text', 'button']) expect(center(id), id).toBeCloseTo(center('system'), 0);
  });

  it('runs assistant content the full width, and keeps the parts spaced beside a tall avatar with no header', () => {
    render(
      <div data-appearance="light" data-density="comfortable" style={{ inlineSize: '600px' }}>
        <Message.Root data-testid="assistant">
          <Message.Avatar data-testid="avatar" style={{ blockSize: '200px' }} />
          <Message.Content data-testid="first">Reasoning</Message.Content>
          <Message.Content data-testid="content">Short</Message.Content>
          <Message.Actions data-testid="actions">
            <button type="button">Copy</button>
          </Message.Actions>
        </Message.Root>
      </div>,
    );
    const box = (id: string) => screen.getByTestId(id).getBoundingClientRect();
    expect(box('content').right).toBeCloseTo(box('assistant').right, 0);
    const gap = parseFloat(getComputedStyle(screen.getByTestId('content')).marginBlockStart);
    expect(gap).toBeGreaterThan(0);
    expect(box('first').top).toBeCloseTo(box('assistant').top, 0);
    expect(box('content').top - box('first').bottom).toBeCloseTo(gap, 0);
    expect(box('actions').top - box('content').bottom).toBeCloseTo(gap, 0);
    expect(box('assistant').height).toBeCloseTo(200, 0);
  });

  it.each(['assistant', 'user'] as const)('centers the avatar on the header row of a %s message', (from) => {
    render(
      <div data-appearance="light" data-density="comfortable" style={{ inlineSize: '600px' }}>
        <Message.Root data-testid="message" from={from}>
          <Message.Avatar data-testid="avatar">
            <Avatar.Root size="lg">
              <Avatar.Fallback>A</Avatar.Fallback>
            </Avatar.Root>
          </Message.Avatar>
          <Message.Header data-testid="header">
            <strong>Assistant</strong>
            <time dateTime="2026-10-14T09:41">9:41</time>
          </Message.Header>
          <Message.Content data-testid="content">Give it a name.</Message.Content>
        </Message.Root>
      </div>,
    );
    const box = (id: string) => screen.getByTestId(id).getBoundingClientRect();
    const middle = (r: DOMRect) => r.top + r.height / 2;
    expect(box('header').height).toBeLessThan(box('avatar').height);
    expect(middle(box('header'))).toBeCloseTo(middle(box('avatar')), 0);
    expect(box('avatar').top).toBeCloseTo(box('message').top, 0);
    const rowGap = parseFloat(getComputedStyle(screen.getByTestId('content')).marginTop);
    expect(rowGap).toBeGreaterThan(0);
    expect(box('content').top - Math.max(box('avatar').bottom, box('header').bottom)).toBeCloseTo(rowGap, 0);
  });

  it('spaces the parts apart more than a header from the part it labels', () => {
    render(
      <div data-appearance="light" data-density="comfortable" style={{ inlineSize: '600px' }}>
        <Message.Root>
          <Message.Header data-testid="header">Assistant</Message.Header>
          <Message.Content data-testid="content">Give it a name.</Message.Content>
          <Message.Actions data-testid="actions">
            <button type="button">Copy</button>
          </Message.Actions>
        </Message.Root>
      </div>,
    );
    const box = (id: string) => screen.getByTestId(id).getBoundingClientRect();
    const headerGap = box('content').top - box('header').bottom;
    const partGap = box('actions').top - box('content').bottom;
    expect(headerGap).toBeGreaterThan(0);
    expect(partGap).toBeGreaterThan(headerGap);
  });

  // The gap above a part, from the lowest visible thing before it.
  const gapAbove = (el: HTMLElement) => {
    let bottom = el.parentElement!.getBoundingClientRect().top;
    for (let prev = el.previousElementSibling; prev; prev = prev.previousElementSibling) {
      const r = prev.getBoundingClientRect();
      if (r.height > 0) bottom = Math.max(bottom, r.bottom);
    }
    return el.getBoundingClientRect().top - bottom;
  };

  it.each([
    [
      'a hidden part',
      <Message.Content key="h" hidden>
        Hidden
      </Message.Content>,
    ],
    ['an avatar', <Message.Avatar key="a">A</Message.Avatar>],
    [
      'a hidden avatar',
      <Message.Avatar key="a" hidden>
        A
      </Message.Avatar>,
    ],
  ])('keeps the header gap across %s', (_, between) => {
    render(
      <div data-appearance="light" data-density="comfortable" style={{ inlineSize: '600px' }}>
        <Message.Root>
          <Message.Header>Assistant</Message.Header>
          {between}
          <Message.Content data-testid="content">Give it a name.</Message.Content>
          <Message.Actions data-testid="actions">
            <button type="button">Copy</button>
          </Message.Actions>
        </Message.Root>
      </div>,
    );
    const headerGap = gapAbove(screen.getByTestId('content'));
    expect(headerGap).toBeGreaterThan(0);
    expect(gapAbove(screen.getByTestId('actions'))).toBeGreaterThan(headerGap + 1);
  });

  it.each([false, true])('gives the header gap after a later header too (avatar: %s)', (avatar) => {
    render(
      <div data-appearance="light" data-density="comfortable" style={{ inlineSize: '600px' }}>
        <Message.Root>
          {avatar && <Message.Avatar>A</Message.Avatar>}
          <Message.Header>Assistant</Message.Header>
          <Message.Content data-testid="first">Give it a name.</Message.Content>
          <Message.Header data-testid="later">Edited</Message.Header>
          <Message.Content data-testid="second">Pick a variant.</Message.Content>
        </Message.Root>
      </div>,
    );
    const rowGap = gapAbove(screen.getByTestId('later'));
    const headerGap = gapAbove(screen.getByTestId('second'));
    expect(headerGap).toBeGreaterThan(0);
    expect(rowGap).toBeGreaterThan(headerGap + 1);
  });

  it('keeps five parts spaced beside an avatar taller than four of them', () => {
    render(
      <div data-appearance="light" data-density="comfortable" style={{ inlineSize: '600px' }}>
        <Message.Root>
          <Message.Avatar>
            <span style={{ display: 'block', blockSize: '300px', inlineSize: '40px' }} />
          </Message.Avatar>
          <Message.Content>1</Message.Content>
          <Message.Content>2</Message.Content>
          <Message.Content data-testid="third">3</Message.Content>
          <Message.Content data-testid="fourth">4</Message.Content>
          <Message.Actions data-testid="fifth">
            <button type="button">Copy</button>
          </Message.Actions>
        </Message.Root>
      </div>,
    );
    const box = (id: string) => screen.getByTestId(id).getBoundingClientRect();
    expect(box('fifth').top - box('fourth').bottom).toBeCloseTo(box('fourth').top - box('third').bottom, 0);
  });

  it('lays out as if hidden parts were not there', () => {
    render(
      <div data-appearance="light" data-density="comfortable" style={{ inlineSize: '600px' }}>
        <Message.Root data-testid="hidden-header">
          <Message.Avatar data-testid="avatar">
            <Avatar.Root size="lg">
              <Avatar.Fallback>A</Avatar.Fallback>
            </Avatar.Root>
          </Message.Avatar>
          <Message.Header hidden>Assistant</Message.Header>
          <Message.Content data-testid="tall" style={{ blockSize: '200px' }}>
            Long reply
          </Message.Content>
        </Message.Root>
        <Message.Root data-testid="hidden-avatar">
          <Message.Avatar hidden>A</Message.Avatar>
          <Message.Content data-testid="indented">Grouped reply</Message.Content>
        </Message.Root>
      </div>,
    );
    const box = (id: string) => screen.getByTestId(id).getBoundingClientRect();
    expect(box('avatar').top).toBeCloseTo(box('hidden-header').top, 0);
    expect(box('tall').top).toBeCloseTo(box('hidden-header').top, 0);
    expect(box('indented').left).toBeCloseTo(box('hidden-avatar').left, 0);
    expect(box('indented').top).toBeCloseTo(box('hidden-avatar').top, 0);
  });

  it('keeps a later header in DOM order beside an avatar', () => {
    render(
      <div data-appearance="light" data-density="comfortable" style={{ inlineSize: '600px' }}>
        <Message.Root>
          <Message.Avatar>
            <Avatar.Root size="lg">
              <Avatar.Fallback>A</Avatar.Fallback>
            </Avatar.Root>
          </Message.Avatar>
          <Message.Header data-testid="name">Assistant</Message.Header>
          <Message.Content data-testid="content">Give it a name.</Message.Content>
          <Message.Header data-testid="edited">Edited</Message.Header>
          <Message.Header data-testid="hidden" hidden>
            Hidden
          </Message.Header>
        </Message.Root>
      </div>,
    );
    const box = (id: string) => screen.getByTestId(id).getBoundingClientRect();
    expect(box('content').top).toBeGreaterThanOrEqual(box('name').bottom);
    expect(box('edited').top).toBeGreaterThanOrEqual(box('content').bottom);
    expect(getComputedStyle(screen.getByTestId('hidden')).display).toBe('none');
  });

  it('keeps a header after the content below it beside an avatar', () => {
    render(
      <div data-appearance="light" data-density="comfortable" style={{ inlineSize: '600px' }}>
        <Message.Root>
          <Message.Avatar>
            <Avatar.Root size="lg">
              <Avatar.Fallback>A</Avatar.Fallback>
            </Avatar.Root>
          </Message.Avatar>
          <Message.Content data-testid="content">Give it a name.</Message.Content>
          <Message.Header data-testid="time">9:41</Message.Header>
        </Message.Root>
      </div>,
    );
    const box = (id: string) => screen.getByTestId(id).getBoundingClientRect();
    expect(box('time').top).toBeGreaterThanOrEqual(box('content').bottom);
  });

  it('outlines the user bubble in forced colors', async () => {
    render(
      <div data-appearance="light" data-density="comfortable">
        <Message.Root from="user">
          <Message.Content data-testid="content">Hi</Message.Content>
        </Message.Root>
      </div>,
    );
    try {
      await emulateMedia([{ name: 'forced-colors', value: 'active' }]);
      expect(parseFloat(getComputedStyle(screen.getByTestId('content')).borderTopWidth)).toBeGreaterThan(0);
    } finally {
      await emulateMedia([]);
    }
  });

  it('shows hover actions while the message is hovered or holds focus, and always without hover', async () => {
    render(
      <div data-appearance="light" data-density="comfortable" style={{ inlineSize: '400px' }}>
        <Message.Root data-testid="message" aria-label="Assistant">
          <Message.Content>Hello.</Message.Content>
          <Message.Actions data-testid="actions" reveal="hover">
            <button type="button">Copy</button>
          </Message.Actions>
        </Message.Root>
        <button type="button">Elsewhere</button>
      </div>,
    );
    const opacity = () => getComputedStyle(screen.getByTestId('actions')).opacity;
    try {
      await emulateMedia([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
      await userEvent.hover(screen.getByRole('button', { name: 'Elsewhere' }));
      expect(opacity()).toBe('0');
      await userEvent.hover(screen.getByTestId('message'));
      expect(opacity()).toBe('1');
      await userEvent.hover(screen.getByRole('button', { name: 'Elsewhere' }));
      expect(opacity()).toBe('0');
      screen.getByRole('button', { name: 'Copy' }).focus();
      expect(opacity()).toBe('1');
      screen.getByRole('button', { name: 'Elsewhere' }).focus();
      expect(opacity()).toBe('0');
      // A touch screen reports no hover.
      await session().send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 1 });
      expect(opacity()).toBe('1');
    } finally {
      await session().send('Emulation.setTouchEmulationEnabled', { enabled: false });
      await emulateMedia([]);
    }
  });

  it('passes axe as a conversation of articles', async () => {
    render(
      <main data-appearance="light" data-density="comfortable">
        <Message.Root from="user" aria-label="You">
          <Message.Content>Hi</Message.Content>
        </Message.Root>
        <Message.Root aria-label="Todae" streaming>
          <Message.Header>Todae</Message.Header>
          <Message.Content>Hello</Message.Content>
        </Message.Root>
      </main>,
    );
    const result = await axe.run(document.body, {
      rules: { 'color-contrast': { enabled: false } },
    });
    expect(result.violations.map((v) => v.id)).toEqual([]);
  });
});
