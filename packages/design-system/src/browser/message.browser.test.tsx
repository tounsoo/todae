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

const caret = (el: Element) => getComputedStyle(el, '::after');
const hasCaret = (el: Element) => caret(el).content !== 'none' && caret(el).content !== 'normal';

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

  it('draws the caret after the last text only while streaming', async () => {
    const { rerender } = render(
      <div data-appearance="light" data-density="comfortable">
        <Message.Root data-testid="plain" streaming>
          <Message.Content data-testid="plain-content">
            Plain <b data-testid="bold">text</b> so far
          </Message.Content>
        </Message.Root>
        <Message.Root streaming>
          <Message.Content>
            <Prose.Root>
              <p data-testid="first">First</p>
              <ul>
                <li data-testid="item-1">One</li>
                <li data-testid="item-2">
                  Two
                  <ul>
                    <li data-testid="nested">Nested</li>
                  </ul>
                </li>
              </ul>
            </Prose.Root>
          </Message.Content>
        </Message.Root>
        <Message.Root>
          <Message.Content>
            <p data-testid="done">Done</p>
          </Message.Content>
        </Message.Root>
      </div>,
    );
    expect(hasCaret(screen.getByTestId('plain-content'))).toBe(true);
    expect(hasCaret(screen.getByTestId('bold'))).toBe(false);
    expect(hasCaret(screen.getByTestId('nested'))).toBe(true);
    for (const id of ['first', 'item-1', 'item-2', 'done']) expect(hasCaret(screen.getByTestId(id)), id).toBe(false);
    const nested = caret(screen.getByTestId('nested'));
    expect(nested.display).toBe('inline-block');
    expect(parseFloat(nested.borderInlineStartWidth)).toBeGreaterThan(0);
    expect(nested.animationName).toContain('todae-message-caret');
    expect(nested.animationIterationCount).toBe('infinite');
    try {
      await emulateMedia([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
      expect(caret(screen.getByTestId('nested')).animationIterationCount).toBe('0');
      expect(hasCaret(screen.getByTestId('nested'))).toBe(true);
    } finally {
      await emulateMedia([]);
    }
    rerender(
      <div data-appearance="light" data-density="comfortable">
        <Message.Root data-testid="plain">
          <Message.Content data-testid="plain-content">Plain text</Message.Content>
        </Message.Root>
      </div>,
    );
    expect(hasCaret(screen.getByTestId('plain-content'))).toBe(false);
  });

  it('puts the caret in the last cell of a table, and none after a code block, a rule or a wrapper', () => {
    render(
      <div data-appearance="light" data-density="comfortable">
        <Message.Root streaming>
          <Message.Content>
            <p data-testid="intro">Intro</p>
            <table>
              <tbody>
                <tr>
                  <td data-testid="a">a</td>
                  <td data-testid="b">b</td>
                </tr>
              </tbody>
            </table>
          </Message.Content>
        </Message.Root>
        <Message.Root streaming>
          <Message.Content data-testid="code-content">
            <p data-testid="before-code">Run</p>
            <pre data-testid="code">
              <code>{'pnpm test\n'}</code>
            </pre>
          </Message.Content>
        </Message.Root>
        <Message.Root streaming>
          <Message.Content data-testid="rule-content">
            <p data-testid="before-rule">Done</p>
            <hr />
          </Message.Content>
        </Message.Root>
        <Message.Root streaming>
          <Message.Content data-testid="wrapper-content">
            <div data-testid="wrapper">Wrapped text</div>
          </Message.Content>
        </Message.Root>
        <Message.Root streaming>
          <Message.Content>
            <ol>
              <li data-testid="step-code">
                Run
                <pre>
                  <code>{'pnpm test\n'}</code>
                </pre>
              </li>
            </ol>
          </Message.Content>
        </Message.Root>
        <Message.Root streaming>
          <Message.Content>
            <ul>
              <li data-testid="step-rule">
                Done
                <hr />
              </li>
            </ul>
          </Message.Content>
        </Message.Root>
        <Message.Root streaming>
          <Message.Content>
            <p data-testid="shown">Shown</p>
            <details>
              <summary>Thinking</summary>
              <p data-testid="hidden">Hidden</p>
            </details>
          </Message.Content>
        </Message.Root>
      </div>,
    );
    expect(hasCaret(screen.getByTestId('b'))).toBe(true);
    expect(hasCaret(screen.getByTestId('a'))).toBe(false);
    expect(hasCaret(screen.getByTestId('intro'))).toBe(false);
    // Rendered markdown ends code with a newline, so a caret there would sit on a line of its own.
    for (const id of [
      'code',
      'before-code',
      'code-content',
      'before-rule',
      'rule-content',
      'wrapper',
      'wrapper-content',
      'hidden',
      'shown',
    ]) {
      expect(hasCaret(screen.getByTestId(id)), id).toBe(false);
    }
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
