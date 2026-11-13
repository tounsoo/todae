/**
 * Public hooks that apps call on their own, without a todae component that
 * wraps them. Each case wires its hook to plain HTML where the hook allows, so
 * the numbers are the hook's own cost, and its id starts with `use-`. A hook
 * that only reaches apps through one component points at that component's
 * cases with `via`.
 */
import {
  Checkbox,
  Chip,
  DensityProvider,
  Field,
  GlyphsProvider,
  OptionList,
  Popover,
  StringsProvider,
  ThemeProvider,
  VisuallyHidden,
  useAnnouncer,
  useAppearance,
  useChipField,
  useChipList,
  useClipboard,
  useCombobox,
  useControlledState,
  useDensity,
  useDropzone,
  useField,
  useFocusHandoff,
  useGlyphs,
  useHighlight,
  useHotkey,
  useInlineEdit,
  useMentions,
  useModalLayer,
  useLaneDrag,
  useLaneDragState,
  useReorder,
  useReorderGroup,
  useRovingFocus,
  useSelection,
  useSheetPresentation,
  useStrings,
  type ComboboxOption,
  type LanePlace,
  type UseLaneDragResult,
  type MentionTrigger,
  type ReorderGroup,
  type ReorderPlace,
} from '@tounsoo/todae';
import { useEffect, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import { click, first, many, range, type CaseProps, type CoverageGroup, type ItemProps } from './types.tsx';

const PLANS: ComboboxOption[] = [
  { value: 'free', label: 'Free' },
  { value: 'team', label: 'Team' },
  { value: 'business', label: 'Business' },
  { value: 'enterprise', label: 'Enterprise' },
];

/** A closed single-select combobox with Field, Popover and OptionList, and a plain label. */
function ComboboxItem({ index, tick }: ItemProps) {
  const cb = useCombobox({ options: PLANS, presentation: 'popover' });
  return (
    <div>
      <label {...cb.getLabelProps()}>
        Plan {index} {tick}
      </label>
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

/** A three-button toolbar of plain buttons. */
function RovingFocusItem({ index, tick }: ItemProps) {
  const roving = useRovingFocus({ orientation: 'horizontal' });
  return (
    <div role="toolbar" aria-label={`Format ${index}`} {...roving.getContainerProps()}>
      <button type="button" data-bench-trigger {...roving.getItemProps('bold')}>
        Bold {tick}
      </button>
      <button type="button" {...roving.getItemProps('italic')}>
        Italic
      </button>
      <button type="button" {...roving.getItemProps('underline')}>
        Underline
      </button>
    </div>
  );
}

const noop = () => {};

/** A plain button with its own keyboard shortcut. */
function HotkeyItem({ index, tick }: ItemProps) {
  const keys = ['Control+K', 'Meta+K'];
  useHotkey(keys, noop);
  return (
    <button type="button" aria-keyshortcuts={keys.join(' ')}>
      Search {index} {tick}
    </button>
  );
}

/** A paragraph that highlights a search term, under its own highlight name as the docs ask. */
function HighlightItem({ index, tick }: ItemProps) {
  const found = useHighlight({ name: `bench-search-${index}`, query: 'invoice' });
  return (
    <p ref={found.ref} data-matches={found.matches.length}>
      Invoice {index} for the order of a customer, version {tick}
    </p>
  );
}

/** A name with a Rename button that opens a plain input in place. */
function InlineEditItem({ index, tick }: ItemProps) {
  const [name, setName] = useState(`Report ${index}`);
  const edit = useInlineEdit({ value: name, onCommit: setName });
  if (edit.editing) {
    return (
      <div {...edit.getGroupProps()}>
        <input aria-label="Name" {...edit.getInputProps()} />
        <button type="button" onClick={edit.commit}>
          Save
        </button>
      </div>
    );
  }
  return (
    <div>
      <span>
        {name} {tick}
      </span>
      <button type="button" data-bench-trigger {...edit.getTriggerProps()}>
        Rename
      </button>
    </div>
  );
}

/** Sets a controlled input's or textarea's value the way typing does, so React sees the change. */
function typeInto(element: HTMLInputElement | HTMLTextAreaElement, value: string) {
  const prototype = element instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
  Object.getOwnPropertyDescriptor(prototype, 'value')!.set!.call(element, value);
  element.setSelectionRange(value.length, value.length);
  element.dispatchEvent(new Event('input', { bubbles: true }));
}

const key = (target: Element, name: string) =>
  target.dispatchEvent(new KeyboardEvent('keydown', { key: name, bubbles: true, cancelable: true }));

/** A button that announces a saved message. */
function AnnouncerItem({ index, tick }: ItemProps) {
  const announce = useAnnouncer();
  return (
    <button type="button" data-bench-trigger onClick={() => announce(`Draft ${index} saved`)}>
      Save draft {index} {tick}
    </button>
  );
}

function AppearanceReader({ index, tick }: ItemProps) {
  const appearance = useAppearance();
  return (
    <span>
      Row {index} is {appearance} {tick}
    </span>
  );
}

function AppearanceCase({ copies, tick }: CaseProps) {
  return (
    <ThemeProvider appearance="dark">
      {range(copies).map((index) => (
        <AppearanceReader key={index} index={index} tick={tick} />
      ))}
    </ThemeProvider>
  );
}

/** A tag field whose chips and input value come from the hook. */
function ChipFieldItem({ index, tick }: ItemProps) {
  const field = useChipField({ initialChips: ['react'] });
  return (
    <Field.Root aria-label={`Tags ${index} ${tick}`}>
      <Field.ChipInput {...field.getChipInputProps()} placeholder="Add a tag" />
    </Field.Root>
  );
}

let tagCount = 0;

const SKILLS = ['design systems', 'accessibility', 'typography', 'motion', 'research', 'prototyping'];

/** A row of chips folded to one line, with the measure row the docs ask for. */
function ChipListItem({ index, tick }: ItemProps) {
  const { listRef, measureRef, visible, hidden, measured } = useChipList({ chips: SKILLS, maxRows: 1 });
  const { moreChips } = useStrings();
  return (
    <div style={{ position: 'relative' }}>
      <div ref={listRef} role="list" aria-label={`Skills ${index} ${tick}`} style={{ visibility: measured ? undefined : 'hidden' }}>
        {visible.map((chip) => (
          <Chip.Root key={chip.key} role="listitem" style={chip.ellipsis ? { maxWidth: chip.maxWidth } : undefined}>
            {chip.value}
          </Chip.Root>
        ))}
        {hidden > 0 ? (
          <span role="listitem">
            <Chip.Root aria-hidden>{`+${hidden}`}</Chip.Root>
            <VisuallyHidden.Root>{moreChips(hidden)}</VisuallyHidden.Root>
          </span>
        ) : null}
      </div>
      <div ref={measureRef} aria-hidden inert>
        {SKILLS.map((value, position) => (
          <Chip.Root key={position}>{value}</Chip.Root>
        ))}
        <Chip.Root>…</Chip.Root>
        <Chip.Root>{`+${SKILLS.length}`}</Chip.Root>
      </div>
    </div>
  );
}

// Without a secure context and a permission, Chromium refuses writeText and jsdom has no clipboard,
// so the bench gives the copy a clipboard that accepts it. The copy then takes the success path in both.
let clipboardUsers = 0;
let clipboardBefore: PropertyDescriptor | undefined;

function useClipboardStub() {
  useEffect(() => {
    if (clipboardUsers++ === 0) {
      clipboardBefore = Object.getOwnPropertyDescriptor(navigator, 'clipboard');
      Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: () => Promise.resolve() } });
    }
    return () => {
      if (--clipboardUsers > 0) return;
      if (clipboardBefore) Object.defineProperty(navigator, 'clipboard', clipboardBefore);
      else Reflect.deleteProperty(navigator, 'clipboard');
    };
  }, []);
}

