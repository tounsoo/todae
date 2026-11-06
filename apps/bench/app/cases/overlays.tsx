/** Overlay parts: menus, popovers, tooltips, dialogs, sheets and toasts. */
import {
  BottomSheet,
  Button,
  Coachmark,
  Dialog,
  Disclosure,
  Drawer,
  Drilldown,
  Menu,
  Popover,
  Text,
  Toast,
  Tooltip,
  createToaster,
  usePopover,
  useTooltip,
} from '@tounsoo/todae';
import type { ReactElement } from 'react';
import { useEffect, useRef, useState } from 'react';
import { click, many, PAGE_SIZES, range, type CaseProps, type CoverageGroup, type ItemProps } from './types.tsx';

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

function MenuOptionsItem({ index, tick }: ItemProps) {
  const [grid, setGrid] = useState(true);
  const [sort, setSort] = useState('name');
  return (
    <Menu.Root>
      <Menu.Trigger data-bench-trigger>
        View {index} {tick}
      </Menu.Trigger>
      <Menu.Content>
        <Menu.CheckboxItem checked={grid} onCheckedChange={setGrid}>
          Grid
        </Menu.CheckboxItem>
        <Menu.Separator />
        <Menu.RadioGroup aria-label="Sort by" value={sort} onValueChange={setSort}>
          <Menu.RadioItem value="name">Name</Menu.RadioItem>
          <Menu.RadioItem value="modified">Date modified</Menu.RadioItem>
        </Menu.RadioGroup>
        <Menu.Separator />
        <Menu.Submenu>
          <Menu.SubmenuTrigger>Share</Menu.SubmenuTrigger>
          <Menu.SubmenuContent>
            <Menu.Item>Copy link</Menu.Item>
            <Menu.Item>Email</Menu.Item>
          </Menu.SubmenuContent>
        </Menu.Submenu>
      </Menu.Content>
    </Menu.Root>
  );
}

function DialogItem({ index, tick, initiallyOpen = false }: ItemProps & { initiallyOpen?: boolean }) {
  const [open, setOpen] = useState(initiallyOpen);
  return (
    <>
      <Button.Root data-bench-trigger onClick={() => setOpen(true)}>
        Invite {index} {tick}
      </Button.Root>
      <Dialog.Root open={open} onOpenChange={setOpen}>
        <Dialog.Header>
          <Dialog.Title>Invite teammates</Dialog.Title>
          <Dialog.Close />
        </Dialog.Header>
        <Dialog.Description>They get an email with a link to this project.</Dialog.Description>
        <Dialog.Body>Pick who joins the project.</Dialog.Body>
        <Dialog.Footer>
          <Dialog.Close>Cancel</Dialog.Close>
          <Button.Root onClick={() => setOpen(false)}>Send invites</Button.Root>
        </Dialog.Footer>
      </Dialog.Root>
    </>
  );
}

function DrawerItem({ index, tick, initiallyOpen = false }: ItemProps & { initiallyOpen?: boolean }) {
  const [open, setOpen] = useState(initiallyOpen);
  return (
    <>
      <Button.Root variant="secondary" data-bench-trigger onClick={() => setOpen(true)}>
        Filters {index} {tick}
      </Button.Root>
      <Drawer.Root open={open} onOpenChange={setOpen}>
        <Drawer.Header>
          <Drawer.Title>Filters</Drawer.Title>
          <Drawer.Close />
        </Drawer.Header>
        <Drawer.Body>The body fills the height the header and footer leave.</Drawer.Body>
        <Drawer.Footer>
          <Button.Root variant="secondary" onClick={() => setOpen(false)}>
            Reset
          </Button.Root>
          <Button.Root onClick={() => setOpen(false)}>Apply</Button.Root>
        </Drawer.Footer>
      </Drawer.Root>
    </>
  );
}

const SHARE_TARGETS = ['Alpha', 'Beta', 'Gamma', 'Delta'];

function BottomSheetItem({ index, tick, initiallyOpen = false }: ItemProps & { initiallyOpen?: boolean }) {
  const [open, setOpen] = useState(initiallyOpen);
  const [snap, setSnap] = useState<'mid' | 'full'>('mid');
  return (
    <>
      <Button.Root data-bench-trigger onClick={() => setOpen(true)}>
        Share {index} {tick}
      </Button.Root>
      <BottomSheet.Root open={open} onOpenChange={setOpen} snap={snap} onSnapChange={setSnap}>
        <BottomSheet.Header>
          <BottomSheet.Title>Share</BottomSheet.Title>
          <BottomSheet.Close />
        </BottomSheet.Header>
        <BottomSheet.Description>Drag the grabber. Mid and full snap.</BottomSheet.Description>
        <BottomSheet.Body>
          <ul aria-label="Share to">
            {SHARE_TARGETS.map((target) => (
              <li key={target}>
                <Button.Root variant="ghost" onClick={() => setOpen(false)}>
                  {target}
                </Button.Root>
              </li>
            ))}
          </ul>
        </BottomSheet.Body>
        <BottomSheet.Footer>
          <Button.Root variant="secondary" onClick={() => setOpen(false)}>
            Cancel
          </Button.Root>
        </BottomSheet.Footer>
      </BottomSheet.Root>
    </>
  );
}

