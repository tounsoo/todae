import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { userEvent } from '@vitest/browser/context';
import { useRef, useState } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { BottomSheet } from '../components/BottomSheet.js';
import { Button } from '../components/Button.js';
import { Dialog } from '../components/Dialog.js';
import { Drawer } from '../components/Drawer.js';
import { Popover } from '../components/Popover.js';
import { usePopover } from '../hooks/usePopover.js';
import { getTabbables } from '../overlay/tabbables.js';

afterEach(cleanup);

type Kind = 'Dialog' | 'Drawer' | 'BottomSheet';
const shells = { Dialog, Drawer, BottomSheet } as const;

function ModalHarness({ kind }: { kind: Kind }) {
  const [open, setOpen] = useState(false);
  const target = useRef<HTMLInputElement>(null);
  const Shell = shells[kind];
  return (
    <div data-appearance="light" data-density="comfortable">
      <button type="button" onClick={() => setOpen(true)}>
        Open
      </button>
      <Shell.Root open={open} onOpenChange={setOpen} initialFocusRef={target}>
        <Shell.Title>Rename</Shell.Title>
        <button type="button">First</button>
        <input aria-label="Name" ref={target} />
      </Shell.Root>
    </div>
  );
}

function PopoverHarness() {
  const [open, setOpen] = useState(false);
  const target = useRef<HTMLInputElement>(null);
  const popover = usePopover({ open, onOpenChange: (next) => setOpen(next), initialFocusRef: target });
  return (
    <div data-appearance="light" data-density="comfortable">
      <Button.Root {...popover.getTriggerProps()}>Open</Button.Root>
      <Popover.Root {...popover.getPopoverProps()} role="dialog" aria-label="Rename">
        <button type="button">First</button>
        <input aria-label="Name" ref={target} />
      </Popover.Root>
    </div>
  );
}

describe('initialFocusRef on an overlay opened after mount', () => {
  it.each<Kind>(['Dialog', 'Drawer', 'BottomSheet'])('%s focuses the ref, not its first control', async (kind) => {
    render(<ModalHarness kind={kind} />);
    await userEvent.click(screen.getByRole('button', { name: 'Open' }));
    await waitFor(() => expect(document.querySelector('dialog')?.matches(':modal')).toBe(true));
    await waitFor(() => expect(document.activeElement).toBe(screen.getByRole('textbox', { name: 'Name' })));
  });

  it('Popover focuses the ref, not its first control', async () => {
    render(<PopoverHarness />);
    await userEvent.click(screen.getByRole('button', { name: 'Open' }));
    await waitFor(() => expect(screen.getByRole('dialog', { name: 'Rename' }).matches(':popover-open')).toBe(true));
    await waitFor(() => expect(document.activeElement).toBe(screen.getByRole('textbox', { name: 'Name' })));
  });
});

