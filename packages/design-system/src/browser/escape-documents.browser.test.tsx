import { cleanup, render, waitFor } from '@testing-library/react';
import { userEvent } from '@vitest/browser/context';
import { createPortal } from 'react-dom';
import { useState } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { Menu } from '../components/Menu.js';

afterEach(() => {
  cleanup();
  for (const frame of document.querySelectorAll('iframe')) frame.remove();
});

function InFrame({ doc }: { doc: Document }) {
  const [open, setOpen] = useState(false);
  return createPortal(
    <Menu.Root open={open} onOpenChange={setOpen}>
      <Menu.Trigger variant="secondary">Actions</Menu.Trigger>
      <Menu.Content>
        <Menu.Item>Rename</Menu.Item>
        <Menu.Item>Delete</Menu.Item>
      </Menu.Content>
    </Menu.Root>,
    doc.body,
  );
}

describe('Escape in another document, in a browser', () => {
  it('closes a Menu rendered into an iframe and returns focus to its trigger there', async () => {
    const frame = document.createElement('iframe');
    document.body.append(frame);
    const doc = frame.contentDocument!;
    render(<InFrame doc={doc} />);
    const trigger = doc.querySelector<HTMLElement>('button[aria-haspopup="menu"]')!;
    trigger.focus();
    await userEvent.keyboard('{Enter}');
    const menu = () => doc.querySelector<HTMLElement>('[role="menu"]')!;
    await waitFor(() => expect(menu().hasAttribute('data-popover-open')).toBe(true));
    await waitFor(() => expect(doc.activeElement).not.toBe(trigger));
    await userEvent.keyboard('{Escape}');
    await waitFor(() => expect(menu().hasAttribute('data-popover-open')).toBe(false));
    expect(doc.activeElement).toBe(trigger);
  });
});
