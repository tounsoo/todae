/** Layout, navigation and data parts, and the providers an app wraps them in. */
import {
  Button,
  Card,
  Contents,
  Conversation,
  DensityProvider,
  Field,
  Grid,
  GlyphsProvider,
  Label,
  Link,
  Menu,
  Message,
  Nav,
  Prose,
  ScrollArea,
  Splitter,
  Stack,
  StringsProvider,
  Table,
  Tabs,
  Text,
  ThemeProvider,
  Toolbar,
  Tree,
  type TableSort,
} from '@tounsoo/todae';
import { useId, useState } from 'react';
import { first, many, PAGE_SIZES, range, type CaseProps, type CoverageGroup, type ItemProps } from './types.tsx';

const arrowRight = (element: HTMLElement) =>
  element.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true, cancelable: true }));

/** One table of invoices: `copies` rows under a header whose first column sorts. */
function TableCase({ copies, tick }: CaseProps) {
  const [sort, setSort] = useState<TableSort>('ascending');
  const rows = range(copies);
  if (sort === 'descending') rows.reverse();
  return (
    <Table.Root>
      <Table.Caption>Invoices {tick}</Table.Caption>
      <Table.Head>
        <Table.Row>
          <Table.HeaderCell scope="col" sort={sort}>
            <Table.SortButton onClick={() => setSort(sort === 'ascending' ? 'descending' : 'ascending')}>
              Invoice
            </Table.SortButton>
          </Table.HeaderCell>
          <Table.HeaderCell scope="col">Status</Table.HeaderCell>
          <Table.HeaderCell scope="col" style={{ textAlign: 'end' }}>
            Amount
          </Table.HeaderCell>
        </Table.Row>
      </Table.Head>
      <Table.Body>
        {rows.map((index) => (
          <Table.Row key={index}>
            <Table.HeaderCell scope="row">
              INV-{1000 + index} {tick}
            </Table.HeaderCell>
            <Table.Cell>{index % 3 === 0 ? 'Overdue' : 'Paid'}</Table.Cell>
            <Table.Cell style={{ textAlign: 'end' }}>${(index + 1) * 120}</Table.Cell>
          </Table.Row>
        ))}
      </Table.Body>
    </Table.Root>
  );
}

/** A file tree of `copies` top-level entries; every third is a folder with two files. */
function TreeCase({ copies, tick }: CaseProps) {
  const [expanded, setExpanded] = useState<string[]>([]);
  const [value, setValue] = useState<string | null>(null);
  return (
    <Tree.Root aria-label="Files" expanded={expanded} onExpandedChange={setExpanded} value={value} onValueChange={setValue}>
      {range(copies).map((index) =>
        index % 3 === 0 ? (
          <Tree.Item key={index} value={`folder-${index}`}>
            <Tree.Label data-bench-trigger={index === 0 ? '' : undefined}>
              <Tree.Icon>{expanded.includes(`folder-${index}`) ? '-' : '+'}</Tree.Icon>
              Folder {index} {tick}
            </Tree.Label>
            <Tree.Group>
              {[0, 1].map((file) => (
                <Tree.Item key={file} value={`folder-${index}/file-${file}`}>
                  <Tree.Label>File {file}.tsx</Tree.Label>
                </Tree.Item>
              ))}
            </Tree.Group>
          </Tree.Item>
        ) : (
          <Tree.Item key={index} value={`file-${index}`}>
            <Tree.Label>
              File {index} {tick}
            </Tree.Label>
          </Tree.Item>
        ),
      )}
    </Tree.Root>
  );
}

/** A side nav of `copies` links; every fourth sits in a branch with two sub-pages. */
function NavCase({ copies, tick }: CaseProps) {
  return (
    <Nav.Root aria-label="App">
      <Nav.Group label="Workspace">
        {range(copies).map((index) => (
          <Nav.Item key={index}>
            <Nav.Link href={`#page-${index}`} aria-current={index === 1 ? 'page' : undefined}>
              Page {index} {tick}
            </Nav.Link>
            {index % 4 === 0 ? (
              <Nav.Branch label={`Pages under ${index}`}>
                {[0, 1].map((sub) => (
                  <Nav.Item key={sub}>
                    <Nav.Link href={`#page-${index}-${sub}`}>Sub-page {sub}</Nav.Link>
                  </Nav.Item>
                ))}
              </Nav.Branch>
            ) : null}
          </Nav.Item>
        ))}
      </Nav.Group>
    </Nav.Root>
  );
}

