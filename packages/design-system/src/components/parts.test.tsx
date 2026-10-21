import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { createRef, useRef, useState, type ReactNode, type RefObject } from 'react';
import { createRoot } from 'react-dom/client';
import { renderToString } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  Alert,
  Avatar,
  Badge,
  BottomSheet,
  Breadcrumbs,
  Button,
  Card,
  EmptyState,
  Message,
  Attachment,
  Steps,
  Composer,
  Conversation,
  Checkbox,
  Form,
  Calendar,
  Chip,
  ChipList,
  Code,
  CodeBlock,
  ColorPicker,
  Description,
  Disclosure,
  Dialog,
  Drawer,
  ErrorMessage,
  Field,
  Grid,
  Fieldset,
  Kbd,
  Label,
  Link,
  Menu,
  Meter,
  Nav,
  OptionList,
  Pagination,
  Popover,
  Progress,
  RadioGroup,
  ScrollArea,
  Prose,
  Separator,
  Skeleton,
  Slider,
  Loader,
  Stack,
  Switch,
  Table,
  Tabs,
  Text,
  ToggleGroup,
  Toolbar,
  Tree,
  Toast,
  Tooltip,
  VisuallyHidden,
  composeRefs,
  createToaster,
  usePopover,
  useTooltip,
} from '../index.js';

afterEach(cleanup);

// Every exported part takes native attributes and a ref, so a company can wrap it.
// The ref is untyped so one case table covers parts with different element types.
type Native = { 'data-testid': string; ref: RefObject<any> };
type Case = [name: string, render: (p: Native) => ReactNode];

const noop = () => undefined;

function PopoverCase({ p }: { p: Native }) {
  const popover = usePopover({ open: true });
  const { ref: wireRef, ...wire } = popover.getPopoverProps();
  return (
    <Popover.Root {...wire} ref={composeRefs(wireRef, p.ref)} data-testid={p['data-testid']} role="dialog" aria-label="Menu">
      Menu
    </Popover.Root>
  );
}

function TooltipCase({ p }: { p: Native }) {
  const tip = useTooltip({ open: true });
  const { ref: wireRef, ...wire } = tip.getTooltipProps();
  return (
    <Tooltip.Root {...wire} ref={composeRefs(wireRef, p.ref)} data-testid={p['data-testid']}>
      Tip
    </Tooltip.Root>
  );
}

