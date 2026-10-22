'use client';

import {
  Button,
  Drawer,
  Link,
  Nav,
  Splitter,
  Stack,
  Text,
  Toolbar,
  useFocusHandoff,
  VisuallyHidden,
} from '@tounsoo/todae';
import { Bell, CreditCard, House, MenuIcon, PanelLeft, Search, Settings, Users } from 'lucide-react';
import { useId, useLayoutEffect, useRef, useState, useSyncExternalStore, type MouseEvent } from 'react';

export const WIDE = '(min-width: 48rem)';

function subscribe(onChange: () => void) {
  const query = window.matchMedia(WIDE);
  query.addEventListener('change', onChange);
  return () => query.removeEventListener('change', onChange);
}

// The server has no window, so it sends the narrow layout; a wide window switches as it hydrates, with nothing remounted.
function useWide() {
  return useSyncExternalStore(subscribe, () => window.matchMedia(WIDE).matches, () => false);
}

const PAGES = [
  { href: '#home', label: 'Home', Icon: House },
  { href: '#team', label: 'Team', Icon: Users },
  { href: '#billing', label: 'Billing', Icon: CreditCard },
  { href: '#settings', label: 'Settings', Icon: Settings },
] as const;

const pad = { padding: 'var(--todae-space-3)' };

/** A product's frame in a box. The links stay on this page: a click marks one current, as a router would. */
export function AppShellExample() {
  const wide = useWide();
  const mainId = useId();
  const headingId = useId();
  const sidebarId = useId();
  const navButton = useRef<HTMLButtonElement>(null);
  const heading = useRef<HTMLElement>(null);
  const handle = useRef<HTMLDivElement>(null);
  const sidebarHandoff = useFocusHandoff({ to: navButton });
  const [page, setPage] = useState<string>('#home');
  const [width, setWidth] = useState(200);
  const [lastWidth, setLastWidth] = useState(200);
  const [drawerOpen, setDrawerOpen] = useState(false);
  // Whether a link in the drawer was chosen, which sends focus to the new page's heading when the drawer closes.
  const [chose, setChose] = useState(false);
  // A window that widens shows the sidebar, so the drawer closes, and Drawer puts focus back on the button.
  if (wide && drawerOpen) setDrawerOpen(false);
  // Any change of page closes the drawer, a link in it or Back alike, in the commit that shows the new page.
  const [shownPage, setShownPage] = useState(page);
  if (page !== shownPage) {
    setShownPage(page);
    setDrawerOpen(false);
  }
  // `only` takes the handle out of the layout, so focus on it moves to the button before the window narrows it away.
  useLayoutEffect(() => {
    if (!wide && handle.current === handle.current?.ownerDocument.activeElement) navButton.current?.focus();
  }, [wide]);

  // The button restores the last width the sidebar had, whoever collapsed it.
  const resize = (next: number) => {
    if (next > 0) setLastWidth(next);
    setWidth(next);
  };
  const toggleSidebar = () => setWidth(width === 0 ? lastWidth : 0);
  const openDrawer = () => {
    setChose(false);
    setDrawerOpen(true);
  };
  const current = PAGES.find((p) => p.href === page) ?? PAGES[0];

  const navigation = () => (
    <Nav.Root aria-label="Main">
      <Nav.Group>
        {PAGES.map(({ href, label, Icon }) => (
          <Nav.Item key={href}>
            <Nav.Link
              href={href}
              aria-current={page === href ? 'page' : undefined}
              onClick={(event: MouseEvent) => {
                // A modified click would open the link elsewhere; this demo's links go nowhere, so it does nothing.
                if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
                event.preventDefault();
                setPage(href);
              }}
            >
              <Icon aria-hidden="true" />
              {label}
            </Nav.Link>
          </Nav.Item>
        ))}
      </Nav.Group>
    </Nav.Root>
  );

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateRows: 'auto minmax(0, 1fr)',
        inlineSize: '100%',
        blockSize: '22rem',
        border: '1px solid var(--todae-color-border-subtle)',
        borderRadius: 'var(--todae-radius-md)',
        overflow: 'hidden',
      }}
    >
      {/* A page has one header and one main landmark, and the docs page has its own, so this frame uses a div
          and a section where a product's shell uses <header> and <main>. */}
      <Stack.Root
        direction="row"
        align="center"
        gap="condensed"
        style={{ ...pad, borderBlockEnd: '1px solid var(--todae-color-border-subtle)' }}
      >
        <VisuallyHidden.Root focusable>
          <Link.Root href={`#${mainId}`}>Skip to content</Link.Root>
        </VisuallyHidden.Root>
        <Button.Root
          ref={navButton}
          variant="ghost"
          aria-label="Navigation"
          {...(wide ? { 'aria-controls': sidebarId, 'aria-expanded': width > 0 } : { 'aria-haspopup': 'dialog' as const })}
          onClick={wide ? toggleSidebar : openDrawer}
        >
          {wide ? (
            <Button.Icon>
              <PanelLeft />
            </Button.Icon>
          ) : (
            <Button.Icon>
              <MenuIcon />
            </Button.Icon>
          )}
        </Button.Root>
        <Text.Root as="span" weight="bold">
          Atlas
        </Text.Root>
        <Toolbar.Root aria-label="Account" style={{ marginInlineStart: 'auto' }}>
          <Button.Root variant="ghost" aria-label="Search">
            <Button.Icon>
              <Search />
            </Button.Icon>
          </Button.Root>
          <Button.Root variant="ghost" aria-label="Notifications">
            <Button.Icon>
              <Bell />
            </Button.Icon>
          </Button.Root>
        </Toolbar.Root>
      </Stack.Root>
      <Splitter.Root
        only={wide ? undefined : 'end'}
        value={width}
        onValueChange={resize}
        min={160}
        max={320}
        collapsible
      >
        <Splitter.Panel id={sidebarId}>
          {wide && (
            <div ref={sidebarHandoff} style={pad}>
              {navigation()}
            </div>
          )}
        </Splitter.Panel>
        <Splitter.Handle ref={handle} aria-label="Resize navigation" />
        <Splitter.Panel>
          <Stack.Root as="section" id={mainId} tabIndex={-1} aria-labelledby={headingId} style={pad}>
            <Text.Root as="h2" size="l" id={headingId} ref={heading} tabIndex={-1}>
              {current.label}
            </Text.Root>
            <Text.Root tone="muted">
              {wide
                ? 'Drag the handle beside the navigation, or use the button in the header to hide it.'
                : 'The navigation is in a drawer: open it from the button in the header.'}
            </Text.Root>
          </Stack.Root>
        </Splitter.Panel>
      </Splitter.Root>
      <Drawer.Root open={drawerOpen} onOpenChange={setDrawerOpen} side="start" restoreFocusRef={chose ? heading : navButton}>
        <Drawer.Header>
          <Drawer.Title>Atlas</Drawer.Title>
          <Drawer.Close />
        </Drawer.Header>
        <Drawer.Body
          onClick={(event) => {
            // A modified click opens the link elsewhere and leaves this page, and the drawer, as they are.
            const elsewhere = event.metaKey || event.ctrlKey || event.shiftKey || event.altKey;
            const link = (event.target as Element).closest('a[href]');
            if (elsewhere || !link) return;
            // The link goes with the drawer, so focus goes to the new page's heading once the page changes.
            setChose(true);
            // The current page's link changes nothing, so it closes the drawer itself.
            if (link.getAttribute('aria-current') === 'page') setDrawerOpen(false);
          }}
        >
          {navigation()}
        </Drawer.Body>
      </Drawer.Root>
    </div>
  );
}