/** A copy button for a command, with its result beside it. */
function ClipboardItem({ index, tick }: ItemProps) {
  useClipboardStub();
  const { copy, status } = useClipboard();
  return (
    <div>
      <code>pnpm add @tounsoo/todae</code>
      <button type="button" data-bench-trigger onClick={() => void copy('pnpm add @tounsoo/todae')}>
        Copy command {index} {tick}
      </button>
      <span>{status === 'copied' ? 'Copied' : ''}</span>
    </div>
  );
}

/** A filter with a value prop, a default and a change callback, owned by its parent. */
function Filter({ value, onValueChange }: { value?: string; onValueChange?: (next: string) => void }) {
  const [current, change] = useControlledState(value, 'all', onValueChange);
  return (
    <select aria-label="Status" value={current} onChange={(event) => change(event.currentTarget.value)}>
      <option value="all">All</option>
      <option value="open">Open</option>
    </select>
  );
}

function ControlledStateItem({ index, tick }: ItemProps) {
  const [status, setStatus] = useState('all');
  return (
    <label>
      Show {index} {tick}
      <Filter value={status} onValueChange={setStatus} />
    </label>
  );
}

/** The densities the provider and its readers pass along. */
function DensityReader({ index, tick }: ItemProps) {
  const density = useDensity();
  return (
    <span>
      Row {index} is {density} {tick}
    </span>
  );
}

