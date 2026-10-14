import { render, screen } from '@testing-library/react';
import { cdp } from '@vitest/browser/context';
import axe from 'axe-core';
import { describe, expect, it } from 'vitest';
import { Avatar, Message, Prose, Spinner } from '../index';

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
/** Every element in `root`, itself included, that draws a caret, so a stray or second caret fails too. */
const carets = (root: Element) => [root, ...root.querySelectorAll('*')].filter(hasCaret);

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

  it.each([
    [
      'a final paragraph',
      <>
        <p>Intro</p>
        <p data-caret>End</p>
      </>,
    ],
    [
      'a nested item of a tight list',
      <ul>
        <li>One</li>
        <li>
          Two
          <ul>
            <li data-caret>Nested</li>
          </ul>
        </li>
      </ul>,
    ],
    [
      'the paragraph of a loose list item',
      <ul>
        <li>
          <p>a</p>
        </li>
        <li>
          <p data-caret>b</p>
        </li>
      </ul>,
    ],
    [
      'a final heading',
      <>
        <p>Intro</p>
        <h3 data-caret>Next</h3>
      </>,
    ],
    [
      'the last cell of a table',
      <table>
        <tbody>
          <tr>
            <td>a</td>
            <td data-caret>b</td>
          </tr>
        </tbody>
      </table>,
    ],
    [
      'a paragraph ending an open details',
      <details open>
        <summary>Thinking</summary>
        <p data-caret>Shown</p>
      </details>,
    ],
    [
      'a paragraph ending a block quote',
      <blockquote>
        <p data-caret>Quoted</p>
      </blockquote>,
    ],
  ])('puts the only caret after %s', (_, content) => {
    render(
      <div data-appearance="light" data-density="comfortable">
        <Message.Root streaming>
          <Message.Content data-testid="content">
            <Prose.Root>{content}</Prose.Root>
          </Message.Content>
        </Message.Root>
      </div>,
    );
    const content_ = screen.getByTestId('content');
    expect(carets(content_)).toEqual([content_.querySelector('[data-caret]')]);
  });

  it('puts the caret right after content that is only text', () => {
    render(
      <div data-appearance="light" data-density="comfortable">
        <Message.Root streaming>
          <Message.Content data-testid="content">Plain text so far</Message.Content>
        </Message.Root>
      </div>,
    );
    expect(carets(screen.getByTestId('content'))).toEqual([screen.getByTestId('content')]);
  });

  it.each([
    ['empty content', null],
    [
      'text with an element in it',
      <>
        Plain <b>text</b> so far
      </>,
    ],
    [
      'a code block',
      <>
        <p>Run</p>
        <pre>
          <code>{'pnpm test\n'}</code>
        </pre>
      </>,
    ],
    [
      'a rule',
      <>
        <p>Done</p>
        <hr />
      </>,
    ],
    ['a wrapper around text', <div>Wrapped text</div>],
    [
      'a list item ending in a code block',
      <ol>
        <li>
          Run
          <pre>
            <code>{'pnpm test\n'}</code>
          </pre>
        </li>
      </ol>,
    ],
    [
      'a list item ending in a rule',
      <ul>
        <li>
          Done
          <hr />
        </li>
      </ul>,
    ],
    [
      'a list item ending in a code block with a copy button',
      <ul>
        <li>
          Run
          <div>
            <pre>
              <code>x</code>
            </pre>
            <button type="button">Copy</button>
          </div>
        </li>
      </ul>,
    ],
    [
      'a closed details',
      <>
        <p>Shown</p>
        <details>
          <summary>Thinking</summary>
          <p>Hidden</p>
        </details>
      </>,
    ],
    ['Spinner dots', <Spinner.Root variant="dots" aria-label="Assistant is typing" />],
    ['an empty Prose', <Prose.Root />],
    [
      'an empty cell padding a row',
      <table>
        <tbody>
          <tr>
            <td>1</td>
            <td>2</td>
            <td />
          </tr>
        </tbody>
      </table>,
    ],
  ])('draws no caret after %s', (_, content) => {
    render(
      <div data-appearance="light" data-density="comfortable">
        <Message.Root streaming>
          <Message.Content data-testid="content">{content}</Message.Content>
        </Message.Root>
      </div>,
    );
    expect(carets(screen.getByTestId('content'))).toEqual([]);
  });

  it('draws the caret only in the last content, and only while streaming', async () => {
    const { rerender } = render(
      <div data-appearance="light" data-density="comfortable">
        <Message.Root data-testid="message" streaming>
          <Message.Content>
            <p>Reasoning</p>
          </Message.Content>
          <Message.Content>
            <p data-testid="answer">Answer</p>
          </Message.Content>
          <Message.Actions>
            <button type="button">Stop</button>
          </Message.Actions>
        </Message.Root>
      </div>,
    );
    const message = screen.getByTestId('message');
    expect(carets(message)).toEqual([screen.getByTestId('answer')]);
    const style = caret(screen.getByTestId('answer'));
    expect(style.display).toBe('inline-block');
    expect(parseFloat(style.borderInlineStartWidth)).toBeGreaterThan(0);
    expect(style.animationName).toContain('todae-message-caret');
    expect(style.animationIterationCount).toBe('infinite');
    try {
      await emulateMedia([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
      expect(caret(screen.getByTestId('answer')).animationIterationCount).toBe('0');
      expect(carets(message)).toEqual([screen.getByTestId('answer')]);
    } finally {
      await emulateMedia([]);
    }
    rerender(
      <div data-appearance="light" data-density="comfortable">
        <Message.Root data-testid="message">
          <Message.Content>
            <p>Reasoning</p>
          </Message.Content>
          <Message.Content>
            <p data-testid="answer">Answer</p>
          </Message.Content>
        </Message.Root>
      </div>,
    );
    expect(carets(screen.getByTestId('message'))).toEqual([]);
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
