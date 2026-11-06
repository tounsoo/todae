/**
 * The cases the benchmark renders. Each one draws `copies` instances of a part
 * (or one whole page) and takes `tick`, which changes the label of every
 * instance, so the update step re-renders all of them.
 *
 * The cases use todae's public API only, so the same file also measures an
 * older build (`--against`). The billing case renders this checkout's docs
 * demo on either build, so it compares todae under today's demo code. A case whose parts that build lacks fails on its
 * own and is reported as failed; the rest still run.
 *
 * The `use-` cases measure public hooks that consumers call on their own,
 * without a todae component that wraps them. They wire each hook to plain
 * HTML where it allows, so the numbers are the hook's own cost. Hooks that
 * only reach consumers through a component are measured by that component's
 * case.
 */
import {
  Badge,
  Button,
  Card,
  Checkbox,
  Coachmark,
  Field,
  Menu,
  OptionList,
  Popover,
  Switch,
  Tabs,
  Text,
  Tooltip,
  useCombobox,
  useHighlight,
  useHotkey,
  useInlineEdit,
  usePopover,
  useRovingFocus,
  useTooltip,
  type ComboboxOption,
} from '@tounsoo/todae';
import { useRef, useState, type ReactElement } from 'react';
import { Preview } from '../../docs/components/playground/Preview.tsx';

export type CaseProps = { copies: number; tick: number };

export type Scenario = {
  id: string;
  title: string;
  /** Instance counts to run. Leave it out to run every size the run asks for. */
  copies?: readonly number[];
  Case: (props: CaseProps) => ReactElement;
  /** One user action on the first instance. Its time runs through React's update and a forced layout. */
  interact?: (container: HTMLElement) => void;
};

const range = (copies: number) => Array.from({ length: copies }, (_, index) => index);

function first<T extends Element>(container: HTMLElement, selector: string): T {
  const element = container.querySelector<T>(selector);
  if (!element) throw new Error(`no element matches ${selector}`);
  return element;
}

const click = (selector: string) => (container: HTMLElement) => first<HTMLElement>(container, selector).click();

function TextInputCase({ index, tick }: { index: number; tick: number }) {
  const [value, setValue] = useState('');
  return (
    <Field.Root>
      <Field.TextInput aria-label={`Field ${index} ${tick}`} value={value} onValueChange={setValue} />
    </Field.Root>
  );
}

function PopoverCase({ index, tick }: { index: number; tick: number }) {
  const popover = usePopover();
  return (
    <>
      <button type="button" data-bench-trigger {...popover.getTriggerProps()}>
        Details {index} {tick}
      </button>
      <Popover.Root {...popover.getPopoverProps()} role="dialog" aria-label={`Details ${index}`}>
        <p>More about item {index}.</p>
      </Popover.Root>
    </>
  );
}

function TooltipCase({ index, tick }: { index: number; tick: number }) {
  const tip = useTooltip();
  return (
    <>
      <button type="button" {...tip.getTriggerProps()}>
        Info {index} {tick}
      </button>
      <Tooltip.Root {...tip.getTooltipProps()}>
        Details {index}
      </Tooltip.Root>
    </>
  );
}

function CoachmarkCase({ index, tick }: { index: number; tick: number }) {
  const target = useRef<HTMLButtonElement>(null);
  return (
    <>
      <button type="button" ref={target}>
        Feature {index} {tick}
      </button>
      <Coachmark.Root targetRef={target} open={false} aria-label={`Tip ${index}`}>
        <Coachmark.Description>Try the new feature {index}.</Coachmark.Description>
      </Coachmark.Root>
    </>
  );
}

const PLANS: ComboboxOption[] = [
  { value: 'free', label: 'Free' },
  { value: 'team', label: 'Team' },
  { value: 'business', label: 'Business' },
  { value: 'enterprise', label: 'Enterprise' },
];