/** A table of contents beside a page, with `copies` section links. */
function ContentsItem({ copies, tick }: CaseProps) {
  return (
    <Contents.Root label={`On this page ${tick}`}>
      {range(copies).map((index) => (
        <Contents.Item key={index}>
          <Contents.Link href={`#section-${index}`}>Section {index}</Contents.Link>
        </Contents.Item>
      ))}
    </Contents.Root>
  );
}

/** A scroll box over a list of links, taller inside than out. */
function ScrollAreaItem({ index, tick }: ItemProps) {
  return (
    <ScrollArea.Root aria-label={`Guide ${index}`} style={{ blockSize: '9rem', inlineSize: '14rem' }}>
      <Stack.Root as="ul" gap="condensed">
        {range(12).map((link) => (
          <li key={link}>
            <Link.Root href={`#link-${index}-${link}`}>
              Section {link} {tick}
            </Link.Root>
          </li>
        ))}
      </Stack.Root>
    </ScrollArea.Root>
  );
}

function SplitterItem({ index, tick }: ItemProps) {
  const listId = useId();
  return (
    <Splitter.Root defaultValue={200} min={140} max={320} style={{ blockSize: '10rem' }}>
      <Splitter.Panel>
        <Stack.Root style={{ padding: 'var(--todae-space-4)' }}>
          <Text.Root as="h2" id={listId}>
            Inbox {index} {tick}
          </Text.Root>
          <Text.Root>Launch checklist</Text.Root>
        </Stack.Root>
      </Splitter.Panel>
      <Splitter.Handle aria-labelledby={listId} />
      <Splitter.Panel>
        <Stack.Root style={{ padding: 'var(--todae-space-4)' }}>
          <Text.Root as="h2">Launch checklist</Text.Root>
          <Text.Root tone="muted">Review the token changes before Friday.</Text.Root>
        </Stack.Root>
      </Splitter.Panel>
    </Splitter.Root>
  );
}

function ConversationItem({ index, tick }: ItemProps) {
  return (
    <Conversation.Root style={{ blockSize: '14rem' }}>
      <Conversation.Viewport>
        <Conversation.Content>
          <Message.Root from="user" aria-label="You">
            <Message.Content>
              What does Conversation do? {index} {tick}
            </Message.Content>
          </Message.Root>
          <Message.Root from="assistant" aria-label="Assistant">
            <Message.Content>
              <Prose.Root>
                <p>It holds the messages of a chat and scrolls with them.</p>
              </Prose.Root>
            </Message.Content>
          </Message.Root>
          <Message.Root from="user" aria-label="You">
            <Message.Content>What happens when a reply is long?</Message.Content>
          </Message.Root>
          <Message.Root from="assistant" aria-label="Assistant">
            <Message.Content>
              <Prose.Root>
                <p>It follows the newest message until you scroll up, then waits for you.</p>
              </Prose.Root>
            </Message.Content>
          </Message.Root>
        </Conversation.Content>
      </Conversation.Viewport>
      <Conversation.ScrollButton />
    </Conversation.Root>
  );
}

function GridItem({ index, tick }: ItemProps) {
  return (
    <Grid.Root columns={2} role="list" aria-label={`Plans ${index}`}>
      {['Free', 'Team', 'Business', 'Enterprise'].map((plan) => (
        <Card.Root key={plan} role="listitem">
          {plan} {tick}
        </Card.Root>
      ))}
    </Grid.Root>
  );
}

function StackItem({ index, tick }: ItemProps) {
  return (
    <Stack.Root direction="row" justify="between" align="center" wrap>
      <Text.Root weight="bold">
        Billing {index} {tick}
      </Text.Root>
      <Button.Root variant="secondary">Manage</Button.Root>
    </Stack.Root>
  );
}

function ToolbarItem({ index, tick }: ItemProps) {
  return (
    <Toolbar.Root aria-label={`Formatting ${index}`}>
      <Button.Root variant="ghost" data-bench-trigger>
        Bold {tick}
      </Button.Root>
      <Button.Root variant="ghost">Italic</Button.Root>
      <Toolbar.Separator />
      <Toolbar.Group aria-label="History">
        <Button.Root variant="ghost">Undo</Button.Root>
        <Button.Root variant="ghost">Redo</Button.Root>
      </Toolbar.Group>
    </Toolbar.Root>
  );
}

