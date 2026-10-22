import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { StrictMode, useState } from 'react';
import { createPortal } from 'react-dom';
import { afterEach, expect, it, vi } from 'vitest';
import { Dialog } from '../components/Dialog.js';
import { useInlineEdit } from './useInlineEdit.js';

afterEach(cleanup);

function Rename({
  initial = 'Q3 report',
  accept = (draft: string) => draft.trim() !== '',
  onCancel,
}: {
  initial?: string;
  accept?: (draft: string) => boolean;
  onCancel?: () => void;
}) {
  const [name, setName] = useState(initial);
  const edit = useInlineEdit({
    value: name,
    onCommit: (draft) => {
      if (!accept(draft)) return false;
      setName(draft);
    },
    onCancel,
  });
  return edit.editing ? (
    <div {...edit.getGroupProps()}>
      <input aria-label="Name" {...edit.getInputProps()} />
      <button onClick={edit.commit}>Save</button>
      <button onClick={edit.cancel}>Cancel</button>
    </div>
  ) : (
    <>
      <span>{name}</span>
      <button {...edit.getTriggerProps()}>Rename</button>
    </>
  );
}

const flush = () => act(() => Promise.resolve());
const field = () => screen.getByRole('textbox', { name: 'Name' }) as HTMLInputElement;
const rename = () => screen.getByRole('button', { name: 'Rename' });

async function open() {
  rename().focus();
  act(() => rename().click());
  await flush();
}

it('opens with the value, focuses the input and selects its text', async () => {
  render(<Rename />);
  await open();
  expect(field().value).toBe('Q3 report');
  expect(document.activeElement).toBe(field());
  expect([field().selectionStart, field().selectionEnd]).toEqual([0, 'Q3 report'.length]);
});

it('commits on Enter and returns focus to the trigger', async () => {
  render(<Rename />);
  await open();
  fireEvent.change(field(), { target: { value: 'Q4 report' } });
  const enter = fireEvent.keyDown(field(), { key: 'Enter' });
  // Cancelled, so an enclosing form doesn't submit.
  expect(enter).toBe(false);
  await flush();
  expect(screen.getByText('Q4 report')).toBeTruthy();
  expect(document.activeElement).toBe(rename());
});

it('leaves an Enter that ends an IME composition to the input', async () => {
  render(<Rename />);
  await open();
  fireEvent.change(field(), { target: { value: '보고서' } });
  fireEvent.keyDown(field(), { key: 'Enter', isComposing: true });
  // Safari sends the Enter that ends a composition after compositionend.
  fireEvent.keyDown(field(), { key: 'Enter', keyCode: 229 });
  expect(field().value).toBe('보고서');
});

it('leaves an Escape that ends an IME composition to the input', async () => {
  const onCancel = vi.fn();
  render(<Rename onCancel={onCancel} />);
  await open();
  fireEvent.change(field(), { target: { value: '보고' } });
  fireEvent.keyDown(field(), { key: 'Escape', isComposing: true });
  await flush();
  expect(onCancel).not.toHaveBeenCalled();
  expect(field().value).toBe('보고');
  // keyCode 229 alone counts only for keys that commit, and Escape doesn't.
  fireEvent.keyDown(field(), { key: 'Escape', keyCode: 229 });
  await flush();
  expect(onCancel).toHaveBeenCalledTimes(1);
});

it('leaves an Enter a handler before it took to that handler', async () => {
  render(<Rename />);
  await open();
  fireEvent.change(field(), { target: { value: 'Q4 report' } });
  const enter = new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true });
  enter.preventDefault();
  act(() => void field().dispatchEvent(enter));
  await flush();
  expect(field().value).toBe('Q4 report');
});

