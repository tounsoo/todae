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
  Composer,
  Disclosure,
  Field,
  GlyphsProvider,
  Label,
  Link,
  Loader,
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
  Switch,
  Table,
  Tabs,
  Text,
  ToggleGroup,
  Tree,
  type Glyphs,
} from '@omsoo.design/todae';
import { useId, useState, type FormEvent } from 'react';
import type { Locale } from '../../lib/i18n/config';
import type { IconLibrary } from '../iconLibraries';
import { PREVIEW_COPY } from './previewCopy';

const NO_GLYPHS: Glyphs = {};

/**
 * A product-like screen built from Todae parts. The playground's theme paints
 * it, and its icons and Todae's own glyphs come from `library` when one is
 * picked. Its words are in the page's language. Nothing leaves the page.
 */
export function Preview({ library, locale }: { library?: IconLibrary; locale: Locale }) {
  const icons = library?.icons;
  const copy = PREVIEW_COPY[locale];
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
      <div className="preview">
        <div className="preview-head">
          <div className="preview-user">
            <Avatar.Root label={copy.user.name} tone={categoryTone('ada')}>
              <Avatar.Fallback>{copy.user.initials}</Avatar.Fallback>
            </Avatar.Root>
            <div>
              <Breadcrumbs.Root>
                <Breadcrumbs.Item>
                  <Link.Root href="#preview" onClick={(event) => event.preventDefault()}>
                    Acme
                  </Link.Root>
                </Breadcrumbs.Item>
                <Breadcrumbs.Item current>{copy.page}</Breadcrumbs.Item>
              </Breadcrumbs.Root>
              <Text.Root as="h2" size="l">
                {copy.greeting}
              </Text.Root>
              <Text.Root tone="muted" size="s">
                {copy.searchHint}
              </Text.Root>
            </div>
          </div>
          <div className="preview-actions">
            <Button.Root variant="secondary">
              {icons ? <Button.Icon>{icons.mail}</Button.Icon> : null}
              {copy.invite}
            </Button.Root>
            <Button.Root>
              {icons ? <Button.Icon>{icons.plus}</Button.Icon> : null}
              {copy.newProject}
            </Button.Root>
            <Menu.Root>
              <Menu.Trigger variant="ghost">{copy.more}</Menu.Trigger>
              <Menu.Content>
                <Menu.Item>{copy.exportCsv}</Menu.Item>
                <Menu.Item>{copy.print}</Menu.Item>
                <Menu.Separator />
                <Menu.Item disabled>{copy.archive}</Menu.Item>
              </Menu.Content>
            </Menu.Root>
            {icons ? (
              <Button.Root variant="ghost" aria-label={copy.settings}>
                <Button.Icon>{icons.settings}</Button.Icon>
              </Button.Root>
            ) : null}
          </div>
        </div>

        <div className="preview-grid">
          <Card.Root className="preview-span-2">
            <Card.Header>
              <div className="preview-card-title">
                <Text.Root as="h3">{copy.revenue}</Text.Root>
                <ToggleGroup.Root aria-label={copy.range} value={range} onValueChange={setRange}>
                  <ToggleGroup.Item value="day">{copy.day}</ToggleGroup.Item>
                  <ToggleGroup.Item value="week">{copy.week}</ToggleGroup.Item>
                  <ToggleGroup.Item value="month">{copy.month}</ToggleGroup.Item>
                </ToggleGroup.Root>
              </div>
            </Card.Header>
            <Card.Body>
              <div className="preview-stats">
                <div>
                  <Text.Root tone="muted" size="s">
                    {copy.booked}
                  </Text.Root>
                  <Text.Root size="2xl" weight="bold">
                    {copy.bookedAmount}
                  </Text.Root>
                  <Badge.Root tone="success">+12.4%</Badge.Root>
                </div>
                <div>
                  <Text.Root tone="muted" size="s">
                    {copy.churned}
                  </Text.Root>
                  <Text.Root size="2xl" weight="bold">
                    {copy.churnedAmount}
                  </Text.Root>
                  <Badge.Root tone="critical">+3.1%</Badge.Root>
                </div>
                <div>
                  <Text.Root tone="muted" size="s">
                    {copy.quota}
                  </Text.Root>
                  <Text.Root size="2xl" weight="bold">
                    72%
                  </Text.Root>
                  <Progress.Root value={72} max={100} aria-label={copy.quotaUsed} />
                </div>
              </div>
            </Card.Body>
          </Card.Root>

          <Card.Root className="preview-tall">
            <Card.Header>
              <Text.Root as="h3">{copy.upgrade}</Text.Root>
            </Card.Header>
            <Card.Body>
              <form className="preview-form" onSubmit={(event) => event.preventDefault()}>
                <Field.Group>
                  <Label.Root htmlFor={ids.email}>{copy.workEmail}</Label.Root>
                  <Field.Root id={ids.email}>
                    {icons ? <Field.Icon>{icons.mail}</Field.Icon> : null}
                    <Field.TextInput type="email" value={email} onChange={(event) => setEmail(event.target.value)} />
                  </Field.Root>
                </Field.Group>
                <Field.Group>
                  <Label.Root htmlFor={ids.plan}>{copy.plan}</Label.Root>
                  <Field.Root id={ids.plan}>
                    <Field.Select value={plan} onValueChange={setPlan}>
                      <option value="starter">Starter</option>
                      <option value="pro">Pro</option>
                      <option value="scale">Scale</option>
                    </Field.Select>
                  </Field.Root>
                </Field.Group>
                <Field.Group>
                  <Label.Root htmlFor={ids.start}>{copy.startDate}</Label.Root>
                  <Field.Root id={ids.start}>
                    <Field.DatePicker value={start} onValueChange={setStart} locale={locale} />
                  </Field.Root>
                </Field.Group>
                <Field.Group>
                  <Label.Root htmlFor={ids.seats}>{copy.seats}</Label.Root>
                  <Slider.Root id={ids.seats} min={1} max={50} defaultValue={12} />
                </Field.Group>
                <Field.Group>
                  <Text.Root as="span" id={ids.billing} size="s" weight="medium">
                    {copy.billing}
                  </Text.Root>
                  <RadioGroup.Root aria-labelledby={ids.billing} defaultValue="yearly">
                    <RadioGroup.Item value="monthly">{copy.monthly}</RadioGroup.Item>
                    <RadioGroup.Item value="yearly">{copy.yearly}</RadioGroup.Item>
                  </RadioGroup.Root>
                </Field.Group>
                <Checkbox.Root defaultChecked>{copy.emailInvoice}</Checkbox.Root>
                <Button.Root type="submit">{copy.upgradeToPro}</Button.Root>
              </form>
            </Card.Body>
          </Card.Root>

          <Card.Root className="preview-span-2">
            <Card.Header>
              <Text.Root as="h3">{copy.invoices}</Text.Root>
            </Card.Header>
            <Card.Body>
              <ScrollArea.Root axis="inline" aria-label={copy.invoices}>
                <Table.Root>
                  <Table.Head>
                    <Table.Row>
                      <Table.HeaderCell scope="col">{copy.invoice}</Table.HeaderCell>
                      <Table.HeaderCell scope="col">{copy.customer}</Table.HeaderCell>
                      <Table.HeaderCell scope="col">{copy.status}</Table.HeaderCell>
                      <Table.HeaderCell scope="col" className="preview-num">
                        {copy.amount}
                      </Table.HeaderCell>
                    </Table.Row>
                  </Table.Head>
                  <Table.Body>
                    {copy.invoiceRows.map((invoice) => (
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
              <Pagination.Root aria-label={copy.invoicePages}>
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
              <Text.Root as="h3">{copy.assistant}</Text.Root>
            </Card.Header>
            <Card.Body>
              <div className="preview-stack">
                <Message.Root from="user" aria-label={copy.you}>
                  <Message.Content>{copy.question}</Message.Content>
                </Message.Root>
                <Message.Root aria-label={copy.assistant}>
                  <Message.Avatar>
                    <Avatar.Root tone={categoryTone('assistant')}>
                      <Avatar.Fallback>A</Avatar.Fallback>
                    </Avatar.Root>
                  </Message.Avatar>
                  <Message.Header>
                    <strong>{copy.assistant}</strong>
                  </Message.Header>
                  <Message.Content>
                    <Prose.Root>
                      <p>{copy.answer}</p>
                    </Prose.Root>
                  </Message.Content>
                </Message.Root>
                <Attachment.Root>
                  <Attachment.Name>invoices-q3.csv</Attachment.Name>
                  <Attachment.Meta>48 KB</Attachment.Meta>
                </Attachment.Root>
                {asked.map((text, index) => (
                  <Message.Root key={index} from="user" aria-label={copy.you}>
                    <Message.Content>{text}</Message.Content>
                  </Message.Root>
                ))}
                <Composer.Root onSubmit={ask}>
                  <Field.Root aria-label={copy.messageLabel}>
                    <Field.Textarea
                      value={draft}
                      onChange={(event) => setDraft(event.target.value)}
                      placeholder={copy.askPlaceholder}
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
              <Text.Root as="h3">{copy.notifications}</Text.Root>
            </Card.Header>
            <Card.Body>
              <div className="preview-stack">
                <Switch.Root defaultChecked>{copy.mentions}</Switch.Root>
                <Switch.Root defaultChecked>{copy.weeklyDigest}</Switch.Root>
                <Switch.Root>{copy.productNews}</Switch.Root>
                <div className="preview-chips">
                  {/* A mock, like the buttons: removing does nothing here. */}
                  <Chip.Root tone={categoryTone('design')} onRemove={() => undefined}>
                    {copy.chips.design}
                  </Chip.Root>
                  <Chip.Root tone={categoryTone('billing')} onRemove={() => undefined}>
                    {copy.chips.billing}
                  </Chip.Root>
                  <Chip.Root tone="critical">{copy.chips.urgent}</Chip.Root>
                </div>
              </div>
            </Card.Body>
          </Card.Root>

          <Card.Root>
            <Card.Header>
              <Text.Root as="h3">{copy.activity}</Text.Root>
            </Card.Header>
            <Card.Body>
              <Tabs.Root defaultValue="all">
                <Tabs.List aria-label={copy.activity}>
                  <Tabs.Tab value="all">{copy.all}</Tabs.Tab>
                  <Tabs.Tab value="mine">{copy.mine}</Tabs.Tab>
                  <Tabs.Tab value="loading">{copy.loading}</Tabs.Tab>
                </Tabs.List>
                <Tabs.Panel value="all">
                  <ul className="preview-list">
                    <li>
                      <span>{copy.paidEvent}</span>
                      <Badge.Root tone="success">{copy.paid}</Badge.Root>
                    </li>
                    <li>
                      <span>{copy.reminderEvent}</span>
                      <Badge.Root tone="info">{copy.sent}</Badge.Root>
                    </li>
                  </ul>
                </Tabs.Panel>
                <Tabs.Panel value="mine">
                  <Text.Root tone="muted">{copy.nothingAssigned}</Text.Root>
                </Tabs.Panel>
                <Tabs.Panel value="loading">
                  <div className="preview-loading">
                    <Loader.Root aria-label={copy.loadingActivity} />
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
              <Text.Root as="h3">{copy.files}</Text.Root>
            </Card.Header>
            <Card.Body>
              <div className="preview-stack">
                <Tree.Root aria-label={copy.files} defaultExpanded={['exports']}>
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
                  <Label.Root htmlFor={ids.storage}>{copy.storage}</Label.Root>
                  <Meter.Root id={ids.storage} min={0} max={100} low={70} high={90} optimum={0} value={92} />
                </Field.Group>
              </div>
            </Card.Body>
          </Card.Root>

          <Card.Root>
            <Card.Header>
              <Text.Root as="h3">{copy.questions}</Text.Root>
            </Card.Header>
            <Card.Body>
              {copy.faq.map((item, index) => (
                <Disclosure.Root key={item.question} name={ids.faq} open={index === 0}>
                  <Disclosure.Summary>{item.question}</Disclosure.Summary>
                  <Text.Root>{item.answer}</Text.Root>
                </Disclosure.Root>
              ))}
            </Card.Body>
          </Card.Root>

          <div className="preview-span-3 preview-alerts">
            <Alert.Root tone="info" role="none">
              {icons ? <Alert.Icon>{icons.info}</Alert.Icon> : null}
              <Alert.Title>{copy.maintenance.title}</Alert.Title>
              <Alert.Description>{copy.maintenance.body}</Alert.Description>
              <Alert.Close />
            </Alert.Root>
            <Alert.Root tone="warning" role="none">
              {icons ? <Alert.Icon>{icons.warning}</Alert.Icon> : null}
              <Alert.Title>{copy.cardExpiry.title}</Alert.Title>
              <Alert.Description>{copy.cardExpiry.body}</Alert.Description>
              <Alert.Close />
            </Alert.Root>
          </div>
        </div>
      </div>
    </GlyphsProvider>
  );
}
