'use client';

import {
  Alert,
  Avatar,
  Badge,
  Breadcrumbs,
  Button,
  Card,
  categoryTone,
  Checkbox,
  Chip,
  ChipList,
  ColorPicker,
  createToaster,
  Disclosure,
  Field,
  GlyphsProvider,
  Label,
  Link,
  Loader,
  Menu,
  Meter,
  Progress,
  RadioGroup,
  Skeleton,
  Slider,
  Splitter,
  Switch,
  Tabs,
  Text,
  Toast,
  Tree,
  type Glyphs,
} from '@tounsoo/todae';
import { useId, useMemo, useReducer, useState } from 'react';
import type { Locale } from '../../lib/i18n/config';
import { ICON_LIBRARIES, type IconLibrary } from '../iconLibraries';
import { AssistantCard } from './AssistantCard';
import { billingReducer, nextInvoiceId, startBilling, totals, type Invoice } from './billing';
import { InvoiceDetail } from './InvoiceDetail';
import { InvoiceTable } from './InvoiceTable';
import { makeKit, type InvoiceActions } from './kit';
import { NewInvoice, type NewInvoiceValues } from './NewInvoice';
import { PREVIEW_COPY } from './previewCopy';
import { SearchPalette, type PaletteCommand } from './SearchPalette';

const NO_GLYPHS: Glyphs = {};

type FileKey = 'exports/q3.csv' | 'exports/q2.csv' | 'contracts';
const FILES: Record<FileKey, string> = {
  'exports/q3.csv': 'invoices-q3.csv',
  'exports/q2.csv': 'invoices-q2.csv',
  contracts: 'contracts.pdf',
};
const isFile = (value: string): value is FileKey => value in FILES;

/**
 * A small billing app built from Todae parts, to try a theme on. The
 * playground's theme paints it, and its icons and Todae's own glyphs come from
 * `library` when one is picked. Its words are in the page's language.
 *
 * Everything works on made-up data: search with Ctrl K, sort and page the
 * invoices, open one, mark it paid and undo, or make a new one. Nothing leaves
 * the page, and a reload starts over.
 */
