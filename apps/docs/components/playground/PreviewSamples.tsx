'use client';

import {
  Button,
  Calendar,
  Card,
  categoryTone,
  ChipList,
  ColorPicker,
  createToaster,
  defineMentionSource,
  Dialog,
  Field,
  Label,
  Mention,
  Message,
  Popover,
  Splitter,
  Stack,
  Steps,
  Text,
  Toast,
  Tooltip,
  usePopover,
  useTooltip,
} from '@tounsoo/todae';
import { useId, useMemo, useState } from 'react';
import type { Locale } from '../../lib/i18n/config';
import type { PreviewCopy } from './previewCopy';

type SamplesCopy = PreviewCopy['samples'];

const BILLING_MONTH = '2026-10-14';

function WarmTip({ label, tip, skipDelay }: { label: string; tip: string; skipDelay?: number }) {
  const tooltip = useTooltip({ showDelay: 300, hideDelay: 0, skipDelay });
  return (
    <>
      <Button.Root variant="secondary" tooltip={false} {...tooltip.getTriggerProps()}>
        {label}
      </Button.Root>
      <Tooltip.Root {...tooltip.getTooltipProps()}>{tip}</Tooltip.Root>
    </>
  );
}

/**
 * The parts the rest of the preview never paints, so a token edit on them has
 * somewhere to show. Dialog, popover and toast stay closed until their button.
 */
