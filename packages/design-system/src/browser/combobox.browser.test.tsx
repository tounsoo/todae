import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { cdp, userEvent } from '@vitest/browser/context';
import { afterEach, describe, expect, it } from 'vitest';
import { Field, Label, OptionList, Popover, useCombobox, type ComboboxOption } from '../index.js';

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
      <Label.Root id={cb.ids.label} htmlFor={cb.ids.input}>
        Framework
      </Label.Root>
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