/** What an app puts under a provider: a button, a stepper field and a menu. */
function ProviderSubtree({ index, tick }: ItemProps) {
  const id = useId();
  const [quantity, setQuantity] = useState<number | null>(2);
  return (
    <Stack.Root>
      <Button.Root>
        Save {index} {tick}
      </Button.Root>
      <Field.Group>
        <Label.Root htmlFor={id}>Quantity</Label.Root>
        <Field.Root id={id} name={`quantity-${index}`}>
          <Field.Decrement />
          <Field.NumberInput value={quantity} onValueChange={setQuantity} min={1} max={99} />
          <Field.Increment />
        </Field.Root>
      </Field.Group>
      <Menu.Root>
        <Menu.Trigger variant="ghost">Insert</Menu.Trigger>
        <Menu.Content>
          <Menu.Item>Image</Menu.Item>
          <Menu.Item>Table</Menu.Item>
        </Menu.Content>
      </Menu.Root>
    </Stack.Root>
  );
}

// Declared once so the provider sees the same object on every render, as an app's module-level constants do.
const ACCENT_OVERRIDES = { 'color.accent.default': { colorSpace: 'oklch', components: [0.5, 0.15, 150] } } as const;
const STRINGS = { increment: (field: string) => `Add one to ${field}`, decrement: (field: string) => `Take one from ${field}` };
const GLYPHS = { plus: '+', minus: '-' };

function ThemeProviderItem(props: ItemProps) {
  return (
    <ThemeProvider appearance="dark" overrides={ACCENT_OVERRIDES}>
      <ProviderSubtree {...props} />
    </ThemeProvider>
  );
}

function DensityProviderItem(props: ItemProps) {
  return (
    <DensityProvider density="compact">
      <ProviderSubtree {...props} />
    </DensityProvider>
  );
}

function StringsProviderItem(props: ItemProps) {
  return (
    <StringsProvider strings={STRINGS}>
      <ProviderSubtree {...props} />
    </StringsProvider>
  );
}

function GlyphsProviderItem(props: ItemProps) {
  return (
    <GlyphsProvider glyphs={GLYPHS}>
      <ProviderSubtree {...props} />
    </GlyphsProvider>
  );
}

export const STRUCTURE = {
  Tabs: [
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
  ],
  Table: [
    {
      id: 'table-rows',
      title: 'Table with a sortable header',
      Case: TableCase,
      interact: (container) => first<HTMLElement>(container, 'button').click(),
    },
  ],
  Tree: [
    {
      id: 'tree-items',
      title: 'Tree of files and folders',
      Case: TreeCase,
      interact: (container) => first<HTMLElement>(container, '[data-bench-trigger]').click(),
    },
  ],
  Nav: [
    {
      id: 'nav-links',
      title: 'Nav with links and branches',
      Case: NavCase,
      interact: (container) => first<HTMLElement>(container, 'summary').click(),
    },
  ],
  Contents: [
    {
      id: 'contents-links',
      title: 'Contents with section links',
      copies: PAGE_SIZES,
      Case: ContentsItem,
    },
  ],
  ScrollArea: [{ id: 'scroll-area', title: 'ScrollArea over a list of links', Case: many(ScrollAreaItem) }],
  Splitter: [
    {
      id: 'splitter',
      title: 'Splitter with two panels',
      copies: PAGE_SIZES,
      Case: many(SplitterItem),
      interact: (container) => {
        const handle = first<HTMLElement>(container, '[role="separator"]');
        handle.focus();
        arrowRight(handle);
      },
    },
  ],
  Conversation: [
    { id: 'conversation', title: 'Conversation with four messages', copies: PAGE_SIZES, Case: many(ConversationItem) },
  ],
  Grid: [{ id: 'grid', title: 'Grid of four cards', Case: many(GridItem) }],
  Stack: [{ id: 'stack', title: 'Stack row with text and a button', Case: many(StackItem) }],
  Toolbar: [
    {
      id: 'toolbar',
      title: 'Toolbar of buttons',
      Case: many(ToolbarItem),
      interact: (container) => {
        const item = first<HTMLElement>(container, '[data-bench-trigger]');
        item.focus();
        arrowRight(item);
      },
    },
  ],
  ThemeProvider: [
    { id: 'theme-provider', title: 'ThemeProvider with an accent override', copies: PAGE_SIZES, Case: many(ThemeProviderItem) },
  ],
  DensityProvider: [
    { id: 'density-provider', title: 'DensityProvider around a form', copies: PAGE_SIZES, Case: many(DensityProviderItem) },
  ],
  StringsProvider: [
    { id: 'strings-provider', title: 'StringsProvider around a form', copies: PAGE_SIZES, Case: many(StringsProviderItem) },
  ],
  GlyphsProvider: [
    { id: 'glyphs-provider', title: 'GlyphsProvider around a form', copies: PAGE_SIZES, Case: many(GlyphsProviderItem) },
  ],
} satisfies CoverageGroup;