function DensityCase({ copies, tick }: CaseProps) {
  return (
    <DensityProvider density="compact">
      {range(copies).map((index) => (
        <DensityReader key={index} index={index} tick={tick} />
      ))}
    </DensityProvider>
  );
}

// A drop with no browser drag behind it: both jsdom and Chromium take a synthetic event with these fields.
function dropEvent(type: string, files: File[]) {
  return Object.assign(new Event(type, { bubbles: true, cancelable: true }), {
    dataTransfer: { types: ['Files'], files, items: [], dropEffect: 'none' },
  });
}

/** A label that takes images by drop, with the names it took beside it. */
function DropzoneItem({ index, tick }: ItemProps) {
  const [names, setNames] = useState<string[]>([]);
  const zone = useDropzone({
    accept: 'image/*',
    multiple: true,
    maxSize: 2_000_000,
    onFiles: (accepted) => setNames(accepted.map((file) => file.name)),
  });
  return (
    <label data-bench-trigger {...zone.getRootProps()}>
      Drop images {index} {tick} or choose them
      <input {...zone.getInputProps()} name="images" />
      <span>{names.join(', ')}</span>
    </label>
  );
}

/** A custom rating joined to Field.Root, as the docs show. */
function Stars({ value, onChange }: { value: number; onChange: (value: number) => void }) {
  const field = useField();
  const { disabled } = field;
  const step = (delta: number) => onChange(Math.min(5, Math.max(0, value + delta)));
  return (
    <span
      {...field.getControlProps({}, { native: false })}
      role="slider"
      tabIndex={disabled ? -1 : 0}
      aria-valuemin={0}
      aria-valuemax={5}
      aria-valuenow={value}
      aria-valuetext={`${value} of 5 stars`}
      data-bench-trigger
      onKeyDown={(event) => {
        if (disabled) return;
        if (event.key === 'ArrowRight') step(1);
        else if (event.key === 'ArrowLeft') step(-1);
        else return;
        event.preventDefault();
      }}
    >
      {'★'.repeat(value)}
      {'☆'.repeat(5 - value)}
    </span>
  );
}

function FieldItem({ index, tick }: ItemProps) {
  const [stars, setStars] = useState(3);
  return (
    <Field.Root aria-label={`Rating ${index} ${tick}`}>
      <Stars value={stars} onChange={setStars} />
    </Field.Root>
  );
}

