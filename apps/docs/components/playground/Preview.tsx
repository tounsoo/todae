'use client';

import {
  Alert,
  Attachment,
  Avatar,
  Badge,
  Breadcrumbs,
  Button,
  Card,
  categoryTone,
  Checkbox,
  Chip,
  Code,
  Composer,
  Disclosure,
  Field,
  GlyphsProvider,
  Kbd,
  Label,
  Menu,
  Message,
  Meter,
  Pagination,
  paginationRange,
  Progress,
  Prose,
  RadioGroup,
  ScrollArea,
  Skeleton,
  Slider,
  Spinner,
  Switch,
  Table,
  Tabs,
  Text,
  ToggleGroup,
  Tree,
  type Glyphs,
} from '@omsoo.design/todae';
import { useId, useState, type FormEvent } from 'react';
import type { IconLibrary } from '../iconLibraries';

const NO_GLYPHS: Glyphs = {};

const INVOICES = [
  { id: 'INV-1042', customer: 'Northwind', status: 'Paid', tone: 'success', amount: '$4,120.00' },
  { id: 'INV-1043', customer: 'Globex', status: 'Due soon', tone: 'warning', amount: '$860.00' },
  { id: 'INV-1039', customer: 'Initech', status: 'Overdue', tone: 'critical', amount: '$2,015.50' },
  { id: 'INV-1044', customer: 'Umbrella', status: 'Draft', tone: 'neutral', amount: '$1,240.00' },
] as const;

/**
 * A product-like screen built from Todae parts. The playground's theme paints
 * it, and its icons and Todae's own glyphs come from `library` when one is
 * picked. Copy is English, like every demo. Nothing leaves the page.
 */