export function PreviewSamples({
  copy,
  chips,
  locale,
}: {
  copy: SamplesCopy;
  chips: PreviewCopy['chips'];
  locale: Locale;
}) {
  const ids = { quantity: useId(), sidebar: useId() };
  const [dialogOpen, setDialogOpen] = useState(false);
  const [noteOpen, setNoteOpen] = useState(false);
  const [toaster] = useState(() => createToaster());
  const [month, setMonth] = useState<Temporal.PlainDate | null>(() => Temporal.PlainDate.from(BILLING_MONTH));
  const [color, setColor] = useState('#3366ff');
  const [seats, setSeats] = useState<number | null>(12);
  const [tags, setTags] = useState(() => [chips.design, chips.billing, chips.urgent, copy.tagLong]);
  const note = usePopover({ open: noteOpen, onOpenChange: setNoteOpen });
  const people = useMemo(
    () =>
      defineMentionSource<{ name: string; role: string }>({
        char: '@',
        label: copy.people,
        options: [{ value: 'mina', label: copy.mentionName }],
        resolve: () => ({ name: copy.mentionName, role: copy.mentionRole }),
        renderPeek: (person) => (
          <Stack.Root gap="condensed">
            <Text.Root weight="bold">{person.name}</Text.Root>
            <Text.Root tone="muted">{person.role}</Text.Root>
          </Stack.Root>
        ),
      }),
    [copy],
  );

  return (
    <>
      <Card.Root className="preview-span-2">
        <Card.Header>
          <Text.Root as="h3">{copy.plan}</Text.Root>
        </Card.Header>
        <Card.Body>
          <div className="preview-stack">
            <Steps.Root variant="progress" aria-label={copy.steps}>
              <Steps.Item status="done">{copy.stepReview}</Steps.Item>
              <Steps.Item status="current">{copy.stepPay}</Steps.Item>
              <Steps.Item>{copy.stepDone}</Steps.Item>
            </Steps.Root>
            <div className="preview-actions" role="group" aria-label={copy.tips}>
              <WarmTip label={copy.tipOne} tip={copy.tipOneBody} />
              <WarmTip label={copy.tipTwo} tip={copy.tipTwoBody} />
              <WarmTip label={copy.tipThree} tip={copy.tipThreeBody} />
              <WarmTip label={copy.tipWaits} tip={copy.tipWaitsBody} skipDelay={0} />
            </div>
            <div className="preview-actions">
              <Button.Root variant="secondary" tooltip={false} {...note.getTriggerProps()}>
                {copy.openPopover}
              </Button.Root>
              <Popover.Root {...note.getPopoverProps()} role="dialog" aria-label={copy.noteTitle}>
                <Text.Root>{copy.popoverBody}</Text.Root>
              </Popover.Root>
              <Button.Root variant="secondary" onClick={() => setDialogOpen(true)}>
                {copy.openDialog}
              </Button.Root>
              <Button.Root variant="secondary" onClick={() => toaster.add({ title: copy.toastTitle, description: copy.toastBody })}>
                {copy.showToast}
              </Button.Root>
            </div>
            <Message.Root aria-label={copy.mentionMessage}>
              <Message.Content>
                {copy.mentionLead}<Mention.Root id="mina" source={people}>{copy.mentionName}</Mention.Root>{copy.mentionTail}
              </Message.Content>
            </Message.Root>
          </div>
          <Dialog.Root open={dialogOpen} onOpenChange={setDialogOpen}>
            <Dialog.Header>
              <Dialog.Title>{copy.dialogTitle}</Dialog.Title>
              <Dialog.Close />
            </Dialog.Header>
            <Dialog.Description>{copy.dialogBody}</Dialog.Description>
          </Dialog.Root>
          <Toast.Region toaster={toaster}>
            {(toast) => (
              <Toast.Root>
                <Toast.Title>{toast.title}</Toast.Title>
                {toast.description ? <Toast.Description>{toast.description}</Toast.Description> : null}
                <Toast.Close />
              </Toast.Root>
            )}
          </Toast.Region>
        </Card.Body>
      </Card.Root>

      <Card.Root>
        <Card.Header>
          <Text.Root as="h3">{copy.calendar}</Text.Root>
        </Card.Header>
        <Card.Body>
          <Calendar.Root aria-label={copy.calendar} locale={locale} value={month} onValueChange={setMonth}>
            <Calendar.Header />
            <Calendar.Grid />
          </Calendar.Root>
        </Card.Body>
      </Card.Root>

      <Card.Root className="preview-span-2">
        <Card.Header>
          <Text.Root as="h3">{copy.tune}</Text.Root>
        </Card.Header>
        <Card.Body>
          <div className="preview-tune">
            <ColorPicker.Root aria-label={copy.color} value={color} onValueChange={setColor}>
              <ColorPicker.Area />
              <ColorPicker.Hue />
            </ColorPicker.Root>
            <div className="preview-stack">
              <Field.Group>
                <Label.Root htmlFor={ids.quantity}>{copy.quantity}</Label.Root>
                <Field.Root id={ids.quantity}>
                  <Field.Decrement />
                  <Field.NumberInput value={seats} onValueChange={setSeats} min={1} max={99} locale={locale} />
                  <Field.Increment />
                </Field.Root>
              </Field.Group>
              <div className="preview-chip-list">
                <ChipList.Root
                  aria-label={copy.tags}
                  chips={tags}
                  maxRows={1}
                  getTone={(value) => (value === chips.urgent ? 'critical' : categoryTone(value))}
                  onRemove={(index) => setTags((current) => current.filter((_, at) => at !== index))}
                />
              </div>
            </div>
          </div>
        </Card.Body>
      </Card.Root>

      <Card.Root>
        <Card.Header>
          <Text.Root as="h3">{copy.layout}</Text.Root>
        </Card.Header>
        <Card.Body>
          <Splitter.Root className="preview-split" defaultValue={148} min={96} max={240}>
            <Splitter.Panel>
              <Text.Root id={ids.sidebar} className="preview-split-pane">
                {copy.sidebar}
              </Text.Root>
            </Splitter.Panel>
            <Splitter.Handle aria-labelledby={ids.sidebar} />
            <Splitter.Panel>
              <Text.Root className="preview-split-pane">{copy.main}</Text.Root>
            </Splitter.Panel>
          </Splitter.Root>
        </Card.Body>
      </Card.Root>
    </>
  );
}