const openOnMount = (Item: (props: ItemProps & { initiallyOpen?: boolean }) => ReactElement) =>
  function OpenCase({ tick }: CaseProps) {
    return <Item index={0} tick={tick} initiallyOpen />;
  };

const closedCase = (Item: (props: ItemProps & { initiallyOpen?: boolean }) => ReactElement) =>
  function ClosedCase({ copies, tick }: CaseProps) {
    return (
      <>
        {range(copies).map((index) => (
          <Item key={index} index={index} tick={tick} />
        ))}
      </>
    );
  };

// An app makes its toaster once at module scope, so each run's does too; Infinity keeps toasts up for the run.
function ToastRegionCase({ copies, tick }: CaseProps) {
  const [toaster] = useState(() => createToaster());
  useEffect(() => {
    const ids = range(copies).map((index) =>
      toaster.add({ title: `Changes saved ${index}`, description: 'Synced to the cloud.', tone: 'success', duration: Infinity }),
    );
    return () => {
      for (const id of ids) toaster.remove(id);
    };
  }, [toaster, copies]);
  // A region shows its toasts a task after it mounts, so the timed mount covers the empty region and the
  // toasts land before the counts. The Save button adds one more to the live region, which the interaction times.
  return (
    <>
      <button
        type="button"
        data-bench-trigger
        onClick={() => toaster.add({ title: 'Draft saved', description: 'Synced to the cloud.', tone: 'success', duration: Infinity })}
      >
        Save {tick}
      </button>
      <Toast.Region toaster={toaster} limit={copies + 1}>
      {(toast) => (
        <Toast.Root>
          <Toast.Title>
            {toast.title} {tick}
          </Toast.Title>
          <Toast.Description>{toast.description}</Toast.Description>
          <Toast.Close />
        </Toast.Root>
      )}
      </Toast.Region>
    </>
  );
}

function DrilldownCase({ copies, tick }: CaseProps) {
  return (
    <>
      {range(copies).map((index) => (
        <Drilldown.Root key={index} defaultValue={['filters']}>
          <header>
            <Drilldown.Back />
            <Drilldown.Label />
            <span>
              {index} {tick}
            </span>
          </header>
          <Drilldown.Viewport>
            <Drilldown.View value="filters" label="Filters">
              <Drilldown.Trigger value="brand" variant="ghost" data-bench-trigger>
                Brand
              </Drilldown.Trigger>
              <Drilldown.Trigger value="price" variant="ghost">
                Price
              </Drilldown.Trigger>
            </Drilldown.View>
            <Drilldown.View value="brand" label="Brand">
              <Text.Root>Arden, Birch &amp; Co, Cobalt.</Text.Root>
            </Drilldown.View>
            <Drilldown.View value="price" label="Price">
              <Text.Root>Under $50, $50 to $100, over $100.</Text.Root>
            </Drilldown.View>
          </Drilldown.Viewport>
        </Drilldown.Root>
      ))}
    </>
  );
}

function DisclosureItem({ index, tick }: ItemProps) {
  return (
    <Disclosure.Root>
      <Disclosure.Summary>
        Shipping details {index} {tick}
      </Disclosure.Summary>
      <Text.Root>Orders ship within two business days.</Text.Root>
    </Disclosure.Root>
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
    {
      id: 'menu-options',
      title: 'Closed Menu with checkbox, radio and submenu items',
      Case: many(MenuOptionsItem),
      interact: click('[data-bench-trigger]'),
    },
  ],
  Dialog: [
    {
      id: 'dialog-closed',
      title: 'Closed Dialog with a trigger button',
      copies: PAGE_SIZES,
      Case: closedCase(DialogItem),
      interact: click('[data-bench-trigger]'),
    },
    {
      id: 'dialog-open',
      title: 'Open Dialog with header, body and footer',
      copies: [1],
      Case: openOnMount(DialogItem),
    },
  ],
  Drawer: [
    {
      id: 'drawer-closed',
      title: 'Closed Drawer with a trigger button',
      copies: PAGE_SIZES,
      Case: closedCase(DrawerItem),
      interact: click('[data-bench-trigger]'),
    },
    {
      id: 'drawer-open',
      title: 'Open Drawer with header, body and footer',
      copies: [1],
      Case: openOnMount(DrawerItem),
    },
  ],
  BottomSheet: [
    {
      id: 'bottom-sheet-closed',
      title: 'Closed BottomSheet with a trigger button',
      copies: PAGE_SIZES,
      Case: closedCase(BottomSheetItem),
      interact: click('[data-bench-trigger]'),
    },
    {
      id: 'bottom-sheet-open',
      title: 'Open BottomSheet with a list of targets',
      copies: [1],
      Case: openOnMount(BottomSheetItem),
    },
  ],
  Toast: [
    {
      id: 'toast-region',
      title: 'Toast region holding one toast per copy',
      Case: ToastRegionCase,
      interact: click('[data-bench-trigger]'),
    },
  ],
  Drilldown: [
    {
      id: 'drilldown',
      title: 'Drilldown with three views, first level showing',
      copies: PAGE_SIZES,
      Case: DrilldownCase,
      interact: click('[data-bench-trigger]'),
    },
  ],
  Disclosure: [
    {
      id: 'disclosure-closed',
      title: 'Closed Disclosure',
      Case: many(DisclosureItem),
      interact: click('summary'),
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
