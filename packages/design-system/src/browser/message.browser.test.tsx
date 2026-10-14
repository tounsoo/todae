import { render, screen } from '@testing-library/react';
import { cdp } from '@vitest/browser/context';
import axe from 'axe-core';
import { describe, expect, it } from 'vitest';
import { Avatar, Message, Prose } from '../index';

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

  it('runs assistant content the full width, and keeps the parts spaced beside a tall avatar', () => {
    render(
      <div data-appearance="light" data-density="comfortable" style={{ inlineSize: '600px' }}>
        <Message.Root data-testid="assistant">
          <Message.Avatar data-testid="avatar" style={{ blockSize: '200px' }} />
          <Message.Header data-testid="header">Assistant</Message.Header>
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
    expect(box('content').top - box('header').bottom).toBeCloseTo(gap, 0);
    expect(box('actions').top - box('content').bottom).toBeCloseTo(gap, 0);
    expect(box('assistant').height).toBeCloseTo(200, 0);
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
