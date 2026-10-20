import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { cdp, userEvent } from '@vitest/browser/context';
import { afterEach, describe, expect, it } from 'vitest';
import {
  BottomSheet,
  Button,
  Dialog,
  Field,
  Label,
  OptionList,
  Popover,
  useCombobox,
  type ComboboxOption,
} from '../index.js';

/** vitest types the session without its methods; Playwright's session has `send`. */
const session = () => cdp() as unknown as { send(method: string, params?: object): Promise<unknown> };

type AXNode = { role?: { value?: string }; name?: { value?: string } };
type FrameTree = { frame: { id: string }; childFrames?: FrameTree[] };

function frameIds(tree: FrameTree): string[] {
  return [tree.frame.id, ...(tree.childFrames ?? []).flatMap(frameIds)];
}

/** The name Chromium's own accessibility tree gives each node of a role, in every frame. */
async function axNames(role: string): Promise<string[]> {
  const { frameTree } = (await session().send('Page.getFrameTree')) as { frameTree: FrameTree };
  const names: string[] = [];
  for (const frameId of frameIds(frameTree)) {
    const { nodes } = (await session().send('Accessibility.getFullAXTree', { frameId })) as { nodes: AXNode[] };
    for (const node of nodes) if (node.role?.value === role) names.push(node.name?.value ?? '');
  }
  return names;
}

afterEach(cleanup);

const FRAMEWORKS: ComboboxOption[] = [
  { value: 'react', label: 'React' },
  { value: 'redux', label: 'Redux' },
];

function LabelledBox() {
  const cb = useCombobox({ options: FRAMEWORKS, presentation: 'popover' });
  return (
    <div data-appearance="light" data-density="comfortable">
      <Label.Root {...cb.getLabelProps()}>Framework</Label.Root>
      <Field.Root {...cb.getAnchorProps()}>
        <Field.TextInput {...cb.getInputProps()} />
      </Field.Root>
      <Popover.Root {...cb.getPopoverProps()}>
        <OptionList.Root {...cb.getListboxProps()}>
          {cb.items.map((item) => (
            <OptionList.Option key={item.id} {...cb.getOptionProps(item)} />
          ))}
        </OptionList.Root>
      </Popover.Root>
    </div>
  );
}

describe('useCombobox listbox name', () => {
  it('names the listbox by the label, not by the typed text', async () => {
    render(<LabelledBox />);
    await userEvent.click(screen.getByRole('combobox'));
    await userEvent.keyboard('re');
    await waitFor(() => expect(screen.getByRole('combobox').getAttribute('aria-expanded')).toBe('true'));
    await expect.poll(() => axNames('listbox')).toEqual(['Framework']);
  });
});

function SheetBox() {
  const cb = useCombobox({ options: FRAMEWORKS, presentation: 'sheet' });
  return (
    <div data-appearance="light" data-density="comfortable">
      <Label.Root {...cb.getLabelProps()}>Framework</Label.Root>
      <Button.Root {...cb.getTriggerProps()}>Choose</Button.Root>
      <BottomSheet.Root {...cb.getSheetProps()}>
        <BottomSheet.Body>
          <Field.Root id={cb.ids.input} aria-label="Search">
            <Field.TextInput {...cb.getInputProps()} />
          </Field.Root>
          <OptionList.Root {...cb.getListboxProps()}>
            {cb.items.map((item) => (
              <OptionList.Option key={item.id} {...cb.getOptionProps(item)} />
            ))}
          </OptionList.Root>
        </BottomSheet.Body>
      </BottomSheet.Root>
    </div>
  );
}

function PaletteBox() {
  const cb = useCombobox({ options: FRAMEWORKS, presentation: 'dialog' });
  return (
    <div data-appearance="light" data-density="comfortable">
      <Button.Root {...cb.getTriggerProps()}>Open palette</Button.Root>
      <Dialog.Root {...cb.getDialogProps()} aria-label="Commands">
        <Field.Root id={cb.ids.input} aria-label="Command">
          <Field.TextInput {...cb.getInputProps()} />
        </Field.Root>
        <OptionList.Root {...cb.getListboxProps({ 'aria-label': 'Commands' })}>
          {cb.items.map((item) => (
            <OptionList.Option key={item.id} {...cb.getOptionProps(item)} />
          ))}
        </OptionList.Root>
      </Dialog.Root>
    </div>
  );
}

