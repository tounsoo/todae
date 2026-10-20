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

/** The name Chromium's own accessibility tree gives each listbox, in every frame. */
async function listboxNames(): Promise<string[]> {
  const { frameTree } = (await session().send('Page.getFrameTree')) as { frameTree: FrameTree };
  const names: string[] = [];
  for (const frameId of frameIds(frameTree)) {
    const { nodes } = (await session().send('Accessibility.getFullAXTree', { frameId })) as { nodes: AXNode[] };
    for (const node of nodes) if (node.role?.value === 'listbox') names.push(node.name?.value ?? '');
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
    await expect.poll(listboxNames).toEqual(['Framework']);
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
    await expect.poll(listboxNames).toEqual(['Framework']);
  });

  it('names a listbox with no visible label by the aria-label passed to getListboxProps', async () => {
    render(<PaletteBox />);
    await userEvent.click(screen.getByRole('button', { name: 'Open palette' }));
    await waitFor(() => expect(screen.getByRole('combobox').getAttribute('aria-expanded')).toBe('true'));
    await expect.poll(listboxNames).toEqual(['Commands']);
    expect(document.querySelector('[role="listbox"]')?.hasAttribute('aria-labelledby')).toBe(false);
  });
});