it('opens with a given draft, and start does nothing while editing', async () => {
  function Retry() {
    const edit = useInlineEdit({ value: 'Q3 report', onCommit: () => undefined });
    return (
      <>
        <button onClick={() => edit.start('Q4 report')}>Try again</button>
        {edit.editing && <input aria-label="Name" {...edit.getInputProps()} />}
      </>
    );
  }
  render(<Retry />);
  const retry = screen.getByRole('button', { name: 'Try again' });
  act(() => retry.click());
  await flush();
  expect(field().value).toBe('Q4 report');
  fireEvent.change(field(), { target: { value: 'Q5 report' } });
  act(() => retry.click());
  await flush();
  expect(field().value).toBe('Q5 report');
});

it('cancels on Escape, restores the value and returns focus', async () => {
  const onCancel = vi.fn();
  render(<Rename onCancel={onCancel} />);
  await open();
  fireEvent.change(field(), { target: { value: 'Draft' } });
  fireEvent.keyDown(field(), { key: 'Escape' });
  await flush();
  expect(onCancel).toHaveBeenCalledTimes(1);
  expect(screen.getByText('Q3 report')).toBeTruthy();
  expect(document.activeElement).toBe(rename());
});

it('cancels the edit before the dialog it sits in closes', async () => {
  const onOpenChange = vi.fn();
  render(
    <Dialog.Root open onOpenChange={onOpenChange} aria-label="Files">
      <Rename />
    </Dialog.Root>,
  );
  const trigger = screen.getByRole('button', { name: 'Rename', hidden: true });
  trigger.focus();
  act(() => trigger.click());
  await flush();
  const input = screen.getByRole('textbox', { name: 'Name', hidden: true });
  fireEvent.keyDown(input, { key: 'Escape' });
  await flush();
  expect(screen.queryByRole('textbox', { name: 'Name', hidden: true })).toBeNull();
  expect(onOpenChange).not.toHaveBeenCalled();
  // jsdom sends no close request for the key, so the second Escape sends it by hand.
  const second = fireEvent.keyDown(screen.getByRole('button', { name: 'Rename', hidden: true }), { key: 'Escape' });
  expect(second).toBe(true);
  act(() => void document.querySelector('dialog')!.dispatchEvent(new Event('cancel', { cancelable: true })));
  expect(onOpenChange).toHaveBeenCalledWith(false, 'escape');
});

it("cancels the edit on a modal's close request, such as the back gesture", async () => {
  const onOpenChange = vi.fn();
  render(
    <Dialog.Root open onOpenChange={onOpenChange} aria-label="Files">
      <Rename />
    </Dialog.Root>,
  );
  const trigger = screen.getByRole('button', { name: 'Rename', hidden: true });
  trigger.focus();
  act(() => trigger.click());
  await flush();
  const dialog = document.querySelector('dialog')!;
  act(() => void dialog.dispatchEvent(new Event('cancel', { cancelable: true })));
  expect(screen.queryByRole('textbox', { name: 'Name', hidden: true })).toBeNull();
  expect(onOpenChange).not.toHaveBeenCalled();
});

it('closes without calling onCommit when the draft is unchanged', async () => {
  const accept = vi.fn(() => true);
  render(<Rename accept={accept} />);
  await open();
  fireEvent.keyDown(field(), { key: 'Enter' });
  await flush();
  expect(accept).not.toHaveBeenCalled();
  expect(document.activeElement).toBe(rename());
});

it('keeps editing when onCommit returns false', async () => {
  render(<Rename />);
  await open();
  fireEvent.change(field(), { target: { value: '  ' } });
  fireEvent.keyDown(field(), { key: 'Enter' });
  await flush();
  expect(document.activeElement).toBe(field());
});

it('gives focus back to the input when a Save button with focus is turned down', async () => {
  render(<Rename />);
  await open();
  fireEvent.change(field(), { target: { value: '' } });
  const save = screen.getByRole('button', { name: 'Save' });
  save.focus();
  act(() => save.click());
  await flush();
  expect(document.activeElement).toBe(field());
});