/** Two sets of buttons that hand focus to the button that replaces them. */
function FocusHandoffItem({ index, tick }: ItemProps) {
  const [answer, setAnswer] = useState<'allowed' | null>(null);
  const allow = useRef<HTMLButtonElement>(null);
  const askAgain = useRef<HTMLButtonElement>(null);
  const choices = useFocusHandoff({ to: askAgain });
  const result = useFocusHandoff({ to: allow });
  return answer === null ? (
    <div key="choices" ref={choices} role="group" aria-label={`Delete ${index}`}>
      <button ref={allow} type="button" data-bench-trigger onClick={() => setAnswer('allowed')}>
        Allow {tick}
      </button>
      <button type="button">Deny</button>
    </div>
  ) : (
    <div key="result" ref={result}>
      <span>Allowed.</span>
      <button ref={askAgain} type="button" data-bench-trigger onClick={() => setAnswer(null)}>
        Ask again {tick}
      </button>
    </div>
  );
}

const GLYPHS = { close: '×' };

function GlyphsReader({ index, tick }: ItemProps) {
  const { close } = useGlyphs();
  return (
    <span>
      Row {index} {close} {tick}
    </span>
  );
}

function GlyphsCase({ copies, tick }: CaseProps) {
  return (
    <GlyphsProvider glyphs={GLYPHS}>
      {range(copies).map((index) => (
        <GlyphsReader key={index} index={index} tick={tick} />
      ))}
    </GlyphsProvider>
  );
}

const MENTION_TRIGGERS: MentionTrigger[] = [
  {
    char: '@',
    label: 'People',
    options: [
      { value: 'ada', label: 'Ada Lovelace' },
      { value: 'alan', label: 'Alan Turing' },
      { value: 'grace', label: 'Grace Hopper' },
      { value: 'katherine', label: 'Katherine Johnson' },
    ],
  },
];

/** A message box that suggests people after @. */
function MentionsItem({ index, tick }: ItemProps) {
  const mentions = useMentions({ triggers: MENTION_TRIGGERS });
  return (
    <div>
      <Field.Root aria-label={`Message ${index} ${tick}`}>
        <Field.Textarea {...mentions.getTextareaProps()} placeholder="Type @" />
      </Field.Root>
      <Popover.Root {...mentions.getPopoverProps()}>
        <OptionList.Root {...mentions.getListboxProps()}>
          {mentions.items.map((item) => (
            <OptionList.Option key={item.id} {...mentions.getOptionProps(item)} />
          ))}
        </OptionList.Root>
      </Popover.Root>
    </div>
  );
}

/** A dialog of the app's own, in the modal stack. */
function ModalLayerItem({ index, tick }: ItemProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDialogElement>(null);
  useModalLayer(ref, open);
  useEffect(() => {
    if (open) ref.current?.showModal();
    else ref.current?.close();
  }, [open]);
  return (
    <div>
      {open ? null : (
        <button type="button" data-bench-trigger onClick={() => setOpen(true)}>
          Open note {index} {tick}
        </button>
      )}
      <dialog ref={ref} aria-label={`Note ${index}`} onClose={() => setOpen(false)}>
        <p>Remember the invoice.</p>
        <button type="button" data-bench-trigger onClick={() => setOpen(false)}>
          Close {tick}
        </button>
      </dialog>
    </div>
  );
}

const CHANNELS = ['general', 'design', 'releases', 'support'];

/** A list of rows, each dragged by its own handle. */
function ReorderItem({ index, tick }: ItemProps) {
  const [channels, setChannels] = useState(CHANNELS);
  const reorder = useReorder({
    onMove: (from, to) =>
      setChannels((all) => {
        const next = [...all];
        next.splice(to, 0, next.splice(from, 1)[0]!);
        return next;
      }),
  });
  return (
    <ol aria-label={`Channels ${index} ${tick}`}>
      {channels.map((channel, position) => (
        <li key={channel} {...reorder.getItemProps(position)}>
          <span aria-hidden data-bench-handle {...reorder.getHandleProps(position)}>
            ::
          </span>{' '}
          {channel}
        </li>
      ))}
    </ol>
  );
}

