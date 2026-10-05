import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { createRef, useRef, useState, type ReactNode, type RefObject } from 'react';
import { renderToString } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  BottomSheet,
  Button,
  ButtonGroup,
  Checkbox,
  Chip,
  ChipOverflow,
  Description,
  Dialog,
  ErrorMessage,
  Field,
  Label,
  Option,
  OptionList,
  Popover,
  Radio,
  RadioGroup,
  Stack,
  Switch,
  Text,
  Tooltip,
  composeRefs,
  usePopover,
  useTooltip,
} from '../index';

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
    <Popover {...wire} ref={composeRefs(wireRef, p.ref)} data-testid={p['data-testid']} aria-label="Menu">
      Menu
    </Popover>
  );
}

function TooltipCase({ p }: { p: Native }) {
  const tip = useTooltip({ open: true });
  const { ref: wireRef, ...wire } = tip.getTooltipProps();
  return (
    <Tooltip {...wire} ref={composeRefs(wireRef, p.ref)} data-testid={p['data-testid']}>
      Tip
    </Tooltip>
  );
}

const cases: Case[] = [
  ['Stack', (p) => <Stack {...p} />],
  ['Text', (p) => <Text {...p}>Hi</Text>],
  ['Label', (p) => <Label {...p} htmlFor="x" />],
  ['Description', (p) => <Description {...p} id="d" />],
  ['ErrorMessage', (p) => <ErrorMessage {...p} id="e" />],
  ['Chip', (p) => <Chip {...p}>a</Chip>],
  ['ChipOverflow', (p) => <ChipOverflow {...p} overflowCount={2} />],
  ['Checkbox', (p) => <Checkbox {...p}>c</Checkbox>],
  ['Switch', (p) => <Switch {...p}>s</Switch>],
  ['RadioGroup', (p) => <RadioGroup {...p} aria-label="g" />],
  [
    'Radio',
    (p) => (
      <RadioGroup aria-label="g">
        <Radio {...p} value="a">
          a
        </Radio>
      </RadioGroup>
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
  ['ButtonGroup', (p) => <ButtonGroup {...p} aria-label="g" />],
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
    'Field.Counter',
    (p) => (
      <Field.Root aria-label="t">
        <Field.TextInput value="ab" onChange={noop} maxLength={5} />
        <Field.Counter {...p} />
      </Field.Root>
    ),
  ],
  [
    'Dialog',
    (p) => (
      <Dialog {...p} open onOpenChange={noop} aria-label="d">
        x
      </Dialog>
    ),
  ],
  ...(['Title', 'Description', 'Header', 'Body', 'Footer', 'Close'] as const).map(
    (part): Case => [
      `Dialog.${part}`,
      (p) => {
        const Part = Dialog[part] as (props: Native) => ReactNode;
        return (
          <Dialog open onOpenChange={noop} aria-label="d">
            <Part {...p} />
          </Dialog>
        );
      },
    ],
  ),
  ['BottomSheet', (p) => <BottomSheet {...p} open onOpenChange={noop} aria-label="s" />],
  ...(['Grabber', 'Header', 'Title', 'Description', 'Body', 'Footer', 'Close'] as const).map(
    (part): Case => [
      `BottomSheet.${part}`,
      (p) => {
        const Part = BottomSheet[part] as (props: Native) => ReactNode;
        return (
          <BottomSheet open onOpenChange={noop} aria-label="s">
            <Part {...p} />
          </BottomSheet>
        );
      },
    ],
  ),
  [
    'OptionList',
    (p) => (
      <OptionList {...p} aria-label="l" value={null} onChange={noop}>
        <Option value="a">a</Option>
      </OptionList>
    ),
  ],
  [
    'Option',
    (p) => (
      <OptionList aria-label="l" value={null} onChange={noop}>
        <Option {...p} value="a">
          a
        </Option>
      </OptionList>
    ),
  ],
  ['Popover', (p) => <PopoverCase p={p} />],
  ['Tooltip', (p) => <TooltipCase p={p} />],
];

describe('every exported part', () => {
  it.each(cases)('%s forwards native attributes and a ref', (name, part) => {
    const ref = createRef<HTMLElement>();
    render(<>{part({ 'data-testid': name, ref })}</>);
    const el = screen.getByTestId(name);
    expect(ref.current).toBe(el);
  });
});

describe('composed handlers', () => {
  it('run the consumer handler first and let preventDefault skip the built-in behavior', () => {
    const onChange = vi.fn();
    function List({ block }: { block: boolean }) {
      return (
        <OptionList
          aria-label="l"
          value={null}
          onChange={onChange}
          onKeyDown={(event) => {
            if (block) event.preventDefault();
          }}
        >
          <Option value="a">a</Option>
        </OptionList>
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
      <Dialog open onOpenChange={noop} aria-labelledby={undefined} tabIndex={undefined} data-testid="dlg">
        <Dialog.Title>Save</Dialog.Title>
      </Dialog>,
    );
    const dialog = screen.getByTestId('dlg');
    expect(dialog.getAttribute('aria-labelledby')).toBe(screen.getByText('Save').id);
    expect(dialog.tabIndex).toBe(-1);
    cleanup();
    render(
      <BottomSheet open onOpenChange={noop} aria-describedby={undefined} tabIndex={undefined} data-testid="sheet">
        <BottomSheet.Description>More</BottomSheet.Description>
      </BottomSheet>,
    );
    const sheet = screen.getByTestId('sheet');
    expect(sheet.getAttribute('aria-describedby')).toBe(screen.getByText('More').id);
    expect(sheet.tabIndex).toBe(-1);
  });

  it('lets Popover take a consumer tabIndex', () => {
    function Harness() {
      const popover = usePopover({ open: true });
      return (
        <Popover {...popover.getPopoverProps()} tabIndex={0} aria-label="Menu">
          Menu
        </Popover>
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
        <Dialog ref={ref} open onOpenChange={onOpenChange} onClick={onClick} aria-label="d" data-testid="dlg">
          x
        </Dialog>
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
      <Option value={value} disabled={disabled}>
        {label}
      </Option>
    );
  }

  it('keeps keyboard order and disabled state for options inside a company wrapper', () => {
    const onChange = vi.fn();
    render(
      <OptionList aria-label="Fruit" value={null} onChange={onChange}>
        <AcmeOption value="a" label="A" />
        <div>
          <AcmeOption value="b" label="B" disabled />
        </div>
        <AcmeOption value="c" label="C" />
      </OptionList>,
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
        <OptionList aria-label="Fruit" value={null} onChange={onChange}>
          {order.map((v) => (
            <AcmeOption key={v} value={v} label={v.toUpperCase()} />
          ))}
        </OptionList>
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
      <BottomSheet open onOpenChange={noop} aria-label="s">
        <AcmeGrabber />
      </BottomSheet>,
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
        <Option key={v} value={v}>
          {v.toUpperCase()}
        </Option>
      ));
    }
    render(
      <OptionList aria-label="Fruit" value={null} onChange={onChange}>
        <AcmeOptions />
      </OptionList>,
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
      <BottomSheet open onOpenChange={noop} aria-label="s">
        <AcmeGrabber />
      </BottomSheet>,
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
    <OptionList aria-label="Many" value={null} onChange={noop}>
      {values.map((v) => (
        <Option key={v} value={v}>
          {v}
        </Option>
      ))}
    </OptionList>,
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