/** A closed single-select combobox, wired the way the useCombobox docs wire it. */
function ComboboxHookCase({ index, tick }: { index: number; tick: number }) {
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
function RovingFocusHookCase({ index, tick }: { index: number; tick: number }) {
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
function HotkeyHookCase({ index, tick }: { index: number; tick: number }) {
  const keys = ['Control+K', 'Meta+K'];
  useHotkey(keys, noop);
  return (
    <button type="button" aria-keyshortcuts={keys.join(' ')}>
      Search {index} {tick}
    </button>
  );
}

/** A paragraph that highlights a search term, under its own highlight name as the docs ask. */
function HighlightHookCase({ index, tick }: { index: number; tick: number }) {
  const found = useHighlight({ name: `bench-search-${index}`, query: 'invoice' });
  return (
    <p ref={found.ref} data-matches={found.matches.length}>
      Invoice {index} for the order of a customer, version {tick}
    </p>
  );
}

/** A name with a Rename button that opens a plain input in place. */
function InlineEditHookCase({ index, tick }: { index: number; tick: number }) {
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

const many = (Item: (props: { index: number; tick: number }) => ReactElement) =>
  function ManyCase({ copies, tick }: CaseProps) {
    return (
      <>
        {range(copies).map((index) => (
          <Item key={index} index={index} tick={tick} />
        ))}
      </>
    );
  };

export const SCENARIOS: readonly Scenario[] = [
  {
    id: 'html-button',
    title: 'Plain HTML button (baseline)',
    Case: ({ copies, tick }) => (
      <>
        {range(copies).map((index) => (
          <button key={index} type="button">
            Save {index} {tick}
          </button>
        ))}
      </>
    ),
    interact: click('button'),
  },
  {
    id: 'button',
    title: 'Button',
    Case: ({ copies, tick }) => (
      <>
        {range(copies).map((index) => (
          <Button.Root key={index}>
            Save {index} {tick}
          </Button.Root>
        ))}
      </>
    ),
    interact: click('button'),
  },
  {
    id: 'text-clamped',
    title: 'Text clamped to one line',
    Case: ({ copies, tick }) => (
      <div style={{ width: 160 }}>
        {range(copies).map((index) => (
          <Text.Root key={index} lines={1}>
            Invoice {index} for a customer with a long name, version {tick}
          </Text.Root>
        ))}
      </div>
    ),
  },
  {
    id: 'checkbox',
    title: 'Checkbox',
    Case: ({ copies, tick }) => (
      <>
        {range(copies).map((index) => (
          <Checkbox.Root key={index}>
            Row {index} {tick}
          </Checkbox.Root>
        ))}
      </>
    ),
    interact: click('input[type="checkbox"]'),
  },
  {
    id: 'switch',
    title: 'Switch',
    Case: ({ copies, tick }) => (
      <>
        {range(copies).map((index) => (
          <Switch.Root key={index}>
            Alerts {index} {tick}
          </Switch.Root>
        ))}
      </>
    ),
    interact: click('input'),
  },
  {
    id: 'text-input',
    title: 'Field with TextInput',
    Case: ({ copies, tick }) => (
      <>
        {range(copies).map((index) => (
          <TextInputCase key={index} index={index} tick={tick} />
        ))}
      </>
    ),
    interact: (container) => first<HTMLInputElement>(container, 'input').focus(),
  },
  {
    id: 'menu-closed',
    title: 'Closed Menu with three items',
    Case: ({ copies, tick }) => (
      <>
        {range(copies).map((index) => (
          <Menu.Root key={index}>
            <Menu.Trigger data-bench-trigger>
              Actions {index} {tick}
            </Menu.Trigger>
            <Menu.Content>
              <Menu.Item>Open</Menu.Item>
              <Menu.Item>Rename</Menu.Item>
              <Menu.Item>Archive</Menu.Item>
            </Menu.Content>
          </Menu.Root>
        ))}
      </>
    ),
    interact: click('[data-bench-trigger]'),
  },
  {
    id: 'popover-closed',
    title: 'Closed Popover',
    Case: ({ copies, tick }) => (
      <>
        {range(copies).map((index) => (
          <PopoverCase key={index} index={index} tick={tick} />
        ))}
      </>
    ),
    interact: click('[data-bench-trigger]'),
  },
  {
    id: 'coachmark-closed',
    title: 'Closed Coachmark',
    Case: ({ copies, tick }) => (
      <>
        {range(copies).map((index) => (
          <CoachmarkCase key={index} index={index} tick={tick} />
        ))}
      </>
    ),
  },
  {
    id: 'tooltip',
    title: 'Tooltip on a plain button',
    Case: ({ copies, tick }) => (
      <>
        {range(copies).map((index) => (
          <TooltipCase key={index} index={index} tick={tick} />
        ))}
      </>
    ),
  },
  {
    id: 'tabs',
    title: 'Tabs with three panels',
    Case: ({ copies, tick }) => (
      <>
        {range(copies).map((index) => (
          <Tabs.Root key={index} defaultValue="a">
            <Tabs.List aria-label={`Tabs ${index}`}>
              <Tabs.Tab value="a">Overview {tick}</Tabs.Tab>
              <Tabs.Tab value="b">Activity</Tabs.Tab>
              <Tabs.Tab value="c">Settings</Tabs.Tab>
            </Tabs.List>
            <Tabs.Panel value="a">Overview {index}</Tabs.Panel>
            <Tabs.Panel value="b">Activity {index}</Tabs.Panel>
            <Tabs.Panel value="c">Settings {index}</Tabs.Panel>
          </Tabs.Root>
        ))}
      </>
    ),
    interact: (container) => {
      const tabs = container.querySelectorAll<HTMLElement>('[role="tab"]');
      const second = tabs[1];
      if (!second) throw new Error('no second tab');
      second.click();
    },
  },
  {
    id: 'card-badge',
    title: 'Card with a Badge',
    Case: ({ copies, tick }) => (
      <>
        {range(copies).map((index) => (
          <Card.Root key={index}>
            <Card.Body>
              Plan {index} <Badge.Root>New {tick}</Badge.Root>
            </Card.Body>
          </Card.Root>
        ))}
      </>
    ),
  },
  {
    id: 'use-combobox',
    title: 'useCombobox, closed, with Field, Popover and OptionList',
    Case: many(ComboboxHookCase),
    // Focus opens the list.
    interact: (container) => first<HTMLInputElement>(container, 'input').focus(),
  },
  {
    id: 'use-roving-focus',
    title: 'useRovingFocus on a toolbar of three plain buttons',
    Case: many(RovingFocusHookCase),
    interact: (container) => {
      const item = first<HTMLElement>(container, '[data-bench-trigger]');
      item.focus();
      item.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true, cancelable: true }));
    },
  },
  {
    id: 'use-hotkey',
    title: 'useHotkey on a plain button',
    Case: many(HotkeyHookCase),
    // A key no hotkey matches, as when someone types on the page: every copy's listener checks it.
    interact: () => {
      document.body.dispatchEvent(new KeyboardEvent('keydown', { key: 'a', bubbles: true, cancelable: true }));
    },
  },
  {
    id: 'use-highlight',
    title: 'useHighlight on a paragraph',
    Case: many(HighlightHookCase),
  },
  {
    id: 'use-inline-edit',
    title: 'useInlineEdit on a name with a Rename button',
    Case: many(InlineEditHookCase),
    interact: click('[data-bench-trigger]'),
  },
  {
    id: 'billing-page',
    title: 'Billing playground page (docs demo)',
    copies: [1],
    // The update switches the page's language, which re-renders all of it.
    Case: ({ tick }) => <Preview locale={tick % 2 === 0 ? 'en' : 'ko'} />,
    interact: click('input[type="checkbox"], [role="switch"]'),
  },
];