const cases: Case[] = [
  ['Link.Root', (p) => <Link.Root {...p} href="/a">a</Link.Root>],
  ['Nav.Root', (p) => <Nav.Root {...p} aria-label="n" />],
  ['Nav.Group', (p) => <Nav.Group {...p} label="g" />],
  ['Nav.Item', (p) => <ul><Nav.Item {...p}>i</Nav.Item></ul>],
  ['Nav.Link', (p) => <Nav.Link {...p} href="/a">a</Nav.Link>],
  [
    'Nav.Link render',
    (p) => <Nav.Link {...p} href="/a" render={(props) => <a {...props} />}>a</Nav.Link>,
  ],
  ['Nav.Branch', (p) => <Nav.Branch {...p} label="b" />],
  ['Disclosure.Root', (p) => <Disclosure.Root {...p}><summary>s</summary>c</Disclosure.Root>],
  ['Disclosure.Summary', (p) => <details><Disclosure.Summary {...p}>s</Disclosure.Summary></details>],
  ['Separator.Root', (p) => <Separator.Root {...p} />],
  ['Prose.Root', (p) => <Prose.Root {...p} />],
  ['ScrollArea.Root', (p) => <ScrollArea.Root {...p} />],
  ['Table.Root', (p) => <Table.Root {...p} />],
  ['Table.Caption', (p) => <table><Table.Caption {...p}>c</Table.Caption></table>],
  ['Table.Head', (p) => <table><Table.Head {...p} /></table>],
  ['Table.Body', (p) => <table><Table.Body {...p} /></table>],
  ['Table.Foot', (p) => <table><Table.Foot {...p} /></table>],
  ['Table.Row', (p) => <table><tbody><Table.Row {...p} /></tbody></table>],
  ['Table.HeaderCell', (p) => <table><tbody><tr><Table.HeaderCell {...p} scope="row">h</Table.HeaderCell></tr></tbody></table>],
  ['Table.Cell', (p) => <table><tbody><tr><Table.Cell {...p}>c</Table.Cell></tr></tbody></table>],
  ['Progress.Root', (p) => <Progress.Root {...p} aria-label="p" />],
  ['Meter.Root', (p) => <Meter.Root {...p} value={0.5} aria-label="m" />],
  ['Loader.Root', (p) => <Loader.Root {...p} aria-label="s" />],
  ['Skeleton.Root', (p) => <Skeleton.Root {...p} />],
  ['Slider.Root', (p) => <Slider.Root {...p} aria-label="s" />],
  ['Code.Root', (p) => <Code.Root {...p}>c</Code.Root>],
  ['CodeBlock.Root', (p) => <CodeBlock.Root {...p}>c</CodeBlock.Root>],
  ['Kbd.Root', (p) => <Kbd.Root {...p}>K</Kbd.Root>],
  ['VisuallyHidden.Root', (p) => <VisuallyHidden.Root {...p}>h</VisuallyHidden.Root>],
  ['Stack.Root', (p) => <Stack.Root {...p} />],
  ['Grid.Root', (p) => <Grid.Root columns={2} {...p} />],
  ['Avatar.Root', (p) => <Avatar.Root {...p} />],
  [
    'Avatar.Image',
    (p) => (
      <Avatar.Root>
        <Avatar.Image src="a.png" {...p} />
      </Avatar.Root>
    ),
  ],
  [
    'Avatar.Fallback',
    (p) => (
      <Avatar.Root>
        <Avatar.Fallback {...p}>AL</Avatar.Fallback>
      </Avatar.Root>
    ),
  ],
  ['Text.Root', (p) => <Text.Root {...p}>Hi</Text.Root>],
  ['Label.Root', (p) => <Label.Root {...p} htmlFor="x" />],
  ['Description.Root', (p) => <Description.Root {...p} id="d" />],
  ['ErrorMessage.Root', (p) => <ErrorMessage.Root {...p} id="e" />],
  ['Chip.Root', (p) => <Chip.Root {...p}>a</Chip.Root>],
  ['ChipList.Root', (p) => <ChipList.Root {...p} aria-label="Tags" chips={['a', 'b']} />],
  ['Checkbox.Root', (p) => <Checkbox.Root {...p}>c</Checkbox.Root>],
  ['Switch.Root', (p) => <Switch.Root {...p}>s</Switch.Root>],
  ['RadioGroup.Root', (p) => <RadioGroup.Root {...p} aria-label="g" />],
  [
    'RadioGroup.Item',
    (p) => (
      <RadioGroup.Root aria-label="g">
        <RadioGroup.Item {...p} value="a">
          a
        </RadioGroup.Item>
      </RadioGroup.Root>
    ),
  ],
  ['Button.Root', (p) => <Button.Root {...p}>Go</Button.Root>],
  [
    'Button.Icon',
    (p) => (
      <Button.Root>
        <Button.Icon {...p}>*</Button.Icon>
        Go
      </Button.Root>
    ),
  ],
  ['Button.Group', (p) => <Button.Group {...p} aria-label="g" />],
  ['Field.Root', (p) => <Field.Root {...p} />],
  ...(['Icon', 'Affix', 'Row'] as const).map(
    (part): Case => [
      `Field.${part}`,
      (p) => {
        const Part = Field[part];
        return (
          <Field.Root>
            <Part {...p} />
          </Field.Root>
        );
      },
    ],
  ),
  [
    'Field.TextInput',
    (p) => (
      <Field.Root aria-label="t">
        <Field.TextInput {...p} value="" onChange={noop} />
      </Field.Root>
    ),
  ],
  [
    'Field.NumberInput',
    (p) => (
      <Field.Root aria-label="t">
        <Field.NumberInput {...p} value={null} onValueChange={noop} />
      </Field.Root>
    ),
  ],
  ...(['Increment', 'Decrement'] as const).map(
    (part): Case => [
      `Field.${part}`,
      (p) => {
        const Part = Field[part];
        return (
          <Field.Root aria-label="t">
            <Field.NumberInput value={1} onValueChange={noop} />
            <Part {...p} />
          </Field.Root>
        );
      },
    ],
  ),
  [
    'Field.Textarea',
    (p) => (
      <Field.Root aria-label="t">
        <Field.Textarea {...p} value="" onChange={noop} />
      </Field.Root>
    ),
  ],
  [
    'Field.ChipInput',
    (p) => (
      <Field.Root aria-label="t">
        <Field.ChipInput
          {...p}
          chips={[]}
          inputValue=""
          onInputValueChange={noop}
          onCommit={noop}
          onChipRemove={noop}
        />
      </Field.Root>
    ),
  ],
  [
    'Field.ColorPicker',
    (p) => (
      <Field.Root aria-label="t">
        <Field.ColorPicker {...p} value="#000000" />
      </Field.Root>
    ),
  ],
  [
    'Field.DatePicker',
    (p) => (
      <Field.Root aria-label="t">
        <Field.DatePicker {...p} value={null} />
      </Field.Root>
    ),
  ],
  [
    'Field.TimePicker',
    (p) => (
      <Field.Root aria-label="t">
        <Field.TimePicker {...p} value={null} />
      </Field.Root>
    ),
  ],
  [
    'Field.DateTimePicker',
    (p) => (
      <Field.Root aria-label="t">
        <Field.DateTimePicker {...p} value={null} />
      </Field.Root>
    ),
  ],
  [
    'Calendar.Root',
    (p) => <Calendar.Root {...p} aria-label="c" />,
  ],
  [
    'Calendar.Header',
    (p) => (
      <Calendar.Root aria-label="c">
        <Calendar.Header {...p} />
      </Calendar.Root>
    ),
  ],
  [
    'Calendar.Grid',
    (p) => (
      <Calendar.Root aria-label="c">
        <Calendar.Grid {...p} />
      </Calendar.Root>
    ),
  ],
  [
    'ColorPicker.Root',
    (p) => <ColorPicker.Root {...p} aria-label="c" />,
  ],
  [
    'ColorPicker.Area',
    (p) => (
      <ColorPicker.Root aria-label="c">
        <ColorPicker.Area {...p} />
      </ColorPicker.Root>
    ),
  ],
  [
    'ColorPicker.Hue',
    (p) => (
      <ColorPicker.Root aria-label="c">
        <ColorPicker.Hue {...p} />
      </ColorPicker.Root>
    ),
  ],
  [
    'Field.Select',
    (p) => (
      <Field.Root aria-label="t">
        <Field.Select {...p} value="a" onChange={noop}>
          <option value="a">a</option>
        </Field.Select>
      </Field.Root>
    ),
  ],
  [
    'Field.Counter',
    (p) => (
      <Field.Root aria-label="t">
        <Field.TextInput value="ab" onChange={noop} maxLength={5} />
        <Field.Counter {...p} />
      </Field.Root>
    ),
  ],
  ['Field.Group', (p) => <Field.Group {...p} />],
  [
    'Dialog.Root',
    (p) => (
      <Dialog.Root {...p} open onOpenChange={noop} aria-label="d">
        x
      </Dialog.Root>
    ),
  ],
  ...(['Title', 'Description', 'Header', 'Body', 'Footer', 'Close'] as const).map(
    (part): Case => [
      `Dialog.${part}`,
      (p) => {
        const Part = Dialog[part] as (props: Native) => ReactNode;
        return (
          <Dialog.Root open onOpenChange={noop} aria-label="d">
            <Part {...p} />
          </Dialog.Root>
        );
      },
    ],
  ),
  [
    'Drawer.Root',
    (p) => (
      <Drawer.Root {...p} open onOpenChange={noop} aria-label="d">
        x
      </Drawer.Root>
    ),
  ],
  ...(['Title', 'Description', 'Header', 'Body', 'Footer', 'Close'] as const).map(
    (part): Case => [
      `Drawer.${part}`,
      (p) => {
        const Part = Drawer[part] as (props: Native) => ReactNode;
        return (
          <Drawer.Root open onOpenChange={noop} aria-label="d">
            <Part {...p} />
          </Drawer.Root>
        );
      },
    ],
  ),
  ['BottomSheet.Root', (p) => <BottomSheet.Root {...p} open onOpenChange={noop} aria-label="s" />],
  ...(['Grabber', 'Header', 'Title', 'Description', 'Body', 'Footer', 'Close'] as const).map(
    (part): Case => [
      `BottomSheet.${part}`,
      (p) => {
        const Part = BottomSheet[part] as (props: Native) => ReactNode;
        return (
          <BottomSheet.Root open onOpenChange={noop} aria-label="s">
            <Part {...p} />
          </BottomSheet.Root>
        );
      },
    ],
  ),
  [
    'OptionList.Root',
    (p) => (
      <OptionList.Root {...p} aria-label="l" value={null} onValueChange={noop}>
        <OptionList.Option value="a">a</OptionList.Option>
      </OptionList.Root>
    ),
  ],
  [
    'OptionList.Option',
    (p) => (
      <OptionList.Root aria-label="l" value={null} onValueChange={noop}>
        <OptionList.Option {...p} value="a">
          a
        </OptionList.Option>
      </OptionList.Root>
    ),
  ],
  ['Popover.Root', (p) => <PopoverCase p={p} />],
  ['Menu.Trigger', (p) => (
    <Menu.Root>
      <Menu.Trigger {...p}>Open</Menu.Trigger>
    </Menu.Root>
  )],
  ['Menu.Content', (p) => (
    <Menu.Root>
      <Menu.Content {...p} aria-label="m" />
    </Menu.Root>
  )],
  ...(['Item', 'CheckboxItem', 'Separator'] as const).map(
    (part): Case => [
      `Menu.${part}`,
      (p) => {
        const Part = Menu[part] as (props: Native & { children?: ReactNode }) => ReactNode;
        return (
          <Menu.Root>
            <Menu.Content aria-label="m">
              <Part {...p}>x</Part>
            </Menu.Content>
          </Menu.Root>
        );
      },
    ],
  ),
  ['Menu.Group', (p) => (
    <Menu.Root>
      <Menu.Content aria-label="m">
        <Menu.Group {...p} aria-label="g" />
      </Menu.Content>
    </Menu.Root>
  )],
  ['Menu.RadioGroup', (p) => (
    <Menu.Root>
      <Menu.Content aria-label="m">
        <Menu.RadioGroup {...p} aria-label="g" />
      </Menu.Content>
    </Menu.Root>
  )],
  ['Menu.RadioItem', (p) => (
    <Menu.Root>
      <Menu.Content aria-label="m">
        <Menu.RadioGroup aria-label="g">
          <Menu.RadioItem {...p} value="a">
            a
          </Menu.RadioItem>
        </Menu.RadioGroup>
      </Menu.Content>
    </Menu.Root>
  )],
  ['Tabs.Root', (p) => <Tabs.Root {...p} defaultValue="a" />],
  [
    'Tabs.List',
    (p) => (
      <Tabs.Root defaultValue="a">
        <Tabs.List {...p} aria-label="t" />
      </Tabs.Root>
    ),
  ],
  [
    'Tabs.Tab',
    (p) => (
      <Tabs.Root defaultValue="a">
        <Tabs.List aria-label="t">
          <Tabs.Tab {...p} value="a">
            A
          </Tabs.Tab>
        </Tabs.List>
      </Tabs.Root>
    ),
  ],
  [
    'Tabs.Panel',
    (p) => (
      <Tabs.Root defaultValue="a">
        <Tabs.Panel {...p} value="a" />
      </Tabs.Root>
    ),
  ],
  ['Tree.Root', (p) => <Tree.Root {...p} aria-label="t" />],
  [
    'Tree.Item',
    (p) => (
      <Tree.Root aria-label="t">
        <Tree.Item {...p} value="a">
          <Tree.Label>A</Tree.Label>
        </Tree.Item>
      </Tree.Root>
    ),
  ],
  [
    'Tree.Label',
    (p) => (
      <Tree.Root aria-label="t">
        <Tree.Item value="a">
          <Tree.Label {...p}>A</Tree.Label>
        </Tree.Item>
      </Tree.Root>
    ),
  ],
  [
    'Tree.Group',
    (p) => (
      <Tree.Root aria-label="t" defaultExpanded={['a']}>
        <Tree.Item value="a">
          <Tree.Label>A</Tree.Label>
          <Tree.Group {...p} />
        </Tree.Item>
      </Tree.Root>
    ),
  ],
  [
    'Tree.Icon',
    (p) => (
      <Tree.Root aria-label="t">
        <Tree.Item value="a">
          <Tree.Label>
            <Tree.Icon {...p} />A
          </Tree.Label>
        </Tree.Item>
      </Tree.Root>
    ),
  ],
  ['Tooltip.Root', (p) => <TooltipCase p={p} />],
  ['Fieldset.Root', (p) => <Fieldset.Root {...p} />],
  ['Form.Root', (p) => <Form.Root {...p} />],
  [
    'Fieldset.Legend',
    (p) => (
      <Fieldset.Root>
        <Fieldset.Legend {...p}>Group</Fieldset.Legend>
      </Fieldset.Root>
    ),
  ],
  ['Alert.Root', (p) => <Alert.Root {...p} />],
  ...(['Icon', 'Title', 'Description', 'Actions', 'Close'] as const).map(
    (part): Case => [
      `Alert.${part}`,
      (p) => {
        const Part = Alert[part] as (props: Native) => ReactNode;
        return (
          <Alert.Root>
            <Part {...p} />
          </Alert.Root>
        );
      },
    ],
  ),
  ['Badge.Root', (p) => <Badge.Root {...p}>New</Badge.Root>],
  ['Card.Root', (p) => <Card.Root {...p} />],
  ...(['Header', 'Body', 'Footer'] as const).map(
    (part): Case => [
      `Card.${part}`,
      (p) => {
        const Part = Card[part] as (props: Native) => ReactNode;
        return (
          <Card.Root>
            <Part {...p} />
          </Card.Root>
        );
      },
    ],
  ),
  ['EmptyState.Root', (p) => <EmptyState.Root {...p} />],
  ...(['Icon', 'Title', 'Description', 'Actions'] as const).map(
    (part): Case => [
      `EmptyState.${part}`,
      (p) => {
        const Part = EmptyState[part] as (props: Native) => ReactNode;
        return (
          <EmptyState.Root>
            <Part {...p} />
          </EmptyState.Root>
        );
      },
    ],
  ),
  ['Message.Root', (p) => <Message.Root {...p} />],
  ...(['Avatar', 'Header', 'Content', 'Actions'] as const).map(
    (part): Case => [
      `Message.${part}`,
      (p) => {
        const Part = Message[part] as (props: Native) => ReactNode;
        return (
          <Message.Root>
            <Part {...p} />
          </Message.Root>
        );
      },
    ],
  ),
  [
    'Message.Time',
    (p) => (
      <Message.Root>
        <Message.Time {...p} value={Temporal.ZonedDateTime.from('2026-10-14T09:41:00+09:00[Asia/Seoul]')} />
      </Message.Root>
    ),
  ],
  ['Attachment.Root', (p) => <Attachment.Root {...p} />],
  ...(['Preview', 'Meta', 'Progress', 'Remove'] as const).map(
    (part): Case => [
      `Attachment.${part}`,
      (p) => {
        const Part = Attachment[part] as (props: Native) => ReactNode;
        return (
          <Attachment.Root>
            <Part {...p} />
          </Attachment.Root>
        );
      },
    ],
  ),
  [
    'Attachment.Name',
    (p) => (
      <Attachment.Root>
        <Attachment.Name {...p}>report.pdf</Attachment.Name>
      </Attachment.Root>
    ),
  ],
  ['Steps.Root', (p) => <Steps.Root {...p} />],
  [
    'Steps.Item',
    (p) => (
      <Steps.Root>
        <Steps.Item {...p} />
      </Steps.Root>
    ),
  ],
  ['Composer.Root', (p) => <Composer.Root {...p} />],
  [
    'Composer.Submit',
    (p) => (
      <Composer.Root>
        <Composer.Submit {...p} />
      </Composer.Root>
    ),
  ],
  ['Conversation.Root', (p) => <Conversation.Root {...p} />],
  ...(['Viewport', 'Content', 'ScrollButton'] as const).map(
    (part): Case => [
      `Conversation.${part}`,
      (p) => {
        const Part = Conversation[part] as (props: Native) => ReactNode;
        return (
          <Conversation.Root>
            <Part {...p} />
          </Conversation.Root>
        );
      },
    ],
  ),
  ['Breadcrumbs.Root', (p) => <Breadcrumbs.Root {...p} />],
  ['Pagination.Root', (p) => <Pagination.Root {...p} />],
  ...(['Item', 'Ellipsis'] as const).map(
    (part): Case => [
      `Pagination.${part}`,
      (p) => {
        const Part = Pagination[part] as (props: Native) => ReactNode;
        return (
          <Pagination.Root>
            <Part {...p} />
          </Pagination.Root>
        );
      },
    ],
  ),
  [
    'Breadcrumbs.Item',
    (p) => (
      <Breadcrumbs.Root>
        <Breadcrumbs.Item {...p}>Home</Breadcrumbs.Item>
      </Breadcrumbs.Root>
    ),
  ],
  ['Toolbar.Root', (p) => <Toolbar.Root {...p} aria-label="t" />],
  ['Toolbar.Group', (p) => <Toolbar.Root aria-label="t"><Toolbar.Group {...p} /></Toolbar.Root>],
  ['Toolbar.Separator', (p) => <Toolbar.Root aria-label="t"><Toolbar.Separator {...p} /></Toolbar.Root>],
  ['ToggleGroup.Root', (p) => <ToggleGroup.Root {...p} aria-label="g" />],
  [
    'ToggleGroup.Item',
    (p) => (
      <ToggleGroup.Root aria-label="g">
        <ToggleGroup.Item {...p} value="a">
          a
        </ToggleGroup.Item>
      </ToggleGroup.Root>
    ),
  ],
  ['Toast.Region', (p) => <Toast.Region toaster={createToaster()} {...p}>{() => null}</Toast.Region>],
  ...(['Root', 'Icon', 'Title', 'Description', 'Action', 'Close'] as const).map(
    (part): Case => [
      `Toast.${part}`,
      (p) => {
        const Part = Toast[part] as (props: Native) => ReactNode;
        return part === 'Root' ? <Part {...p} /> : (
          <Toast.Root>
            <Part {...p} />
          </Toast.Root>
        );
      },
    ],
  ),
];

