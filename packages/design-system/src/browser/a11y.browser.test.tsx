import { render, screen, waitFor } from '@testing-library/react';
import { userEvent } from '@vitest/browser/context';
import axe from 'axe-core';
import { useId, useState, type ReactNode } from 'react';
import { describe, expect, it } from 'vitest';
import {
  BottomSheet,
  Button,
  Checkbox,
  Chip,
  Description,
  Dialog,
  ErrorMessage,
  Field,
  Label,
  OptionList,
  Popover,
  RadioGroup,
  Stack,
  Switch,
  Text,
  Tooltip,
  useCombobox,
  usePopover,
  useTooltip,
  type ComboboxOption,
} from '../index';

/**
 * axe in a real browser, so roles, names and the top layer are what a screen
 * reader gets. Its color-contrast rule is WCAG 2; Todae checks contrast with
 * APCA when tokens build, so that rule is off here.
 */
async function violations(root: Element = document.body): Promise<string[]> {
  const result = await axe.run(root, { rules: { 'color-contrast': { enabled: false } } });
  return result.violations.map(
    (v) => `${v.id}: ${v.help}\n  ${v.nodes.map((n) => n.target.join(' ')).join('\n  ')}`,
  );
}

async function expectNoViolations() {
  expect(await violations()).toEqual([]);
}

function Themed({ children }: { children: ReactNode }) {
  return (
    <main data-appearance="light" data-density="comfortable">
      {children}
    </main>
  );
}

function Gallery() {
  const emailId = useId();
  const hintId = useId();
  const errorId = useId();
  const planId = useId();
  const [email, setEmail] = useState('');
  const [chips, setChips] = useState(['design', 'tokens', 'accessibility', 'react', 'density']);
  const [chipInput, setChipInput] = useState('');
  const [fruit, setFruit] = useState<string | null>('pear');
  return (
    <Themed>
      <h1>Gallery</h1>
      <Stack>
        <Text>Body text</Text>
        <Button.Root>Save</Button.Root>
        <Button.Root variant="ghost" aria-label="Archive">
          <Button.Icon>
            <span aria-hidden>+</span>
          </Button.Icon>
        </Button.Root>
        <Button.Group aria-label="Alignment">
          <Button.Root variant="secondary">Left</Button.Root>
          <Button.Root variant="secondary">Right</Button.Root>
        </Button.Group>
        <div>
          <Label htmlFor={emailId}>Email</Label>
          <Field.Root id={emailId} invalid>
            <Field.TextInput
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              aria-describedby={`${hintId} ${errorId}`}
            />
          </Field.Root>
          <Description id={hintId}>Work address.</Description>
          <ErrorMessage id={errorId}>Enter an email.</ErrorMessage>
        </div>
        <Field.Root aria-label="Tags">
          <Field.ChipInput
            chips={chips}
            inputValue={chipInput}
            onInputValueChange={setChipInput}
            onCommit={(value) => {
              setChips([...chips, value]);
              setChipInput('');
            }}
            onChipRemove={(index) => setChips(chips.filter((_, i) => i !== index))}
            maxRows={1}
          />
        </Field.Root>
        <Checkbox defaultChecked>Email me</Checkbox>
        <Switch>Dark mode</Switch>
        <Text as="span" id={planId}>
          Plan
        </Text>
        <RadioGroup.Root aria-labelledby={planId} defaultValue="free">
          <RadioGroup.Item value="free">Free</RadioGroup.Item>
          <RadioGroup.Item value="pro">Pro</RadioGroup.Item>
          <RadioGroup.Item value="enterprise" disabled>
            Enterprise
          </RadioGroup.Item>
        </RadioGroup.Root>
        <Stack direction="row">
          <Chip.Root onRemove={() => undefined}>Design</Chip.Root>
          <Chip.Overflow overflowCount={3} />
        </Stack>
        <OptionList.Root value={fruit} onValueChange={setFruit} aria-label="Fruit">
          <OptionList.Option value="apple">Apple</OptionList.Option>
          <OptionList.Option value="pear">Pear</OptionList.Option>
        </OptionList.Root>
      </Stack>
    </Themed>
  );
}