describe('useCombobox listbox name in a sheet or dialog', () => {
  it('names a sheet\'s listbox by the label beside the trigger', async () => {
    render(<SheetBox />);
    await userEvent.click(screen.getByText('Choose'));
    await waitFor(() => expect(screen.getByRole('combobox').getAttribute('aria-expanded')).toBe('true'));
    await expect.poll(() => axNames('listbox')).toEqual(['Framework']);
  });

  it('names a listbox with no visible label by the aria-label passed to getListboxProps', async () => {
    render(<PaletteBox />);
    await userEvent.click(screen.getByRole('button', { name: 'Open palette' }));
    await waitFor(() => expect(screen.getByRole('combobox').getAttribute('aria-expanded')).toBe('true'));
    await expect.poll(() => axNames('listbox')).toEqual(['Commands']);
    expect(document.querySelector('[role="listbox"]')?.hasAttribute('aria-labelledby')).toBe(false);
  });
});

describe('useCombobox trigger name', () => {
  it('names a sheet trigger by the label and its own text', async () => {
    render(<SheetBox />);
    await expect.poll(() => axNames('button')).toContain('Framework Choose');
  });
});

describe('useCombobox Enter with nothing to commit', () => {
  function FormBox({ onSubmit, onValueChange }: { onSubmit: () => void; onValueChange?: (value: string | null) => void }) {
    const cb = useCombobox({ options: FRAMEWORKS, presentation: 'popover', onValueChange });
    return (
      <form
        data-appearance="light"
        data-density="comfortable"
        onSubmit={(event) => {
          event.preventDefault();
          onSubmit();
        }}
      >
        <Label.Root {...cb.getLabelProps()}>Framework</Label.Root>
        <Field.Root {...cb.getAnchorProps()}>
          <Field.TextInput {...cb.getInputProps()} />
        </Field.Root>
        <Popover.Root {...cb.getPopoverProps()}>
          <OptionList.Root {...cb.getListboxProps()}>
            {cb.items.map((item) => (
              <OptionList.Option key={item.id} {...cb.getOptionProps(item)} />
            ))}
          </OptionList.Root>
        </Popover.Root>
        <button type="submit">Save</button>
      </form>
    );
  }

  it('picks once and submits nothing on a held Enter', async () => {
    let submits = 0;
    const picks: (string | null)[] = [];
    render(<FormBox onSubmit={() => (submits += 1)} onValueChange={(value) => picks.push(value)} />);
    await userEvent.click(screen.getByRole('combobox'));
    await userEvent.keyboard('re');
    await userEvent.keyboard('{Enter>3}');
    expect(picks).toEqual(['react']);
    expect(submits).toBe(0);
  });

  it('submits the form from an open list with no rows', async () => {
    let submits = 0;
    render(<FormBox onSubmit={() => (submits += 1)} />);
    await userEvent.click(screen.getByRole('combobox'));
    await userEvent.keyboard('zzz');
    expect(screen.getByRole('combobox').getAttribute('aria-expanded')).toBe('true');
    await userEvent.keyboard('{Enter}');
    expect(submits).toBe(1);
  });
});

describe('useCombobox reset reopening a dialog', () => {
  function ResetPalette() {
    const cb = useCombobox({ options: FRAMEWORKS, presentation: 'dialog', defaultOpen: true });
    return (
      <div data-appearance="light" data-density="comfortable">
        <Button.Root {...cb.getTriggerProps()}>Open palette</Button.Root>
        <Button.Root onClick={() => cb.setOpen(true)}>Open from code</Button.Root>
        <Button.Root onClick={() => cb.reset()}>Reset</Button.Root>
        <Dialog.Root {...cb.getDialogProps()} aria-label="Commands">
          <Field.Root id={cb.ids.input} aria-label="Command">
            <Field.TextInput {...cb.getInputProps()} />
          </Field.Root>
          <OptionList.Root {...cb.getListboxProps({ 'aria-label': 'Commands' })}>
            {cb.items.map((item) => (
              <OptionList.Option key={item.id} {...cb.getOptionProps(item)} />
            ))}
          </OptionList.Root>
        </Dialog.Root>
      </div>
    );
  }

  it('returns focus to what had it when reset reopened the dialog', async () => {
    render(<ResetPalette />);
    const combobox = () => screen.getByRole('combobox');
    await waitFor(() => expect(document.activeElement).toBe(combobox()));
    await userEvent.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('combobox')).toBeNull());
    // Nothing has focus when this open starts, so the hook sends focus back to the trigger.
    (document.activeElement as HTMLElement | null)?.blur();
    screen.getByRole('button', { name: 'Open from code' }).click();
    await waitFor(() => expect(document.activeElement).toBe(combobox()));
    await userEvent.keyboard('{Escape}');
    await waitFor(() => expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Open palette' })));

    const reset = screen.getByRole('button', { name: 'Reset' });
    await userEvent.click(reset);
    await waitFor(() => expect(document.activeElement).toBe(combobox()));
    await userEvent.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('combobox')).toBeNull());
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(document.activeElement).toBe(reset);
  });
});