const LANES = [
  ['general', 'design'],
  ['releases', 'support'],
];

/** One lane of a ReorderGroupItem: a list in the group, with its own handles. */
function Lane({ lane, rows, group, move }: { lane: number; rows: string[]; group: ReorderGroup<number>; move: (from: ReorderPlace<number>, to: ReorderPlace<number>) => void }) {
  const reorder = useReorder({ group, list: lane, onMove: (from, to) => move({ list: lane, index: from }, { list: lane, index: to }) });
  return (
    <ol {...reorder.getListProps()}>
      {rows.map((row, position) => (
        <li key={row} {...reorder.getItemProps(position)}>
          <span aria-hidden data-bench-handle {...reorder.getHandleProps(position)}>
            ::
          </span>{' '}
          {row}
        </li>
      ))}
    </ol>
  );
}

/** Two lists in one group, so a row can move from one to the other. */
function ReorderGroupItem({ index, tick }: ItemProps) {
  const [lanes, setLanes] = useState(LANES);
  const move = (from: ReorderPlace<number>, to: ReorderPlace<number>) =>
    setLanes((all) => {
      const next = all.map((lane) => [...lane]);
      next[to.list]!.splice(to.index, 0, next[from.list]!.splice(from.index, 1)[0]!);
      return next;
    });
  const group = useReorderGroup<number>({ onMove: move });
  return (
    <div aria-label={`Lanes ${index} ${tick}`} role="group">
      {lanes.map((rows, lane) => (
        <Lane key={lane} lane={lane} rows={rows} group={group} move={move} />
      ))}
    </div>
  );
}

/** Mouse down on the first lane's first handle, then drag it to the lower half of the other lane's last row and drop. */
function dragToOtherLane(container: HTMLElement) {
  const handle = first<HTMLElement>(container, '[data-bench-handle]');
  const lanes = handle.closest('[role="group"]')!.querySelectorAll('ol');
  const stored = new Set<string>();
  const dataTransfer = {
    get types() {
      return [...stored];
    },
    setData: (type: string) => void stored.add(type),
    effectAllowed: 'none',
    dropEffect: 'none',
  };
  const drag = (type: string, target: Element, clientY = 0) =>
    target.dispatchEvent(Object.assign(new Event(type, { bubbles: true, cancelable: true }), { dataTransfer, clientX: 0, clientY }));
  flushSync(() => handle.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true, button: 0 })));
  const target = lanes[1]!.querySelectorAll('li')[1]!;
  const box = target.getBoundingClientRect();
  drag('dragstart', handle.closest('li')!);
  drag('dragover', target, box.top + box.height * 0.75);
  drag('drop', target, box.top + box.height * 0.75);
}

/** Mouse down on the first row's handle, then drag it to the lower half of the third row and drop. */
function dragFirstRowDown(container: HTMLElement) {
  const handle = first<HTMLElement>(container, '[data-bench-handle]');
  const rows = handle.closest('ol')!.querySelectorAll('li');
  const stored = new Set<string>();
  const dataTransfer = {
    get types() {
      return [...stored];
    },
    setData: (type: string) => void stored.add(type),
    effectAllowed: 'none',
    dropEffect: 'none',
  };
  const drag = (type: string, target: Element, clientY = 0) =>
    target.dispatchEvent(Object.assign(new Event(type, { bubbles: true, cancelable: true }), { dataTransfer, clientX: 0, clientY }));
  // Rendered before the drag starts, as a real press is: only an armed row can drag.
  flushSync(() => handle.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true, button: 0 })));
  const target = rows[2]!;
  const box = target.getBoundingClientRect();
  drag('dragstart', rows[0]!);
  drag('dragover', target, box.top + box.height * 0.75);
  drag('drop', target, box.top + box.height * 0.75);
}

type Slot = { id: string; at: LanePlace };