describe('initial focus in a modal opened from another modal', () => {
  it('lands on the first control of a Dialog mounted open beside the one it opens from', async () => {
    function Stacked() {
      const [second, setSecond] = useState(false);
      return (
        <div data-appearance="light" data-density="comfortable">
          <Dialog.Root open onOpenChange={() => undefined}>
            <Dialog.Title>Rename</Dialog.Title>
            <button type="button" onClick={() => setSecond(true)}>
              Delete
            </button>
          </Dialog.Root>
          {second && (
            <Dialog.Root open onOpenChange={setSecond}>
              <Dialog.Title>Confirm</Dialog.Title>
              <button type="button">Keep</button>
            </Dialog.Root>
          )}
        </div>
      );
    }
    render(<Stacked />);
    await userEvent.click(screen.getByRole('button', { name: 'Delete' }));
    await waitFor(() => expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Keep' })));
  });
});

describe('default initial focus on a radio group', () => {
  function RadioPopover() {
    const [open, setOpen] = useState(false);
    const popover = usePopover({ open, onOpenChange: (next) => setOpen(next) });
    return (
      <div data-appearance="light" data-density="comfortable">
        <Button.Root {...popover.getTriggerProps()}>Open</Button.Root>
        <Popover.Root {...popover.getPopoverProps()} role="dialog" aria-label="Size">
          <input type="radio" name="size" aria-label="Small" />
          <input type="radio" name="size" aria-label="Large" defaultChecked />
        </Popover.Root>
      </div>
    );
  }

  it('lands on the checked radio, where Tab would stop', async () => {
    render(<RadioPopover />);
    await userEvent.click(screen.getByRole('button', { name: 'Open' }));
    await waitFor(() => expect(document.activeElement).toBe(screen.getByRole('radio', { name: 'Large' })));
  });

  it.each([
    ['a checked radio', '<input type="radio" name="g" aria-label="One"><input type="radio" name="g" aria-label="Two" checked>', 'Two'],
    ['no checked radio', '<input type="radio" name="g" aria-label="One"><input type="radio" name="g" aria-label="Two">', 'One'],
    ['a disabled checked radio', '<input type="radio" name="g" aria-label="One"><input type="radio" name="g" aria-label="Two" checked disabled>', 'One'],
    ['a hidden checked radio', '<input type="radio" name="g" aria-label="One"><input type="radio" name="g" aria-label="Two" checked style="display:none">', 'One'],
    ['a checked radio with tabindex -1', '<input type="radio" name="g" aria-label="One"><input type="radio" name="g" aria-label="Two" checked tabindex="-1">', 'One'],
  ])('stops where the browser\'s forward Tab does, in a group with %s', async (_case, radios, name) => {
    const root = document.createElement('div');
    root.innerHTML = `<button type="button">Before</button>${radios}`;
    document.body.append(root);
    try {
      screen.getByRole('button', { name: 'Before' }).focus();
      await userEvent.keyboard('{Tab}');
      const landed = screen.getByRole('radio', { name });
      expect(document.activeElement).toBe(landed);
      expect(getTabbables(root).filter((el) => el.localName === 'input')).toEqual([landed]);
    } finally {
      root.remove();
    }
  });

  it('leaves out a group whose checked radio is outside the root, as Tab does', async () => {
    const outside = document.createElement('div');
    outside.innerHTML = '<input type="radio" name="g" aria-label="Outside" checked>';
    const root = document.createElement('div');
    root.innerHTML = '<button type="button">Before</button><input type="radio" name="g" aria-label="One"><button type="button">After</button>';
    document.body.append(root, outside);
    try {
      screen.getByRole('button', { name: 'Before' }).focus();
      await userEvent.keyboard('{Tab}');
      expect(document.activeElement).toBe(screen.getByRole('button', { name: 'After' }));
      expect(getTabbables(root).map((el) => el.textContent)).toEqual(['Before', 'After']);
    } finally {
      root.remove();
      outside.remove();
    }
  });

  it('counts only a modal dialog\'s own radios, since the page behind it is inert', async () => {
    const outside = document.createElement('div');
    outside.innerHTML = '<input type="radio" name="g" aria-label="Outside" checked>';
    const dialog = document.createElement('dialog');
    dialog.innerHTML = '<div><button type="button">Before</button><input type="radio" name="g" aria-label="One"></div>';
    document.body.append(outside, dialog);
    try {
      dialog.showModal();
      screen.getByRole('button', { name: 'Before' }).focus();
      await userEvent.keyboard('{Tab}');
      const one = screen.getByRole('radio', { name: 'One' });
      expect(document.activeElement).toBe(one);
      expect(getTabbables(dialog.firstElementChild as HTMLElement)).toContain(one);
    } finally {
      dialog.close();
      dialog.remove();
      outside.remove();
    }
  });

  it.each([
    ['an unchecked radio before the root', '<input type="radio" name="g" aria-label="Outside">', 'One'],
    ['a checked radio under aria-hidden', '<div aria-hidden="true"><input type="radio" name="g" aria-label="Outside" checked></div>', 'After'],
    ['a checked radio with tabindex -1', '<input type="radio" name="g" aria-label="Outside" checked tabindex="-1">', 'One'],
    ['a disabled checked radio', '<input type="radio" name="g" aria-label="Outside" checked disabled>', 'One'],
    ['a checked radio in an inert region', '<div inert><input type="radio" name="g" aria-label="Outside" checked></div>', 'One'],
  ])('matches forward Tab with %s', async (_case, page, name) => {
    const outside = document.createElement('div');
    outside.innerHTML = page;
    const root = document.createElement('div');
    root.innerHTML = '<button type="button">Before</button><input type="radio" name="g" aria-label="One"><button type="button">After</button>';
    document.body.append(outside, root);
    try {
      screen.getByRole('button', { name: 'Before' }).focus();
      await userEvent.keyboard('{Tab}');
      const nameOf = (el: Element | null) => el?.getAttribute('aria-label') ?? el?.textContent;
      expect(nameOf(document.activeElement)).toBe(name);
      expect(getTabbables(root).map(nameOf)).toEqual(name === 'One' ? ['Before', 'One', 'After'] : ['Before', 'After']);
    } finally {
      root.remove();
      outside.remove();
    }
  });

  it('bounds the group by the modal dialog when the root is in a non-modal dialog inside it', async () => {
    const outside = document.createElement('div');
    outside.innerHTML = '<input type="radio" name="g" aria-label="Outside" checked>';
    const modal = document.createElement('dialog');
    modal.innerHTML = '<dialog open><div><button type="button">Before</button><input type="radio" name="g" aria-label="One"></div></dialog>';
    document.body.append(outside, modal);
    try {
      modal.showModal();
      screen.getByRole('button', { name: 'Before' }).focus();
      await userEvent.keyboard('{Tab}');
      const one = screen.getByRole('radio', { name: 'One' });
      expect(document.activeElement).toBe(one);
      expect(getTabbables(modal.querySelector('div')!)).toContain(one);
    } finally {
      modal.close();
      modal.remove();
      outside.remove();
    }
  });

  it('lists no radio of a group whose checked radio is under aria-hidden in the root, though Tab stops there', async () => {
    const root = document.createElement('div');
    root.innerHTML =
      '<button type="button">Before</button><input type="radio" name="g" aria-label="One"><span aria-hidden="true"><input type="radio" name="g" aria-label="Two" checked></span><button type="button">After</button>';
    document.body.append(root);
    try {
      screen.getByRole('button', { name: 'Before' }).focus();
      await userEvent.keyboard('{Tab}');
      expect(document.activeElement?.getAttribute('aria-label')).toBe('Two');
      expect(getTabbables(root).map((el) => el.textContent)).toEqual(['Before', 'After']);
    } finally {
      root.remove();
    }
  });
});