it('commits when focus leaves the group, and leaves focus where it went', async () => {
  render(
    <>
      <Rename />
      <button>Elsewhere</button>
    </>,
  );
  await open();
  fireEvent.change(field(), { target: { value: 'Q4 report' } });
  const elsewhere = screen.getByRole('button', { name: 'Elsewhere' });
  act(() => elsewhere.focus());
  await flush();
  expect(screen.getByText('Q4 report')).toBeTruthy();
  expect(document.activeElement).toBe(elsewhere);
});

it('puts the value back when focus leaving the group is turned down', async () => {
  const onCancel = vi.fn();
  render(
    <>
      <Rename onCancel={onCancel} />
      <button>Elsewhere</button>
    </>,
  );
  await open();
  fireEvent.change(field(), { target: { value: '' } });
  const elsewhere = screen.getByRole('button', { name: 'Elsewhere' });
  act(() => elsewhere.focus());
  await flush();
  expect(onCancel).toHaveBeenCalledTimes(1);
  expect(screen.getByText('Q3 report')).toBeTruthy();
  expect(document.activeElement).toBe(elsewhere);
});

it('keeps editing when the window loses focus', async () => {
  render(<Rename />);
  await open();
  fireEvent.change(field(), { target: { value: 'Q4 report' } });
  const hasFocus = vi.spyOn(document, 'hasFocus').mockReturnValue(false);
  fireEvent.blur(field(), { relatedTarget: null });
  hasFocus.mockRestore();
  await flush();
  expect(field().value).toBe('Q4 report');
});

it('keeps focus in the input while anything but a text field in the group is pressed, so Cancel cancels', async () => {
  const onCancel = vi.fn();
  const accept = vi.fn(() => true);
  render(<Rename onCancel={onCancel} accept={accept} />);
  await open();
  fireEvent.change(field(), { target: { value: 'Q4 report' } });
  const cancel = screen.getByRole('button', { name: 'Cancel' });
  expect(fireEvent.mouseDown(cancel)).toBe(false);
  expect(fireEvent.mouseDown(field())).toBe(true);
  expect(fireEvent.mouseDown(field().parentElement!)).toBe(false);
  act(() => cancel.click());
  await flush();
  expect(onCancel).toHaveBeenCalledTimes(1);
  expect(accept).not.toHaveBeenCalled();
  expect(document.activeElement).toBe(rename());
});

it('cancels on a pointer click of Cancel', async () => {
  const onCancel = vi.fn();
  const accept = vi.fn(() => true);
  render(<Rename onCancel={onCancel} accept={accept} />);
  await open();
  fireEvent.change(field(), { target: { value: 'Q4 report' } });
  const cancel = screen.getByRole('button', { name: 'Cancel' });
  fireEvent.mouseDown(cancel);
  // A pointer click counts one press, which useFocusHandoff answers by focusing Cancel.
  act(() => void cancel.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, detail: 1 })));
  await flush();
  expect(onCancel).toHaveBeenCalledTimes(1);
  expect(accept).not.toHaveBeenCalled();
  expect(document.activeElement).toBe(rename());
});

it('lets a press on another text field or select in the group through, but not on a checkbox or button input', async () => {
  function WithUnit() {
    const edit = useInlineEdit({ value: '3', onCommit: () => undefined });
    return edit.editing ? (
      <div {...edit.getGroupProps()}>
        <input aria-label="Name" {...edit.getInputProps()} />
        <select aria-label="Unit">
          <option>kg</option>
        </select>
        <input type="checkbox" aria-label="Also rename the file" />
        <input type="button" value="Undo" />
        <input type="range" aria-label="Size" />
      </div>
    ) : (
      <button {...edit.getTriggerProps()}>Rename</button>
    );
  }
  render(<WithUnit />);
  await open();
  expect(fireEvent.mouseDown(screen.getByRole('combobox', { name: 'Unit' }))).toBe(true);
  // Safari doesn't focus a clicked checkbox, so it is kept from taking focus to the page.
  expect(fireEvent.mouseDown(screen.getByRole('checkbox'))).toBe(false);
  expect(fireEvent.mouseDown(screen.getByRole('button', { name: 'Undo' }))).toBe(false);
  // A slider moves on the press itself.
  expect(fireEvent.mouseDown(screen.getByRole('slider', { name: 'Size' }))).toBe(true);
});

