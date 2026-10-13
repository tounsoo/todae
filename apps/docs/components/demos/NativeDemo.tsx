import { Code } from '@omsoo/todae/code';
import { Disclosure } from '@omsoo/todae/disclosure';
import { Kbd } from '@omsoo/todae/kbd';
import { Link } from '@omsoo/todae/link';
import { Separator } from '@omsoo/todae/separator';
import { Skeleton } from '@omsoo/todae/skeleton';
import { Spinner } from '@omsoo/todae/spinner';
import { Stack } from '@omsoo/todae/stack';
import { Table } from '@omsoo/todae/table';
import { Text } from '@omsoo/todae/text';
import { VisuallyHidden } from '@omsoo/todae/visually-hidden';
import { LocalizedLink } from '../LocalizedLink';

export function LinkInText() {
  return (
    <Text.Root>
      Read the <LocalizedLink href="/tokens">token reference</LocalizedLink> or the{' '}
      <LocalizedLink href="/platform">native platform notes</LocalizedLink> before you
      theme Todae.
    </Text.Root>
  );
}

export function LinkCurrent() {
  return (
    <nav aria-label="Settings" style={{ display: 'flex', gap: 'var(--todae-space-4)' }}>
      <Link.Root href="#profile">Profile</Link.Root>
      <Link.Root href="#billing" aria-current="page">
        Billing
      </Link.Root>
      <Link.Root href="#team">Team</Link.Root>
    </nav>
  );
}

export function DisclosureSingle() {
  return (
    <Disclosure.Root>
      <Disclosure.Summary>Shipping details</Disclosure.Summary>
      <Text.Root>Orders ship within two business days.</Text.Root>
    </Disclosure.Root>
  );
}

export function DisclosureAccordion() {
  return (
    <div>
      <Disclosure.Root name="faq" open>
        <Disclosure.Summary>What is Todae?</Disclosure.Summary>
        <Text.Root>A low-level base for a company design system.</Text.Root>
      </Disclosure.Root>
      <Disclosure.Root name="faq">
        <Disclosure.Summary>Does it ship icons?</Disclosure.Summary>
        <Text.Root>No. Pass your own icons as children, so your icon set stays yours.</Text.Root>
      </Disclosure.Root>
      <Disclosure.Root name="faq">
        <Disclosure.Summary>Which browsers?</Disclosure.Summary>
        <Text.Root>Any browser with the native features on the platform page.</Text.Root>
      </Disclosure.Root>
    </div>
  );
}

export function VisuallyHiddenLabel() {
  return (
    <Text.Root>
      3 <VisuallyHidden.Root>unread messages</VisuallyHidden.Root>
      <span aria-hidden="true"> ✉</span>
    </Text.Root>
  );
}

export function SeparatorBetween() {
  return (
    <div>
      <Text.Root>Account settings apply to every workspace.</Text.Root>
      <Separator.Root />
      <Text.Root>Workspace settings apply to this workspace only.</Text.Root>
    </div>
  );
}

export function TableOfInvoices() {
  return (
    <Table.Root>
      <Table.Caption>Invoices this quarter</Table.Caption>
      <Table.Head>
        <Table.Row>
          <Table.HeaderCell scope="col">Invoice</Table.HeaderCell>
          <Table.HeaderCell scope="col">Date</Table.HeaderCell>
          <Table.HeaderCell scope="col" style={{ textAlign: 'end' }}>
            Amount
          </Table.HeaderCell>
        </Table.Row>
      </Table.Head>
      <Table.Body>
        <Table.Row>
          <Table.HeaderCell scope="row">INV-1042</Table.HeaderCell>
          <Table.Cell>2026-07-03</Table.Cell>
          <Table.Cell style={{ textAlign: 'end' }}>$1,200.00</Table.Cell>
        </Table.Row>
        <Table.Row>
          <Table.HeaderCell scope="row">INV-1043</Table.HeaderCell>
          <Table.Cell>2026-08-01</Table.Cell>
          <Table.Cell style={{ textAlign: 'end' }}>$980.00</Table.Cell>
        </Table.Row>
        <Table.Row>
          <Table.HeaderCell scope="row">INV-1044</Table.HeaderCell>
          <Table.Cell>2026-09-02</Table.Cell>
          <Table.Cell style={{ textAlign: 'end' }}>$1,450.00</Table.Cell>
        </Table.Row>
      </Table.Body>
    </Table.Root>
  );
}

export function SpinnerLabelled() {
  return (
    <Stack.Root direction="row">
      <label>
        <Spinner.Root /> Loading invoices
      </label>
      <Spinner.Root aria-label="Saving" />
    </Stack.Root>
  );
}

export function SkeletonProfile() {
  return (
    <div>
      <VisuallyHidden.Root>Loading profile</VisuallyHidden.Root>
      <Stack.Root direction="row" aria-hidden="true">
        <Skeleton.Root style={{ inlineSize: '2.5rem', blockSize: '2.5rem', borderRadius: '50%' }} />
        <Stack.Root style={{ flex: 1 }}>
          <Skeleton.Root style={{ inlineSize: '40%' }} />
          <Skeleton.Root style={{ inlineSize: '70%' }} />
        </Stack.Root>
      </Stack.Root>
    </div>
  );
}

export function CodeInText() {
  return (
    <div>
      <Text.Root>
        Call <Code.Root>getPlan()</Code.Root> before you render the billing page.
      </Text.Root>
      <Code.Block tabIndex={0} role="region" aria-label="Example code">
        <code>{`const plan = await getPlan();\nrender(<Billing plan={plan} />);`}</code>
      </Code.Block>
    </div>
  );
}

export function KbdShortcut() {
  return (
    <Text.Root>
      Press{' '}
      <Kbd.Root>
        <Kbd.Root>Ctrl</Kbd.Root>+<Kbd.Root>K</Kbd.Root>
      </Kbd.Root>{' '}
      to search, or <Kbd.Root>Esc</Kbd.Root> to close.
    </Text.Root>
  );
}
