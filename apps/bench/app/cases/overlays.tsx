/** Overlay parts: menus, popovers, tooltips, dialogs, sheets and toasts. */
import { Coachmark, Menu, Popover, Tooltip, usePopover, useTooltip } from '@tounsoo/todae';
import { useRef } from 'react';
import { click, many, range, type CoverageGroup, type ItemProps } from './types.tsx';

function PopoverItem({ index, tick }: ItemProps) {
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

function TooltipItem({ index, tick }: ItemProps) {
  const tip = useTooltip();
  return (
    <>
      <button type="button" {...tip.getTriggerProps()}>
        Info {index} {tick}
      </button>
      <Tooltip.Root {...tip.getTooltipProps()}>Details {index}</Tooltip.Root>
    </>
  );
}

function CoachmarkItem({ index, tick }: ItemProps) {
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

export const OVERLAYS = {
  Menu: [
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
  ],
  Popover: [
    {
      id: 'popover-closed',
      title: 'Closed Popover',
      Case: many(PopoverItem),
      interact: click('[data-bench-trigger]'),
    },
  ],
  Coachmark: [
    {
      id: 'coachmark-closed',
      title: 'Closed Coachmark',
      Case: many(CoachmarkItem),
    },
  ],
  Tooltip: [
    {
      id: 'tooltip',
      title: 'Tooltip on a plain button',
      Case: many(TooltipItem),
    },
  ],
} satisfies CoverageGroup;