const SLOTS: Slot[] = [
  { id: 'keynote', at: { lane: 'main', start: 0, end: 60 } },
  { id: 'tokens', at: { lane: 'main', start: 90, end: 120 } },
  { id: 'forms', at: { lane: 'side', start: 30, end: 75 } },
];

/** Where a drag would put a slot in one lane, read with useLaneDragState. */
function LanePreview({ drag, lane }: { drag: UseLaneDragResult['drag']; lane: string }) {
  const to = useLaneDragState(drag, (state) => (state?.to?.lane === lane ? state.to : null));
  return to ? <span data-bench-preview>{`${to.start} to ${to.end}`}</span> : null;
}

/** Two lanes over a 240-unit day with three slots, each with a move handle, and a preview in each lane. */
function LaneBoardItem({ index, tick }: ItemProps) {
  const [slots, setSlots] = useState(SLOTS);
  const lanes = useLaneDrag({
    range: { start: 0, end: 240 },
    grid: range(17).map((step) => step * 15),
    check: (id, to) =>
      slots.some((slot) => slot.id !== id && slot.at.lane === to.lane && slot.at.start < to.end && to.start < slot.at.end)
        ? { level: 'blocked', reason: 'Overlaps another slot' }
        : null,
    onDrop: ({ id, to }) => setSlots((all) => all.map((slot) => (slot.id === id && to ? { ...slot, at: to } : slot))),
  });
  return (
    <div {...lanes.getBoardProps()} role="group" aria-label={`Board ${index} ${tick}`}>
      {['main', 'side'].map((lane) => (
        <div key={lane} {...lanes.getLaneProps(lane)} data-bench-lane style={{ position: 'relative', blockSize: 24, inlineSize: 480 }}>
          {slots
            .filter((slot) => slot.at.lane === lane)
            .map((slot) => (
              <span
                key={slot.id}
                {...lanes.getItemProps(slot.id, slot.at)}
                style={{ position: 'absolute', insetInlineStart: slot.at.start * 2, inlineSize: (slot.at.end - slot.at.start) * 2 }}
              >
                <span aria-hidden data-bench-handle {...lanes.getHandleProps(slot.id, 'move')}>
                  ::
                </span>{' '}
                {slot.id}
              </span>
            ))}
          <LanePreview drag={lanes.drag} lane={lane} />
        </div>
      ))}
    </div>
  );
}

/** Presses the first slot's handle and drags it, in steps, to a free place in the other lane, then drops it. */
function dragSlotToOtherLane(container: HTMLElement) {
  const handle = first<HTMLElement>(container, '[data-bench-handle]');
  const lanes = handle.closest('[role="group"]')!.querySelectorAll('[data-bench-lane]');
  const from = handle.getBoundingClientRect();
  const to = lanes[1]!.getBoundingClientRect();
  const at = (type: string, target: EventTarget, x: number, y: number) =>
    target.dispatchEvent(new PointerEvent(type, { bubbles: true, cancelable: true, pointerId: 1, pointerType: 'mouse', isPrimary: true, button: 0, clientX: x, clientY: y }));
  const x = from.left + 2;
  const y = from.top + from.height / 2;
  at('pointerdown', handle, x, y);
  for (let step = 1; step <= 10; step++) at('pointermove', window, x + step * 32, y + ((to.top + to.height / 2 - y) * step) / 10);
  at('pointerup', window, x + 320, to.top + to.height / 2);
}

const FILES = ['report.pdf', 'budget.xlsx', 'notes.txt', 'logo.svg', 'deck.pptx'];

/** A file list with a select-all box and a box for each row. */
function SelectionItem({ index, tick }: ItemProps) {
  const selection = useSelection({ keys: FILES });
  return (
    <div role="group" aria-label={`Files ${index} ${tick}`}>
      <Checkbox.Root {...selection.getSelectAllProps()}>Select all files</Checkbox.Root>
      {FILES.map((file) => (
        <Checkbox.Root key={file} {...selection.getCheckboxProps(file)}>
          {file}
        </Checkbox.Root>
      ))}
    </div>
  );
}