export function Preview({ library, locale }: { library?: IconLibrary; locale: Locale }) {
  const icons = library?.icons;
  const copy = PREVIEW_COPY[locale];
  const kit = useMemo(() => makeKit(copy, locale), [copy, locale]);
  const ids = { email: useId(), plan: useId(), start: useId(), seats: useId(), billing: useId(), storage: useId(), faq: useId(), terms: useId(), file: useId() };
  // Todae draws no icons, so with its own glyphs the actions take Lucide's.
  const actionLibrary = library ?? ICON_LIBRARIES[0];

  const [billing, dispatch] = useReducer(billingReducer, copy.invoices, (invoices) =>
    startBilling(invoices, [
      { kind: 'paid', id: 'INV-1042', customer: 'Northwind' },
      { kind: 'reminded', id: 'INV-1039', customer: 'Vandelay' },
    ]),
  );
  const [toaster] = useState(() => createToaster<{ onUndo?: () => void }>());
  const [showDrafts, setShowDrafts] = useState(true);
  const [detail, setDetail] = useState<{ id: string; open: boolean } | null>(null);
  const [creating, setCreating] = useState(false);
  const [terms, setTerms] = useState<number | null>(14);
  const [accent, setAccent] = useState('#3366ff');
  const [tags, setTags] = useState(() => [copy.chips.billing, copy.chips.urgent, copy.tagLong]);
  const [file, setFile] = useState<string>('exports/q3.csv');
  const [email, setEmail] = useState('ada@example.com');
  const [plan, setPlan] = useState('pro');
  const [start, setStart] = useState<Temporal.PlainDate | null>(null);

  const find = (id: string) => billing.invoices.find((invoice) => invoice.id === id);
  // One undo at a time: a new one takes the place of the toast still showing.
  const undoable = (title: string, onUndo: () => void) => toaster.add({ id: 'undo', title, duration: Infinity, onUndo });

  const actions: InvoiceActions = {
    open: (id) => setDetail({ id, open: true }),
    markPaid: (id) => {
      const before = find(id);
      if (!before) return;
      dispatch({ type: 'markPaid', id });
      undoable(copy.toasts.paid(id), () => dispatch({ type: 'unpay', id, status: before.status }));
    },
    send: (id) => {
      const invoice = find(id);
      if (!invoice) return;
      dispatch({ type: 'send', id });
      toaster.add({ tone: 'success', title: copy.toasts.sent(invoice) });
    },
    remind: (id) => {
      const invoice = find(id);
      if (!invoice) return;
      dispatch({ type: 'remind', id });
      toaster.add({ title: copy.toasts.reminded(invoice) });
    },
    flag: (id, flagged) => dispatch({ type: 'flag', id, flagged }),
    move: (id, folder) => dispatch({ type: 'move', id, folder }),
    archive: (id) => {
      dispatch({ type: 'archive', id });
      undoable(copy.toasts.archived(id), () => dispatch({ type: 'unarchive', id }));
    },
  };

  const create = (values: NewInvoiceValues) => {
    const invoice: Invoice = { id: nextInvoiceId(billing), ...values, status: 'draft', flagged: false, folder: null };
    dispatch({ type: 'create', invoice });
    setCreating(false);
    setShowDrafts(true);
    undoable(copy.toasts.created(invoice.id), () => {
      dispatch({ type: 'remove', id: invoice.id });
      // Its details close with it, so a new invoice that takes the same number doesn't open them.
      setDetail((current) => (current?.id === invoice.id ? { ...current, open: false } : current));
    });
  };

  const exportAs = (kind: 'csv' | 'pdf') => toaster.add({ tone: 'success', title: copy.toasts.exported(`invoices.${kind}`) });
  const commands: PaletteCommand[] = [
    { value: 'new', label: copy.newInvoice, run: () => setCreating(true) },
    { value: 'csv', label: `${copy.exportAs} CSV`, run: () => exportAs('csv') },
    { value: 'pdf', label: `${copy.exportAs} PDF`, run: () => exportAs('pdf') },
    { value: 'print', label: copy.print, run: () => toaster.add({ title: copy.toasts.printed }) },
  ];

  const shown = showDrafts ? billing.invoices : billing.invoices.filter((invoice) => invoice.status !== 'draft');
  const sum = totals(billing.invoices);
  const billed = sum.paid + sum.open;
  const customers = [...new Set(billing.invoices.map((invoice) => invoice.customer))].sort((a, b) => a.localeCompare(b));

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
              <Text.Root as="h2">{copy.greeting}</Text.Root>
              <Text.Root tone="muted">{copy.searchHint(sum.overdue)}</Text.Root>
            </div>
          </div>
          <div className="preview-actions">
            <SearchPalette kit={kit} commands={commands} invoices={billing.invoices} onOpenInvoice={actions.open} icon={icons?.search} />
            <Button.Root variant="secondary">
              {icons ? <Button.Icon>{icons.mail}</Button.Icon> : null}
              {copy.invite}
            </Button.Root>
            <Button.Root onClick={() => setCreating(true)}>
              {icons ? <Button.Icon>{icons.plus}</Button.Icon> : null}
              {copy.newInvoice}
            </Button.Root>
            <Menu.Root>
              <Menu.Trigger variant="ghost">{copy.more}</Menu.Trigger>
              <Menu.Content>
                <Menu.Submenu>
                  <Menu.SubmenuTrigger>{copy.exportAs}</Menu.SubmenuTrigger>
                  <Menu.SubmenuContent>
                    <Menu.Item onSelect={() => exportAs('csv')}>CSV</Menu.Item>
                    <Menu.Item onSelect={() => exportAs('pdf')}>PDF</Menu.Item>
                  </Menu.SubmenuContent>
                </Menu.Submenu>
                <Menu.Item onSelect={() => toaster.add({ title: copy.toasts.printed })}>{copy.print}</Menu.Item>
                <Menu.Separator />
                <Menu.CheckboxItem checked={showDrafts} onCheckedChange={setShowDrafts}>
                  {copy.showDrafts}
                </Menu.CheckboxItem>
                <Menu.Separator />
                <Menu.Item disabled>{copy.archiveWorkspace}</Menu.Item>
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
              <Text.Root as="h3">{copy.revenue}</Text.Root>
            </Card.Header>
            <Card.Body>
              <div className="preview-stats">
                <div>
                  <Text.Root tone="muted">{copy.collected}</Text.Root>
                  <Text.Root weight="bold">{kit.money(sum.paid)}</Text.Root>
                  <Badge.Root tone="success">+12.4%</Badge.Root>
                </div>
                <div>
                  <Text.Root tone="muted">{copy.outstanding}</Text.Root>
                  <Text.Root weight="bold">{kit.money(sum.open)}</Text.Root>
                  <Badge.Root tone={sum.overdue > 0 ? 'critical' : 'success'}>{copy.overdueCount(sum.overdue)}</Badge.Root>
                </div>
                <div>
                  <Text.Root tone="muted">{copy.collectedShare}</Text.Root>
                  <Text.Root weight="bold">{billed === 0 ? '0%' : `${Math.round((sum.paid / billed) * 100)}%`}</Text.Root>
                  <Progress.Root value={sum.paid} max={Math.max(billed, 1)} aria-label={copy.collectedShare} />
                </div>
              </div>
            </Card.Body>
          </Card.Root>

          <Card.Root className="preview-tall">
            <Card.Header>
              <Text.Root as="h3">{copy.upgrade}</Text.Root>
            </Card.Header>
            <Card.Body>
              <form
                className="preview-form"
                onSubmit={(event) => {
                  event.preventDefault();
                  toaster.add({ tone: 'success', title: copy.upgraded });
                }}
              >
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
                  <Text.Root as="span" id={ids.billing} weight="medium">
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

          <InvoiceTable
            className="preview-span-2"
            invoices={shown}
            kit={kit}
            actions={actions}
            more={actionLibrary.glyphs.ellipsis}
          />

          <AssistantCard className="preview-span-2" kit={kit} actionLibrary={actionLibrary} />

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
                    {billing.activity.slice(0, 4).map((entry, index) => (
                      <li key={`${billing.activity.length - index}`}>
                        <span>{copy.activityLine(entry)}</span>
                        <Badge.Root tone={entry.kind === 'paid' ? 'success' : entry.kind === 'archived' ? 'neutral' : 'info'}>
                          {copy.activityBadge[entry.kind]}
                        </Badge.Root>
                      </li>
                    ))}
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

          <Card.Root className="preview-span-2">
            <Card.Header>
              <Text.Root as="h3">{copy.invoiceSettings}</Text.Root>
            </Card.Header>
            <Card.Body>
              <div className="preview-tune">
                <ColorPicker.Root aria-label={copy.accent} value={accent} onValueChange={setAccent}>
                  <ColorPicker.Area />
                  <ColorPicker.Hue />
                </ColorPicker.Root>
                <div className="preview-stack">
                  <Field.Group>
                    <Label.Root htmlFor={ids.terms}>{copy.terms}</Label.Root>
                    <Field.Root id={ids.terms}>
                      <Field.Decrement />
                      <Field.NumberInput value={terms} onValueChange={setTerms} min={0} max={90} locale={locale} />
                      <Field.Increment />
                    </Field.Root>
                  </Field.Group>
                  <div className="preview-chip-list">
                    <ChipList.Root
                      aria-label={copy.tags}
                      chips={tags}
                      maxRows={1}
                      getTone={(value) => (value === copy.chips.urgent ? 'critical' : categoryTone(value))}
                      onRemove={(index) => setTags((current) => current.filter((_, at) => at !== index))}
                    />
                  </div>
                </div>
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

          <Card.Root className="preview-span-2">
            <Card.Header>
              <Text.Root as="h3">{copy.files}</Text.Root>
            </Card.Header>
            <Card.Body>
              <div className="preview-stack">
                <Splitter.Root className="preview-split" defaultValue={200} min={140} max={320}>
                  <Splitter.Panel>
                    <Tree.Root aria-label={copy.files} defaultExpanded={['exports']} value={file} onValueChange={setFile}>
                      <Tree.Item value="exports" disabled>
                        <Tree.Label>exports</Tree.Label>
                        <Tree.Group>
                          <Tree.Item value="exports/q3.csv">
                            <Tree.Label>{FILES['exports/q3.csv']}</Tree.Label>
                          </Tree.Item>
                          <Tree.Item value="exports/q2.csv">
                            <Tree.Label>{FILES['exports/q2.csv']}</Tree.Label>
                          </Tree.Item>
                        </Tree.Group>
                      </Tree.Item>
                      <Tree.Item value="contracts">
                        <Tree.Label>{FILES.contracts}</Tree.Label>
                      </Tree.Item>
                    </Tree.Root>
                  </Splitter.Panel>
                  <Splitter.Handle aria-label={copy.files} />
                  <Splitter.Panel>
                    <div className="preview-split-pane" role="region" aria-labelledby={ids.file}>
                      <Text.Root id={ids.file} weight="medium">
                        {isFile(file) ? FILES[file] : copy.fileDetails}
                      </Text.Root>
                      <Text.Root tone="muted">{isFile(file) ? copy.fileMeta[file] : ''}</Text.Root>
                    </div>
                  </Splitter.Panel>
                </Splitter.Root>
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

        <InvoiceDetail
          invoice={detail ? find(detail.id) : undefined}
          open={detail?.open ?? false}
          onOpenChange={(open) => setDetail((current) => (current ? { ...current, open } : null))}
          kit={kit}
          actions={actions}
        />
        <NewInvoice open={creating} onOpenChange={setCreating} kit={kit} customers={customers} terms={terms ?? 0} onCreate={create} />
        <Toast.Region toaster={toaster}>
          {(toast) => (
            <Toast.Root>
              <Toast.Title>{toast.title}</Toast.Title>
              {toast.description ? <Toast.Description>{toast.description}</Toast.Description> : null}
              {toast.onUndo ? (
                <Toast.Action
                  onClick={() => {
                    toast.onUndo?.();
                    toaster.dismiss(toast.id);
                  }}
                >
                  {copy.toasts.undo}
                </Toast.Action>
              ) : null}
              <Toast.Close />
            </Toast.Root>
          )}
        </Toast.Region>
      </div>
    </GlyphsProvider>
  );
}
