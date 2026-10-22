import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { userEvent } from '@vitest/browser/context';
import { useState } from 'react';
import { afterEach, expect, it, vi } from 'vitest';
import { Dialog } from '../components/Dialog.js';
import { useInlineEdit } from '../hooks/useInlineEdit.js';

afterEach(cleanup);

function Rename({ onCancel }: { onCancel?: () => void }) {
  const [name, setName] = useState('Q3 report');
  const edit = useInlineEdit({ value: name, onCommit: setName, onCancel });
  return edit.editing ? (
    <div {...edit.getGroupProps()}>
      <input aria-label="Name" {...edit.getInputProps()} />
      <button onClick={edit.cancel}>Cancel</button>
    </div>
  ) : (
    <>
      <span>{name}</span>
      <button {...edit.getTriggerProps()}>Rename</button>
    </>
  );
}

it('cancels on Escape in a dialog, which stays open until the next Escape', async () => {
  const onOpenChange = vi.fn();
  render(
    <Dialog.Root open onOpenChange={onOpenChange} aria-label="Files">
      <Rename />
    </Dialog.Root>,
  );
  await userEvent.click(screen.getByRole('button', { name: 'Rename' }));
  await userEvent.keyboard('Draft{Escape}');
  expect(screen.getByText('Q3 report')).toBeVisible();
  await waitFor(() => expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Rename' })));
  await new Promise((resolve) => setTimeout(resolve, 100));
  expect(onOpenChange).not.toHaveBeenCalled();
  await userEvent.keyboard('{Escape}');
  await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false, 'escape'));
});

it('cancels on a click of Cancel without saving first', async () => {
  const onCancel = vi.fn();
  render(<Rename onCancel={onCancel} />);
  await userEvent.click(screen.getByRole('button', { name: 'Rename' }));
  await userEvent.keyboard('Draft');
  await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));
  expect(onCancel).toHaveBeenCalledTimes(1);
  expect(screen.getByText('Q3 report')).toBeVisible();
  await waitFor(() => expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Rename' })));
});

it('commits when Tab moves focus out of the edit, and leaves focus there', async () => {
  render(
    <>
      <Rename />
      <button>Elsewhere</button>
    </>,
  );
  await userEvent.click(screen.getByRole('button', { name: 'Rename' }));
  await userEvent.keyboard('Q4 report');
  await userEvent.tab();
  await userEvent.tab();
  const elsewhere = screen.getByRole('button', { name: 'Elsewhere' });
  await waitFor(() => expect(screen.getByText('Q4 report')).toBeVisible());
  expect(document.activeElement).toBe(elsewhere);
});
