import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, expect, it } from 'vitest';
import '@tounsoo/todae/todae.css';
import { Providers } from '../Providers';
import { ChatComposerCard } from './ChatComposer';

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
      <ChatComposerCard />
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