/** The presentation a combobox would pick here. */
function SheetPresentationItem({ index, tick }: ItemProps) {
  const { presentation } = useSheetPresentation();
  return (
    <span>
      List {index} opens as a {presentation} {tick}
    </span>
  );
}

const STRINGS = { copied: 'Copied to clipboard' };

function StringsReader({ index, tick }: ItemProps) {
  const { copied } = useStrings();
  return (
    <span>
      Row {index}: {copied} {tick}
    </span>
  );
}

function StringsCase({ copies, tick }: CaseProps) {
  return (
    <StringsProvider strings={STRINGS}>
      {range(copies).map((index) => (
        <StringsReader key={index} index={index} tick={tick} />
      ))}
    </StringsProvider>
  );
}

export const HOOKS = {
  useCombobox: [
    {
      id: 'use-combobox',
      title: 'useCombobox, closed, with Field, Popover and OptionList',
      Case: many(ComboboxItem),
      // Focus opens the list.
      interact: (container) => first<HTMLInputElement>(container, 'input').focus(),
    },
  ],
  useRovingFocus: [
    {
      id: 'use-roving-focus',
      title: 'useRovingFocus on a toolbar of three plain buttons',
      Case: many(RovingFocusItem),
      interact: (container) => {
        const item = first<HTMLElement>(container, '[data-bench-trigger]');
        item.focus();
        item.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true, cancelable: true }));
      },
    },
  ],
  useHotkey: [
    {
      id: 'use-hotkey',
      title: 'useHotkey on a plain button',
      Case: many(HotkeyItem),
      // A key no hotkey matches, as when someone types on the page: every copy's listener checks it.
      interact: () => {
        document.body.dispatchEvent(new KeyboardEvent('keydown', { key: 'a', bubbles: true, cancelable: true }));
      },
    },
  ],
  useHighlight: [
    {
      id: 'use-highlight',
      title: 'useHighlight on a paragraph',
      Case: many(HighlightItem),
    },
  ],
  useInlineEdit: [
    {
      id: 'use-inline-edit',
      title: 'useInlineEdit on a name with a Rename button',
      Case: many(InlineEditItem),
      interact: click('[data-bench-trigger]'),
    },
  ],
  useAnnouncer: [
    {
      id: 'use-announcer',
      title: 'useAnnouncer on a Save draft button',
      Case: many(AnnouncerItem),
      interact: click('[data-bench-trigger]'),
    },
  ],
  useAppearance: [
    {
      id: 'use-appearance',
      title: 'useAppearance in readers under one ThemeProvider',
      Case: AppearanceCase,
    },
  ],
  useChipField: [
    {
      id: 'use-chip-field',
      title: 'useChipField on a Field.ChipInput',
      Case: many(ChipFieldItem),
      // Enter commits the typed tag; a new one each time, since a repeat is dropped.
      interact: (container) => {
        const input = first<HTMLInputElement>(container, 'input');
        input.focus();
        typeInto(input, `tag-${tagCount++}`);
        key(input, 'Enter');
      },
    },
  ],
  useChipList: [
    {
      id: 'use-chip-list',
      title: 'useChipList on six chips folded to one row',
      Case: many(ChipListItem),
    },
  ],
  useClipboard: [
    {
      id: 'use-clipboard',
      title: 'useClipboard on a Copy command button',
      Case: many(ClipboardItem),
      interact: click('[data-bench-trigger]'),
    },
  ],
  useControlledState: [
    {
      id: 'use-controlled-state',
      title: 'useControlledState in a controlled status filter',
      Case: many(ControlledStateItem),
      interact: (container) => {
        const select = first<HTMLSelectElement>(container, 'select');
        select.value = select.value === 'all' ? 'open' : 'all';
        select.dispatchEvent(new Event('change', { bubbles: true }));
      },
    },
  ],
  useDensity: [
    {
      id: 'use-density',
      title: 'useDensity in readers under one DensityProvider',
      Case: DensityCase,
    },
  ],
  useDropzone: [
    {
      id: 'use-dropzone',
      title: 'useDropzone on a label around a file input',
      Case: many(DropzoneItem),
      interact: (container) => {
        const zone = first<HTMLElement>(container, '[data-bench-trigger]');
        const files = [new File(['x'], 'photo.png', { type: 'image/png' })];
        zone.dispatchEvent(dropEvent('dragenter', files));
        zone.dispatchEvent(dropEvent('drop', files));
      },
    },
  ],
  useField: [
    {
      id: 'use-field',
      title: 'useField in a custom rating inside Field.Root',
      Case: many(FieldItem),
      interact: (container) => {
        const stars = first<HTMLElement>(container, '[data-bench-trigger]');
        stars.focus();
        key(stars, Number(stars.getAttribute('aria-valuenow')) < 5 ? 'ArrowRight' : 'ArrowLeft');
      },
    },
  ],
  useFocusHandoff: [
    {
      id: 'use-focus-handoff',
      title: 'useFocusHandoff on buttons that replace each other',
      Case: many(FocusHandoffItem),
      // The button holds focus when it unmounts, so the hook hands focus to its replacement.
      interact: (container) => {
        const button = first<HTMLElement>(container, '[data-bench-trigger]');
        button.focus();
        button.click();
      },
    },
  ],
  useGlyphs: [
    {
      id: 'use-glyphs',
      title: 'useGlyphs in readers under one GlyphsProvider',
      Case: GlyphsCase,
    },
  ],
  useMentions: [
    {
      id: 'use-mentions',
      title: 'useMentions on a Field.Textarea with Popover and OptionList',
      Case: many(MentionsItem),
      // Typing @ and a letter opens the list; the letter alternates so each run is a real edit.
      interact: (container) => {
        const textarea = first<HTMLTextAreaElement>(container, 'textarea');
        textarea.focus();
        typeInto(textarea, textarea.value === '@a' ? '@g' : '@a');
      },
    },
  ],
  useModalLayer: [
    {
      id: 'use-modal-layer',
      title: 'useModalLayer on a dialog of the app\'s own, closed',
      Case: many(ModalLayerItem),
      interact: click('[data-bench-trigger]'),
    },
  ],
  useLaneDrag: [
    {
      id: 'use-lane-drag',
      title: 'useLaneDrag on two lanes of three slots, with a preview in each lane',
      Case: many(LaneBoardItem),
      // The hook has no keyboard path (the docs pair it with a menu), so this drives its drag.
      interact: dragSlotToOtherLane,
    },
  ],
  // Each lane of the useLaneDrag case renders its preview with it.
  useLaneDragState: { via: 'useLaneDrag' },
  useReorder: [
    {
      id: 'use-reorder',
      title: 'useReorder on a list of four rows with handles',
      Case: many(ReorderItem),
      // The hook has no keyboard path (the docs pair it with a menu), so this drives its drag.
      interact: dragFirstRowDown,
    },
  ],
  useReorderGroup: [
    {
      id: 'use-reorder-group',
      title: 'useReorderGroup on two lists of two rows with handles',
      Case: many(ReorderGroupItem),
      interact: dragToOtherLane,
    },
  ],
  useSelection: [
    {
      id: 'use-selection',
      title: 'useSelection on a select-all box and five row boxes',
      Case: many(SelectionItem),
      // The first box is select-all.
      interact: click('input[type="checkbox"]'),
    },
  ],
  useSheetPresentation: [
    {
      id: 'use-sheet-presentation',
      title: 'useSheetPresentation read into a label',
      Case: many(SheetPresentationItem),
    },
  ],
  useStrings: [
    {
      id: 'use-strings',
      title: 'useStrings in readers under one StringsProvider',
      Case: StringsCase,
    },
  ],
  usePopover: { via: 'Popover' },
  useTooltip: { via: 'Tooltip' },
} satisfies CoverageGroup;
