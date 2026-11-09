import { cleanup, render, screen } from '@testing-library/react';
import { cdp, userEvent } from 'vitest/browser';
import { afterEach, expect, it } from 'vitest';
import '@tounsoo/todae/todae.css';
import { Providers } from '../Providers';
import ChatComposer from '../../examples/recipes/chat-composer-mentions/ChatComposer';

afterEach(cleanup);

function openPeek(): HTMLElement | null {
  return document.querySelector<HTMLElement>('[popover]:popover-open');
}

function placeCaretInMention() {
  const field = screen.getByRole('textbox', { name: 'Message' }) as HTMLTextAreaElement;
  const at = field.value.indexOf('@Mina Park');
  field.focus();
  field.setSelectionRange(at + 2, at + 2);
  field.dispatchEvent(new Event('selectionchange'));
  return field;
}

it('closes the caret peek on an outside pointer and on blur', async () => {
  render(
    <Providers>
      <ChatComposer />
    </Providers>,
  );
  placeCaretInMention();
  await expect.poll(() => openPeek()?.textContent ?? '').toContain('Design systems');

  document.body.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, composed: true }));
  await expect.poll(() => openPeek()).toBeNull();

  const field = screen.getByRole('textbox', { name: 'Message' }) as HTMLTextAreaElement;
  const at = field.value.indexOf('@Mina Park');
  field.setSelectionRange(0, 0);
  field.dispatchEvent(new Event('selectionchange'));
  await expect.poll(() => openPeek()).toBeNull();
  field.focus();
  field.setSelectionRange(at + 2, at + 2);
  field.dispatchEvent(new Event('selectionchange'));
  await expect.poll(() => openPeek()?.textContent ?? '').toContain('Design systems');
  field.blur();
  await expect.poll(() => openPeek()).toBeNull();
});

it('closes the caret peek with Escape and keeps focus in the field', async () => {
  renderComposer();
  const field = placeCaretInMention();
  await expect.poll(() => openPeek()?.textContent ?? '').toContain('Design systems');
  await userEvent.keyboard('{Escape}');
  await expect.poll(() => openPeek()).toBeNull();
  expect(document.activeElement).toBe(field);
});

function renderComposer() {
  render(
    <Providers>
      <ChatComposer />
    </Providers>,
  );
  return screen.getByRole('textbox', { name: 'Message' }) as HTMLTextAreaElement;
}

it('keeps focus in the field after sending from the Send button', async () => {
  const field = renderComposer();
  const send = screen.getByRole('button', { name: 'Send' });
  send.focus();
  await userEvent.keyboard('{Enter}');
  await expect.poll(() => field.value).toBe('');
  expect(document.activeElement).toBe(field);
});

it('moves focus to the field when the last attachment is removed', async () => {
  const field = renderComposer();
  screen.getByRole('button', { name: 'Remove peek-card.png' }).focus();
  await userEvent.keyboard('{Enter}');
  await expect.poll(() => screen.queryAllByRole('button', { name: /^Remove / }).length).toBe(1);
  screen.getByRole('button', { name: 'Remove m8-contrast.pdf' }).focus();
  await userEvent.keyboard('{Enter}');
  await expect.poll(() => screen.queryAllByRole('button', { name: /^Remove / }).length).toBe(0);
  expect(document.activeElement).toBe(field);
});

it('says when no one matches, and keeps the list the field points at', async () => {
  const field = renderComposer();
  await userEvent.click(field);
  field.setSelectionRange(field.value.length, field.value.length);
  await userEvent.keyboard(' @zzz');
  await expect.poll(() => screen.getByRole('status').textContent).toBe('No one matches');
  const list = document.getElementById(field.getAttribute('aria-controls') ?? '');
  expect(list?.getAttribute('role')).toBe('listbox');
  expect(list?.hidden).toBe(true);
});

it('describes the field with what the caret peek says, as the browser computes it', async () => {
  const field = renderComposer();
  const at = field.value.indexOf('@Mina Park');
  field.focus();
  field.setSelectionRange(at + 2, at + 2);
  field.dispatchEvent(new Event('selectionchange'));
  await expect.poll(() => openPeek()?.textContent ?? '').toContain('Design systems');
  // Chromium's own accessibility tree, since the peek is inert and its text alone would not count.
  // Tests run in an iframe, so read every frame's tree.
  type AXNode = { role?: { value?: string }; name?: { value?: string }; description?: { value?: string } };
  type Frame = { frame: { id: string }; childFrames?: Frame[] };
  const session = cdp();
  await session.send('Accessibility.enable');
  const description = async () => {
    const { frameTree } = (await session.send('Page.getFrameTree')) as { frameTree: Frame };
    const frames: string[] = [];
    const walk = (node: Frame) => {
      frames.push(node.frame.id);
      node.childFrames?.forEach(walk);
    };
    walk(frameTree);
    for (const frameId of frames) {
      const { nodes } = (await session.send('Accessibility.getFullAXTree', { frameId })) as { nodes: AXNode[] };
      const box = nodes.find((node) => node.role?.value === 'textbox' && node.name?.value === 'Message');
      if (box) return String(box.description?.value ?? '');
    }
    return '';
  };
  await expect.poll(description).toBe('Mina Park, Design systems, active now');
});