describe('every exported part', () => {
  it.each(cases)('%s forwards native attributes and a ref', (name, part) => {
    const ref = createRef<HTMLElement>();
    render(<>{part({ 'data-testid': name, ref })}</>);
    const el = screen.getByTestId(name);
    expect(ref.current).toBe(el);
  });
});

describe('Form.Summary', () => {
  it('forwards native attributes and a ref once a failed submit gives it something to list', async () => {
    const ref = createRef<HTMLDivElement>();
    render(
      <Form.Root data-testid="form">
        <Form.Summary data-testid="summary" ref={ref} />
        <Field.Group>
          <Field.Root id="a" name="a">
            <Field.TextInput aria-label="A" required value="" onChange={noop} />
          </Field.Root>
          <ErrorMessage.Root />
        </Field.Group>
      </Form.Root>,
    );
    await act(async () => {
      fireEvent.submit(screen.getByTestId('form'));
    });
    expect(ref.current).toBe(screen.getByTestId('summary'));
  });
});

describe('composed handlers', () => {
  it('run the consumer handler first and let preventDefault skip the built-in behavior', () => {
    const onChange = vi.fn();
    function List({ block }: { block: boolean }) {
      return (
        <OptionList.Root
          aria-label="l"
          value={null}
          onValueChange={onChange}
          onKeyDown={(event) => {
            if (block) event.preventDefault();
          }}
        >
          <OptionList.Option value="a">a</OptionList.Option>
        </OptionList.Root>
      );
    }
    const { rerender } = render(<List block />);
    fireEvent.keyDown(screen.getByRole('listbox'), { key: 'Enter' });
    expect(onChange).not.toHaveBeenCalled();
    rerender(<List block={false} />);
    fireEvent.keyDown(screen.getByRole('listbox'), { key: 'Enter' });
    expect(onChange).toHaveBeenCalledWith('a');
  });

  it('ignores a preventDefault from a child, which is not the consumer opting out', () => {
    render(
      <Field.Root aria-label="t" data-testid="shell">
        <Field.Icon data-testid="icon" onMouseDown={(event) => event.preventDefault()}>
          *
        </Field.Icon>
        <Field.TextInput value="" onChange={noop} />
      </Field.Root>,
    );
    fireEvent.mouseDown(screen.getByTestId('icon'));
    expect(document.activeElement).toBe(screen.getByRole('textbox'));
  });

  it('keeps built-in names and focusability when a wrapper passes undefined through', () => {
    render(
      <Dialog.Root open onOpenChange={noop} aria-labelledby={undefined} tabIndex={undefined} data-testid="dlg">
        <Dialog.Title>Save</Dialog.Title>
      </Dialog.Root>,
    );
    const dialog = screen.getByTestId('dlg');
    expect(dialog.getAttribute('aria-labelledby')).toBe(screen.getByText('Save').id);
    expect(dialog.tabIndex).toBe(-1);
    cleanup();
    render(
      <BottomSheet.Root open onOpenChange={noop} aria-describedby={undefined} tabIndex={undefined} data-testid="sheet">
        <BottomSheet.Description>More</BottomSheet.Description>
      </BottomSheet.Root>,
    );
    const sheet = screen.getByTestId('sheet');
    expect(sheet.getAttribute('aria-describedby')).toBe(screen.getByText('More').id);
    expect(sheet.tabIndex).toBe(-1);
  });

  it('lets Popover take a consumer tabIndex', () => {
    function Harness() {
      const popover = usePopover({ open: true });
      return (
        <Popover.Root {...popover.getPopoverProps()} tabIndex={0} role="dialog" aria-label="Menu">
          Menu
        </Popover.Root>
      );
    }
    render(<Harness />);
    expect(screen.getByText('Menu').tabIndex).toBe(0);
  });

  it('keeps Field.Root focusing its input after a consumer onMouseDown', () => {
    const onMouseDown = vi.fn();
    render(
      <Field.Root aria-label="t" data-testid="shell" onMouseDown={onMouseDown}>
        <Field.TextInput value="" onChange={noop} />
      </Field.Root>,
    );
    fireEvent.mouseDown(screen.getByTestId('shell'));
    expect(onMouseDown).toHaveBeenCalledOnce();
    expect(document.activeElement).toBe(screen.getByRole('textbox'));
  });

  it('keeps the Dialog backdrop and a consumer onClick both working', () => {
    const onOpenChange = vi.fn();
    const onClick = vi.fn();
    function Harness() {
      const ref = useRef<HTMLDialogElement>(null);
      return (
        <Dialog.Root ref={ref} open onOpenChange={onOpenChange} onClick={onClick} aria-label="d" data-testid="dlg">
          x
        </Dialog.Root>
      );
    }
    render(<Harness />);
    const dialog = screen.getByTestId('dlg');
    fireEvent.pointerDown(dialog);
    fireEvent.click(dialog);
    expect(onClick).toHaveBeenCalledOnce();
    expect(onOpenChange).toHaveBeenCalledWith(false, 'backdrop');
  });
});