const FRAMEWORKS: ComboboxOption[] = [
  { value: 'react', label: 'React' },
  { value: 'svelte', label: 'Svelte' },
];

function ComboboxHarness() {
  const labelId = useId();
  const cb = useCombobox({ options: FRAMEWORKS, presentation: 'popover' });
  return (
    <Themed>
      <Text as="span" id={labelId}>
        Framework
      </Text>
      <Field.Root {...cb.getAnchorProps()} aria-labelledby={labelId}>
        <Field.TextInput {...cb.getInputProps()} />
      </Field.Root>
      <Popover.Root {...cb.getPopoverProps()}>
        <OptionList.Root {...cb.getListboxProps()} aria-labelledby={labelId}>
          {cb.items.map((item) => (
            <OptionList.Option key={item.id} {...cb.getOptionProps(item)} />
          ))}
        </OptionList.Root>
      </Popover.Root>
    </Themed>
  );
}

function OverlayHarness() {
  const popover = usePopover({ defaultOpen: true });
  const tooltip = useTooltip();
  return (
    <Themed>
      <Button.Root {...popover.getTriggerProps()}>Filters</Button.Root>
      <Popover.Root {...popover.getPopoverProps()} role="dialog" aria-label="Filters panel">
        <Checkbox>Archived</Checkbox>
      </Popover.Root>
      <Button.Root variant="ghost" tooltip={false} {...tooltip.getTriggerProps()}>
        Policy
      </Button.Root>
      <Tooltip.Root {...tooltip.getTooltipProps()}>Read before sharing</Tooltip.Root>
    </Themed>
  );
}

describe('axe in a browser', () => {
  it('reports a real violation, so a clean run means something', async () => {
    render(
      <Themed>
        <input />
      </Themed>,
    );
    expect((await violations()).join('\n')).toContain('label');
  });

  it('finds nothing in the static parts', async () => {
    render(<Gallery />);
    await expectNoViolations();
  });

  it('finds nothing in an open Dialog', async () => {
    render(
      <Themed>
        <Dialog.Root open onOpenChange={() => undefined}>
          <Dialog.Header>
            <Dialog.Title>Rename</Dialog.Title>
            <Dialog.Close>×</Dialog.Close>
          </Dialog.Header>
          <Dialog.Description>Pick a new name.</Dialog.Description>
          <Dialog.Footer>
            <Button.Root>Save</Button.Root>
          </Dialog.Footer>
        </Dialog.Root>
      </Themed>,
    );
    await waitFor(() => expect(screen.getByRole('dialog').matches(':modal')).toBe(true));
    await expectNoViolations();
  });

  it('finds nothing in an open BottomSheet', async () => {
    render(
      <Themed>
        <BottomSheet.Root open onOpenChange={() => undefined}>
          <BottomSheet.Header>
            <BottomSheet.Title>Sort</BottomSheet.Title>
            <BottomSheet.Close>×</BottomSheet.Close>
          </BottomSheet.Header>
          <BottomSheet.Body>
            <Checkbox>Newest first</Checkbox>
          </BottomSheet.Body>
        </BottomSheet.Root>
      </Themed>,
    );
    await screen.findByRole('dialog');
    await expectNoViolations();
  });

  it('finds nothing in an open combobox', async () => {
    render(<ComboboxHarness />);
    await userEvent.click(screen.getByRole('combobox'));
    await userEvent.keyboard('{ArrowDown}');
    await waitFor(() => expect(screen.getByRole('listbox')).toBeTruthy());
    await expectNoViolations();
  });

  it('finds nothing with a popover and a tooltip open', async () => {
    render(<OverlayHarness />);
    await waitFor(() => expect(screen.getByRole('dialog', { name: 'Filters panel' }).matches(':popover-open')).toBe(true));
    await userEvent.hover(screen.getByRole('button', { name: 'Policy' }));
    await screen.findByRole('tooltip');
    await expectNoViolations();
  });
});