export function Preview({ library }: { library?: IconLibrary }) {
  const icons = library?.icons;
  const ids = {
    email: useId(),
    plan: useId(),
    start: useId(),
    seats: useId(),
    billing: useId(),
    storage: useId(),
    faq: useId(),
  };
  const [email, setEmail] = useState('ada@example.com');
  const [range, setRange] = useState<string | null>('week');
  const [plan, setPlan] = useState('pro');
  const [start, setStart] = useState<Temporal.PlainDate | null>(null);
  const [page, setPage] = useState(2);
  const [draft, setDraft] = useState('');
  const [asked, setAsked] = useState<string[]>([]);

  const ask = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setAsked((all) => [...all, draft]);
    setDraft('');
  };

  return (
    <GlyphsProvider glyphs={library?.glyphs ?? NO_GLYPHS}>
      <div className="preview" lang="en">
        <div className="preview-head">
          <div className="preview-user">
            <Avatar.Root label="Ada Lovelace" tone={categoryTone('ada')}>
              <Avatar.Fallback>AL</Avatar.Fallback>
            </Avatar.Root>
            <div>
              <Breadcrumbs.Root>
                <Breadcrumbs.Item>
                  <a href="#preview" onClick={(event) => event.preventDefault()}>
                    Acme
                  </a>
                </Breadcrumbs.Item>
                <Breadcrumbs.Item current>Billing</Breadcrumbs.Item>
              </Breadcrumbs.Root>
              <Text.Root as="h2" size="l">
                Good morning, Ada
              </Text.Root>
              <Text.Root tone="muted" size="s">
                3 reviews wait on you today. Press <Kbd.Root>Ctrl</Kbd.Root> <Kbd.Root>K</Kbd.Root> to search.
              </Text.Root>
            </div>
          </div>
          <div className="preview-actions">
            <Button.Root variant="secondary">
              {icons ? <Button.Icon>{icons.mail}</Button.Icon> : null}
              Invite
            </Button.Root>
            <Button.Root>
              {icons ? <Button.Icon>{icons.plus}</Button.Icon> : null}
              New project
            </Button.Root>
            <Menu.Root>
              <Menu.Trigger variant="ghost">More</Menu.Trigger>
              <Menu.Content>
                <Menu.Item>Export CSV</Menu.Item>
                <Menu.Item>Print</Menu.Item>
                <Menu.Separator />
                <Menu.Item disabled>Archive workspace</Menu.Item>
              </Menu.Content>
            </Menu.Root>
            {icons ? (
              <Button.Root variant="ghost" aria-label="Settings">
                <Button.Icon>{icons.settings}</Button.Icon>
              </Button.Root>
            ) : null}
          </div>
        </div>

        <div className="preview-grid">
          <Card.Root className="preview-span-2">
            <Card.Header>
              <div className="preview-card-title">
                <Text.Root as="h3">Revenue</Text.Root>
                <ToggleGroup.Root aria-label="Range" value={range} onValueChange={setRange}>
                  <ToggleGroup.Item value="day">Day</ToggleGroup.Item>
                  <ToggleGroup.Item value="week">Week</ToggleGroup.Item>
                  <ToggleGroup.Item value="month">Month</ToggleGroup.Item>
                </ToggleGroup.Root>
              </div>
            </Card.Header>
            <Card.Body>
              <div className="preview-stats">
                <div>
                  <Text.Root tone="muted" size="s">
                    Booked
                  </Text.Root>
                  <Text.Root size="2xl" weight="bold">
                    $48,210
                  </Text.Root>
                  <Badge.Root tone="success">+12.4%</Badge.Root>
                </div>
                <div>
                  <Text.Root tone="muted" size="s">
                    Churned
                  </Text.Root>
                  <Text.Root size="2xl" weight="bold">
                    $2,380
                  </Text.Root>
                  <Badge.Root tone="critical">+3.1%</Badge.Root>
                </div>
                <div>
                  <Text.Root tone="muted" size="s">
                    Quota
                  </Text.Root>
                  <Text.Root size="2xl" weight="bold">
                    72%
                  </Text.Root>
                  <Progress.Root value={72} max={100} aria-label="Quota used" />
                </div>
              </div>
            </Card.Body>
          </Card.Root>

          <Card.Root className="preview-tall">
            <Card.Header>
              <Text.Root as="h3">Upgrade</Text.Root>
            </Card.Header>
            <Card.Body>
              <form className="preview-form" onSubmit={(event) => event.preventDefault()}>
                <Field.Group>
                  <Label.Root htmlFor={ids.email}>Work email</Label.Root>
                  <Field.Root id={ids.email}>
                    {icons ? <Field.Icon>{icons.mail}</Field.Icon> : null}
                    <Field.TextInput type="email" value={email} onChange={(event) => setEmail(event.target.value)} />
                  </Field.Root>
                </Field.Group>
                <Field.Group>
                  <Label.Root htmlFor={ids.plan}>Plan</Label.Root>
                  <Field.Root id={ids.plan}>
                    <Field.Select value={plan} onValueChange={setPlan}>
                      <option value="starter">Starter</option>
                      <option value="pro">Pro</option>
                      <option value="scale">Scale</option>
                    </Field.Select>
                  </Field.Root>
                </Field.Group>
                <Field.Group>
                  <Label.Root htmlFor={ids.start}>Start date</Label.Root>
                  <Field.Root id={ids.start}>
                    <Field.DatePicker value={start} onValueChange={setStart} />
                  </Field.Root>
                </Field.Group>
                <Field.Group>
                  <Label.Root htmlFor={ids.seats}>Seats</Label.Root>
                  <Slider.Root id={ids.seats} min={1} max={50} defaultValue={12} />
                </Field.Group>
                <Field.Group>
                  <Text.Root as="span" id={ids.billing} size="s" weight="medium">
                    Billing
                  </Text.Root>
                  <RadioGroup.Root aria-labelledby={ids.billing} defaultValue="yearly">
                    <RadioGroup.Item value="monthly">Monthly</RadioGroup.Item>
                    <RadioGroup.Item value="yearly">Yearly, save 20%</RadioGroup.Item>
                  </RadioGroup.Root>
                </Field.Group>
                <Checkbox.Root defaultChecked>Email me the invoice</Checkbox.Root>
                <Button.Root type="submit">Upgrade to Pro</Button.Root>
              </form>
            </Card.Body>
          </Card.Root>

          <Card.Root className="preview-span-2">
            <Card.Header>
              <Text.Root as="h3">Invoices</Text.Root>
            </Card.Header>
            <Card.Body>
              <ScrollArea.Root axis="inline" aria-label="Invoices">
                <Table.Root>
                  <Table.Head>
                    <Table.Row>
                      <Table.HeaderCell scope="col">Invoice</Table.HeaderCell>
                      <Table.HeaderCell scope="col">Customer</Table.HeaderCell>
                      <Table.HeaderCell scope="col">Status</Table.HeaderCell>
                      <Table.HeaderCell scope="col" className="preview-num">
                        Amount
                      </Table.HeaderCell>
                    </Table.Row>
                  </Table.Head>
                  <Table.Body>
                    {INVOICES.map((invoice) => (
                      <Table.Row key={invoice.id}>
                        <Table.HeaderCell scope="row">{invoice.id}</Table.HeaderCell>
                        <Table.Cell>{invoice.customer}</Table.Cell>
                        <Table.Cell>
                          <Badge.Root tone={invoice.tone}>{invoice.status}</Badge.Root>
                        </Table.Cell>
                        <Table.Cell className="preview-num">{invoice.amount}</Table.Cell>
                      </Table.Row>
                    ))}
                  </Table.Body>
                </Table.Root>
              </ScrollArea.Root>
            </Card.Body>
            <Card.Footer>
              <Pagination.Root aria-label="Invoice pages">
                {paginationRange({ page, count: 9 }).map((item) =>
                  typeof item === 'number' ? (
                    <Pagination.Item key={item}>
                      <button type="button" aria-current={item === page ? 'page' : undefined} onClick={() => setPage(item)}>
                        {item}
                      </button>
                    </Pagination.Item>
                  ) : (
                    <Pagination.Ellipsis key={item} />
                  ),
                )}
              </Pagination.Root>
            </Card.Footer>
          </Card.Root>

          <Card.Root className="preview-span-2">
            <Card.Header>
              <Text.Root as="h3">Assistant</Text.Root>
            </Card.Header>
            <Card.Body>
              <div className="preview-stack">
                <Message.Root from="user" aria-label="You">
                  <Message.Content>Can I export last quarter&apos;s invoices?</Message.Content>
                </Message.Root>
                <Message.Root aria-label="Assistant">
                  <Message.Avatar>
                    <Avatar.Root tone={categoryTone('assistant')}>
                      <Avatar.Fallback>A</Avatar.Fallback>
                    </Avatar.Root>
                  </Message.Avatar>
                  <Message.Header>
                    <strong>Assistant</strong>
                  </Message.Header>
                  <Message.Content>
                    <Prose.Root>
                      <p>
                        Yes. Open <strong>Billing</strong>, pick the range, then choose <Code.Root>Export CSV</Code.Root>.
                        Here is last quarter&apos;s file.
                      </p>
                    </Prose.Root>
                  </Message.Content>
                </Message.Root>
                <Attachment.Root>
                  <Attachment.Name>invoices-q3.csv</Attachment.Name>
                  <Attachment.Meta>48 KB</Attachment.Meta>
                </Attachment.Root>
                {asked.map((text, index) => (
                  <Message.Root key={index} from="user" aria-label="You">
                    <Message.Content>{text}</Message.Content>
                  </Message.Root>
                ))}
                <Composer.Root onSubmit={ask}>
                  <Field.Root aria-label="Message">
                    <Field.Textarea
                      value={draft}
                      onChange={(event) => setDraft(event.target.value)}
                      placeholder="Ask about your billing"
                      autoGrow
                      maxRows={4}
                    />
                    <Field.Row>
                      <Composer.Submit disabled={draft.trim() === ''} />
                    </Field.Row>
                  </Field.Root>
                </Composer.Root>
              </div>
            </Card.Body>
          </Card.Root>

          <Card.Root>
            <Card.Header>
              <Text.Root as="h3">Notifications</Text.Root>
            </Card.Header>
            <Card.Body>
              <div className="preview-stack">
                <Switch.Root defaultChecked>Mentions</Switch.Root>
                <Switch.Root defaultChecked>Weekly digest</Switch.Root>
                <Switch.Root>Product news</Switch.Root>
                <div className="preview-chips">
                  {/* A mock, like the buttons: removing does nothing here. */}
                  <Chip.Root tone={categoryTone('design')} onRemove={() => undefined}>
                    design
                  </Chip.Root>
                  <Chip.Root tone={categoryTone('billing')} onRemove={() => undefined}>
                    billing
                  </Chip.Root>
                  <Chip.Root tone="critical">urgent</Chip.Root>
                </div>
              </div>
            </Card.Body>
          </Card.Root>

          <Card.Root>
            <Card.Header>
              <Text.Root as="h3">Activity</Text.Root>
            </Card.Header>
            <Card.Body>
              <Tabs.Root defaultValue="all">
                <Tabs.List aria-label="Activity">
                  <Tabs.Tab value="all">All</Tabs.Tab>
                  <Tabs.Tab value="mine">Mine</Tabs.Tab>
                  <Tabs.Tab value="loading">Loading</Tabs.Tab>
                </Tabs.List>
                <Tabs.Panel value="all">
                  <ul className="preview-list">
                    <li>
                      <span>Grace paid INV-1042</span>
                      <Badge.Root tone="success">Paid</Badge.Root>
                    </li>
                    <li>
                      <span>Reminder sent to Globex</span>
                      <Badge.Root tone="info">Sent</Badge.Root>
                    </li>
                  </ul>
                </Tabs.Panel>
                <Tabs.Panel value="mine">
                  <Text.Root tone="muted">Nothing assigned to you.</Text.Root>
                </Tabs.Panel>
                <Tabs.Panel value="loading">
                  <div className="preview-loading">
                    <Spinner.Root aria-label="Loading activity" />
                    <div className="preview-stack">
                      <Skeleton.Root />
                      <Skeleton.Root style={{ inlineSize: '60%' }} />
                    </div>
                  </div>
                </Tabs.Panel>
              </Tabs.Root>
            </Card.Body>
          </Card.Root>

          <Card.Root>
            <Card.Header>
              <Text.Root as="h3">Files</Text.Root>
            </Card.Header>
            <Card.Body>
              <div className="preview-stack">
                <Tree.Root aria-label="Files" defaultExpanded={['exports']}>
                  <Tree.Item value="exports">
                    <Tree.Label>exports</Tree.Label>
                    <Tree.Group>
                      <Tree.Item value="exports/q3.csv">
                        <Tree.Label>invoices-q3.csv</Tree.Label>
                      </Tree.Item>
                      <Tree.Item value="exports/q2.csv">
                        <Tree.Label>invoices-q2.csv</Tree.Label>
                      </Tree.Item>
                    </Tree.Group>
                  </Tree.Item>
                  <Tree.Item value="contracts">
                    <Tree.Label>contracts.pdf</Tree.Label>
                  </Tree.Item>
                </Tree.Root>
                <Field.Group>
                  <Label.Root htmlFor={ids.storage}>Storage, 92 of 100 GB</Label.Root>
                  <Meter.Root id={ids.storage} min={0} max={100} low={70} high={90} optimum={0} value={92} />
                </Field.Group>
              </div>
            </Card.Body>
          </Card.Root>

          <Card.Root>
            <Card.Header>
              <Text.Root as="h3">Questions</Text.Root>
            </Card.Header>
            <Card.Body>
              <Disclosure.Root name={ids.faq} open>
                <Disclosure.Summary>When am I billed?</Disclosure.Summary>
                <Text.Root>On the first of each month, for the seats you used.</Text.Root>
              </Disclosure.Root>
              <Disclosure.Root name={ids.faq}>
                <Disclosure.Summary>Can I change plans later?</Disclosure.Summary>
                <Text.Root>Yes, any time. The new price starts on your next invoice.</Text.Root>
              </Disclosure.Root>
            </Card.Body>
          </Card.Root>

          <div className="preview-span-3 preview-alerts">
            <Alert.Root tone="info" role="none">
              {icons ? <Alert.Icon>{icons.info}</Alert.Icon> : null}
              <Alert.Title>Scheduled maintenance</Alert.Title>
              <Alert.Description>Billing is read-only on Sunday from 02:00 to 03:00 UTC.</Alert.Description>
              <Alert.Close />
            </Alert.Root>
            <Alert.Root tone="warning" role="none">
              {icons ? <Alert.Icon>{icons.warning}</Alert.Icon> : null}
              <Alert.Title>Card expires soon</Alert.Title>
              <Alert.Description>Update it before 2026-11-01 to keep your plan.</Alert.Description>
              <Alert.Close />
            </Alert.Root>
          </div>
        </div>
      </div>
    </GlyphsProvider>
  );
}