describe('composeRefs', () => {
  it('sets object and callback refs and clears them on detach', () => {
    const object = createRef<HTMLDivElement>();
    const seen: (HTMLDivElement | null)[] = [];
    const { unmount } = render(<div ref={composeRefs(object, (node) => void seen.push(node))} />);
    expect(object.current).toBeInstanceOf(HTMLDivElement);
    unmount();
    expect(object.current).toBeNull();
    expect(seen).toEqual([expect.any(HTMLDivElement), null]);
  });
});

describe('wrapped parts', () => {
  function AcmeOption({ value, label, disabled }: { value: string; label: string; disabled?: boolean }) {
    return (
      <OptionList.Option value={value} disabled={disabled}>
        {label}
      </OptionList.Option>
    );
  }

  it('keeps keyboard order and disabled state for options inside a company wrapper', () => {
    const onChange = vi.fn();
    render(
      <OptionList.Root aria-label="Fruit" value={null} onValueChange={onChange}>
        <AcmeOption value="a" label="A" />
        <div>
          <AcmeOption value="b" label="B" disabled />
        </div>
        <AcmeOption value="c" label="C" />
      </OptionList.Root>,
    );
    const list = screen.getByRole('listbox');
    fireEvent.keyDown(list, { key: 'ArrowDown' });
    fireEvent.keyDown(list, { key: 'Enter' });
    expect(onChange).toHaveBeenCalledWith('c');
  });

  it('follows options that move without remounting', () => {
    const onChange = vi.fn();
    function List({ order }: { order: string[] }) {
      return (
        <OptionList.Root aria-label="Fruit" value={null} onValueChange={onChange}>
          {order.map((v) => (
            <AcmeOption key={v} value={v} label={v.toUpperCase()} />
          ))}
        </OptionList.Root>
      );
    }
    const { rerender } = render(<List order={['a', 'b', 'c']} />);
    rerender(<List order={['c', 'b', 'a']} />);
    const list = screen.getByRole('listbox');
    fireEvent.keyDown(list, { key: 'Home' });
    fireEvent.keyDown(list, { key: 'Enter' });
    expect(onChange).toHaveBeenLastCalledWith('c');
  });

  it('detects an icon-only button when Button.Icon sits inside a company icon', () => {
    function AcmeIcon() {
      return (
        <span className="acme">
          <Button.Icon>+</Button.Icon>
        </span>
      );
    }
    render(
      <>
        <Button.Root aria-label="Add">
          <AcmeIcon />
        </Button.Root>
        <Button.Root>
          <AcmeIcon />
          Save
        </Button.Root>
      </>,
    );
    expect(screen.getByRole('button', { name: 'Add' }).hasAttribute('data-icon-only')).toBe(true);
    expect(screen.getByRole('button', { name: 'Save' }).hasAttribute('data-icon-only')).toBe(false);
  });

  it('drops the default grabber when a company wrapper places its own', () => {
    function AcmeGrabber() {
      return <BottomSheet.Grabber data-testid="acme-grabber" aria-label="Drag" />;
    }
    render(
      <BottomSheet.Root open onOpenChange={noop} aria-label="s">
        <AcmeGrabber />
      </BottomSheet.Root>,
    );
    expect(screen.getByTestId('acme-grabber')).toBeTruthy();
    expect(screen.getAllByRole('button', { name: /drag|resize sheet/i })).toHaveLength(1);
  });
});

