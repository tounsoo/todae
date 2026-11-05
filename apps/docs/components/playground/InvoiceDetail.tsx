'use client';

import {
  Alert,
  Attachment,
  Badge,
  BottomSheet,
  Button,
  DataList,
  Drawer,
  Steps,
  useSheetPresentation,
  type StepsStatus,
} from '@tounsoo/todae';
import { useEffect, useRef } from 'react';
import type { Invoice } from './billing';
import { daysLate, STATUS_TONE, type InvoiceActions, type Kit } from './kit';

/** Where the invoice is on its way from draft to paid, as three steps. */
function progress(status: Invoice['status']): readonly [StepsStatus, StepsStatus, StepsStatus] {
  switch (status) {
    case 'draft':
      return ['done', 'current', 'pending'];
    case 'due':
      return ['done', 'done', 'current'];
    case 'overdue':
      return ['done', 'done', 'error'];
    case 'paid':
      return ['done', 'done', 'done'];
  }
}

function DetailBody({ invoice, kit }: { invoice: Invoice; kit: Kit }) {
  const { copy } = kit;
  const steps = progress(invoice.status);
  return (
    <div className="preview-stack">
      {invoice.status === 'overdue' ? (
        <Alert.Root tone="critical" role="none">
          <Alert.Title>{copy.detail.overdue}</Alert.Title>
          <Alert.Description>{copy.detail.overdueBody(daysLate(invoice))}</Alert.Description>
        </Alert.Root>
      ) : null}
      <Steps.Root variant="progress" aria-label={copy.detail.steps}>
        <Steps.Item status={steps[0]}>{copy.detail.created}</Steps.Item>
        <Steps.Item status={steps[1]}>{copy.detail.sent}</Steps.Item>
        <Steps.Item status={steps[2]}>{copy.detail.paid}</Steps.Item>
      </Steps.Root>
      <DataList.Root orientation="vertical" aria-label={invoice.id}>
        <DataList.Item>
          <DataList.Term>{copy.customer}</DataList.Term>
          <DataList.Details>{invoice.customer}</DataList.Details>
        </DataList.Item>
        <DataList.Item>
          <DataList.Term>{copy.amount}</DataList.Term>
          <DataList.Details>{kit.money(invoice.amount)}</DataList.Details>
        </DataList.Item>
        <DataList.Item>
          <DataList.Term>{copy.due}</DataList.Term>
          <DataList.Details>{kit.date(invoice.due)}</DataList.Details>
        </DataList.Item>
        <DataList.Item>
          <DataList.Term>{copy.status}</DataList.Term>
          <DataList.Details>
            <Badge.Root tone={STATUS_TONE[invoice.status]}>{copy.statuses[invoice.status]}</Badge.Root>
          </DataList.Details>
        </DataList.Item>
        <DataList.Item>
          <DataList.Term>{copy.detail.folder}</DataList.Term>
          <DataList.Details>{invoice.folder ? copy.folders[invoice.folder] : copy.detail.inbox}</DataList.Details>
        </DataList.Item>
      </DataList.Root>
      <Attachment.Root>
        <Attachment.Name>{`${invoice.id}.pdf`}</Attachment.Name>
        <Attachment.Meta>84 KB</Attachment.Meta>
      </Attachment.Root>
    </div>
  );
}

/** What can happen next to the invoice: send a draft, or chase or settle one that is owed. */
function DetailActions({ invoice, kit, actions }: { invoice: Invoice; kit: Kit; actions: InvoiceActions }) {
  const { row } = kit.copy;
  if (invoice.status === 'draft') return <Button.Root onClick={() => actions.send(invoice.id)}>{row.send}</Button.Root>;
  return (
    <>
      <Button.Root variant="secondary" onClick={() => actions.remind(invoice.id)}>
        {row.remind}
      </Button.Root>
      <Button.Root onClick={() => actions.markPaid(invoice.id)}>{row.markPaid}</Button.Root>
    </>
  );
}

/**
 * One invoice's details: a drawer at the end on a wide screen, a bottom sheet
 * on a phone. The invoice shown stays while the panel closes.
 */
export function InvoiceDetail({
  invoice,
  open,
  onOpenChange,
  kit,
  actions,
}: {
  invoice: Invoice | undefined;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  kit: Kit;
  actions: InvoiceActions;
}) {
  const { isSheet } = useSheetPresentation();
  const shown = open && invoice !== undefined;
  const closeRef = useRef<HTMLButtonElement>(null);
  const status = invoice?.status;
  // Mark paid takes the footer, and the focused button in it, away. Focus that
  // went with it moves to Close, so it stays in the open panel.
  useEffect(() => {
    if (!shown) return;
    const frame = requestAnimationFrame(() => {
      const active = document.activeElement;
      if (!active || active === document.body) closeRef.current?.focus();
    });
    return () => cancelAnimationFrame(frame);
  }, [shown, status]);
  const title = invoice ? `${invoice.id}, ${invoice.customer}` : '';

  if (isSheet) {
    return (
      <BottomSheet.Root open={shown} onOpenChange={(next) => onOpenChange(next)}>
        <BottomSheet.Grabber />
        <BottomSheet.Header>
          <BottomSheet.Title>{title}</BottomSheet.Title>
          <BottomSheet.Close ref={closeRef} />
        </BottomSheet.Header>
        {invoice ? (
          <>
            <BottomSheet.Body>
              <DetailBody invoice={invoice} kit={kit} />
            </BottomSheet.Body>
            {invoice.status === 'paid' ? null : (
              <BottomSheet.Footer>
                <DetailActions invoice={invoice} kit={kit} actions={actions} />
              </BottomSheet.Footer>
            )}
          </>
        ) : null}
      </BottomSheet.Root>
    );
  }

  return (
    <Drawer.Root open={shown} onOpenChange={(next) => onOpenChange(next)}>
      <Drawer.Header>
        <Drawer.Title>{title}</Drawer.Title>
        <Drawer.Close ref={closeRef} />
      </Drawer.Header>
      {invoice ? (
        <>
          <Drawer.Body>
            <DetailBody invoice={invoice} kit={kit} />
          </Drawer.Body>
          {invoice.status === 'paid' ? null : (
            <Drawer.Footer>
              <DetailActions invoice={invoice} kit={kit} actions={actions} />
            </Drawer.Footer>
          )}
        </>
      ) : null}
    </Drawer.Root>
  );
}
