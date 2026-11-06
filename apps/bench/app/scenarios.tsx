/**
 * The cases the benchmark renders. Each one draws `copies` instances of a part
 * (or one whole page) and takes `tick`, which changes the label of every
 * instance, so the update step re-renders all of them.
 *
 * The cases use todae's public API only, so the same file also measures an
 * older build (`--against`). A case whose parts that build lacks fails on its
 * own and is reported as failed; the rest still run.
 */
import {
  Badge,
  Button,
  Card,
  Checkbox,
  Coachmark,
  Field,
  Menu,
  Popover,
  Switch,
  Tabs,
  Text,
  Tooltip,
  usePopover,
  useTooltip,
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
  /** One user action on the first instance. Its time runs until the next frame. */
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
        Info {index}
      </button>
      <Tooltip.Root {...tip.getTooltipProps()}>
        Details {index} {tick}
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
    id: 'billing-page',
    title: 'Billing playground page (docs demo)',
    copies: [1],
    // The update switches the page's language, which re-renders all of it.
    Case: ({ tick }) => <Preview locale={tick % 2 === 0 ? 'en' : 'ko'} />,
    interact: click('input[type="checkbox"], [role="switch"]'),
  },
];