describe('wrapped parts that change on their own', () => {
  it('re-reads a button whose child swaps an icon for text from its own state', async () => {
    let swap: () => void = noop;
    function Toggle() {
      const [text, setText] = useState(false);
      swap = () => setText(true);
      return text ? <>Saved</> : <Button.Icon>+</Button.Icon>;
    }
    render(
      <Button.Root aria-label="Save" data-testid="btn">
        <Toggle />
      </Button.Root>,
    );
    const button = screen.getByTestId('btn');
    expect(button.hasAttribute('data-icon-only')).toBe(true);
    act(() => swap());
    await waitFor(() => expect(button.hasAttribute('data-icon-only')).toBe(false));
  });

  it('re-sorts options that a wrapper reorders from its own state', async () => {
    const onChange = vi.fn();
    let reverse: () => void = noop;
    function AcmeOptions() {
      const [order, setOrder] = useState(['a', 'b', 'c']);
      reverse = () => setOrder(['c', 'b', 'a']);
      return order.map((v) => (
        <OptionList.Option key={v} value={v}>
          {v.toUpperCase()}
        </OptionList.Option>
      ));
    }
    render(
      <OptionList.Root aria-label="Fruit" value={null} onValueChange={onChange}>
        <AcmeOptions />
      </OptionList.Root>,
    );
    act(() => reverse());
    const list = screen.getByRole('listbox');
    await waitFor(() => {
      fireEvent.keyDown(list, { key: 'Home' });
      fireEvent.keyDown(list, { key: 'Enter' });
      expect(onChange).toHaveBeenLastCalledWith('c');
    });
  });

  it('marks a direct icon-only button in server HTML', () => {
    const html = renderToString(
      <Button.Root aria-label="Add">
        <Button.Icon>+</Button.Icon>
      </Button.Root>,
    );
    expect(html).toContain('data-icon-only');
  });

  it('focuses the placed grabber when a sheet mounts open with one', async () => {
    function AcmeGrabber() {
      return <BottomSheet.Grabber aria-label="Drag" />;
    }
    render(
      <BottomSheet.Root open onOpenChange={noop} aria-label="s">
        <AcmeGrabber />
      </BottomSheet.Root>,
    );
    await waitFor(() => expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Drag' })));
  });
});

it('keeps the same button element when it gains a tooltip', () => {
  function Late() {
    return <Button.Icon>+</Button.Icon>;
  }
  const { rerender } = render(<Button.Root aria-label="Add" data-testid="b" />);
  const first = screen.getByTestId('b');
  rerender(
    <Button.Root aria-label="Add" data-testid="b">
      <Late />
    </Button.Root>,
  );
  expect(screen.getByTestId('b')).toBe(first);
  expect(first.hasAttribute('data-icon-only')).toBe(true);
});

it('sorts a large option list a bounded number of times while mounting', () => {
  const values = Array.from({ length: 300 }, (_, i) => `v${i}`);
  const compare = vi.spyOn(Node.prototype, 'compareDocumentPosition');
  render(
    <OptionList.Root aria-label="Many" value={null} onValueChange={noop}>
      {values.map((v) => (
        <OptionList.Option key={v} value={v}>
          {v}
        </OptionList.Option>
      ))}
    </OptionList.Root>,
  );
  // A few renders of one n·log n sort each, not one sort per option.
  expect(compare.mock.calls.length).toBeLessThan(300 * 9 * 6);
  compare.mockRestore();
});

it('tips only the overflowing label text, not nested badges', () => {
  const widths = vi.spyOn(HTMLElement.prototype, 'scrollWidth', 'get').mockReturnValue(200);
  const client = vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(50);
  render(
    <Button.Root>
      Save changes
      <span>3</span>
    </Button.Root>,
  );
  const button = screen.getByRole('button');
  fireEvent.focus(button);
  expect(screen.getByRole('tooltip', { hidden: true }).textContent).toBe('Save changes');
  widths.mockRestore();
  client.mockRestore();
});

it('marks the active option in server HTML', () => {
  const html = renderToString(
    <OptionList.Root aria-label="Fruit" value="b" onValueChange={noop}>
      <OptionList.Option value="a">A</OptionList.Option>
      <OptionList.Option value="b">B</OptionList.Option>
    </OptionList.Root>,
  );
  expect(html).toMatch(/aria-activedescendant="[^"]*b[^"]*"/);
});

it('does not warn when a button swaps an icon and its label for text in one render', () => {
  const error = vi.spyOn(console, 'error').mockImplementation(noop);
  const { rerender } = render(
    <Button.Root aria-label="Save">
      <Button.Icon>+</Button.Icon>
    </Button.Root>,
  );
  rerender(<Button.Root>Save</Button.Root>);
  expect(error).not.toHaveBeenCalled();
  error.mockRestore();
});

it('detects an icon-only button rendered into an iframe', () => {
  const frame = document.createElement('iframe');
  document.body.append(frame);
  const container = frame.contentDocument!.body;
  const root = createRoot(container);
  act(() =>
    root.render(
      <Button.Root aria-label="Add">
        <Button.Icon>+</Button.Icon>
      </Button.Root>,
    ),
  );
  expect(container.querySelector('button')!.hasAttribute('data-icon-only')).toBe(true);
  act(() => root.unmount());
  frame.remove();
});

it('does not treat an icon beside an image as icon-only', () => {
  const error = vi.spyOn(console, 'error').mockImplementation(noop);
  render(
    <Button.Root data-testid="b">
      <Button.Icon>*</Button.Icon>
      <img alt="Settings" src="data:," />
    </Button.Root>,
  );
  expect(screen.getByTestId('b').hasAttribute('data-icon-only')).toBe(false);
  expect(error).not.toHaveBeenCalled();
  error.mockRestore();
});