it('keeps focus in the input on a press in a group inside an editable ancestor', async () => {
  render(
    <div contentEditable suppressContentEditableWarning>
      <Rename />
    </div>,
  );
  await open();
  expect(fireEvent.mouseDown(screen.getByRole('button', { name: 'Cancel' }))).toBe(false);
});

it('keeps focus in the input on a press of a button inside an editable element in the group', async () => {
  function WithNote() {
    const edit = useInlineEdit({ value: 'Q3 report', onCommit: () => undefined });
    return edit.editing ? (
      <div {...edit.getGroupProps()}>
        <input aria-label="Name" {...edit.getInputProps()} />
        <div contentEditable suppressContentEditableWarning>
          <button>Bold</button>
        </div>
      </div>
    ) : (
      <button {...edit.getTriggerProps()}>Rename</button>
    );
  }
  render(<WithNote />);
  await open();
  expect(fireEvent.mouseDown(screen.getByRole('button', { name: 'Bold' }))).toBe(false);
});

it('commits when focus leaves to nothing while the document keeps focus', async () => {
  render(<Rename />);
  await open();
  fireEvent.change(field(), { target: { value: 'Q4 report' } });
  const hasFocus = vi.spyOn(document, 'hasFocus').mockReturnValue(true);
  fireEvent.blur(field(), { relatedTarget: null });
  hasFocus.mockRestore();
  await flush();
  expect(screen.getByText('Q4 report')).toBeTruthy();
});

it("leaves a press in a portal rendered from the group to the portal", async () => {
  function WithPortal() {
    const edit = useInlineEdit({ value: 'Q3 report', onCommit: () => undefined });
    return edit.editing ? (
      <div {...edit.getGroupProps()}>
        <input aria-label="Name" {...edit.getInputProps()} />
        {createPortal(<button>Option</button>, document.body)}
      </div>
    ) : (
      <button {...edit.getTriggerProps()}>Rename</button>
    );
  }
  render(<WithPortal />);
  await open();
  expect(fireEvent.mouseDown(screen.getByRole('button', { name: 'Option' }))).toBe(true);
});

it('returns focus to the trigger when both branches render the same element', async () => {
  function SameWrapper() {
    const [name, setName] = useState('Q3 report');
    const edit = useInlineEdit({ value: name, onCommit: setName });
    return edit.editing ? (
      <div {...edit.getGroupProps()}>
        <input aria-label="Name" {...edit.getInputProps()} />
      </div>
    ) : (
      <div>
        <button {...edit.getTriggerProps()}>Rename</button>
      </div>
    );
  }
  render(<SameWrapper />);
  await open();
  fireEvent.change(field(), { target: { value: 'Q4 report' } });
  fireEvent.keyDown(field(), { key: 'Enter' });
  await flush();
  expect(document.activeElement).toBe(rename());
});

it('keeps the caret where the person put it as the parent renders again', async () => {
  const { rerender } = render(<Rename />);
  await open();
  fireEvent.change(field(), { target: { value: 'Q4 report' } });
  field().setSelectionRange(2, 2);
  rerender(<Rename onCancel={() => undefined} />);
  await flush();
  expect([field().selectionStart, field().selectionEnd]).toEqual([2, 2]);
});

it('commits once under StrictMode', async () => {
  const accept = vi.fn(() => true);
  render(
    <StrictMode>
      <Rename accept={accept} />
    </StrictMode>,
  );
  await open();
  expect(document.activeElement).toBe(field());
  fireEvent.change(field(), { target: { value: 'Q4 report' } });
  fireEvent.keyDown(field(), { key: 'Enter' });
  await flush();
  expect(accept).toHaveBeenCalledTimes(1);
  expect(screen.getByText('Q4 report')).toBeTruthy();
  expect(document.activeElement).toBe(rename());
});
