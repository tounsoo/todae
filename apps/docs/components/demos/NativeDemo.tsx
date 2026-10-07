import { Text } from '@tounsoo/todae/text';
import { LocalizedLink } from '../LocalizedLink';

export function LinkInText() {
  return (
    <Text>
      Read the <LocalizedLink href="/tokens">token reference</LocalizedLink> or the{' '}
      <LocalizedLink href="/platform">native platform notes</LocalizedLink> before you
      theme Todae.
    </Text>
  );
}

export function DisclosureSingle() {
  return (
    <details>
      <summary>Shipping details</summary>
      <Text>Orders ship within two business days.</Text>
    </details>
  );
}

export function DisclosureAccordion() {
  return (
    <div>
      <details name="faq" open>
        <summary>What is Todae?</summary>
        <Text>A low-level base for a company design system.</Text>
      </details>
      <details name="faq">
        <summary>Does it ship icons?</summary>
        <Text>No. Pass your own icons as children, so your icon set stays yours.</Text>
      </details>
      <details name="faq">
        <summary>Which browsers?</summary>
        <Text>Any browser with the native features on the platform page.</Text>
      </details>
    </div>
  );
}

export function VisuallyHiddenLabel() {
  return (
    <Text>
      3 <span className="todae-visually-hidden">unread messages</span>
      <span aria-hidden="true"> ✉</span>
    </Text>
  );
}

export function SeparatorBetween() {
  return (
    <div>
      <Text>Account settings apply to every workspace.</Text>
      <hr />
      <Text>Workspace settings apply to this workspace only.</Text>
    </div>
  );
}

export function TableOfInvoices() {
  return (
    <table>
      <caption>Invoices this quarter</caption>
      <thead>
        <tr>
          <th scope="col">Invoice</th>
          <th scope="col">Date</th>
          <th scope="col" style={{ textAlign: 'end' }}>
            Amount
          </th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td>INV-1042</td>
          <td>2026-07-03</td>
          <td style={{ textAlign: 'end' }}>$1,200.00</td>
        </tr>
        <tr>
          <td>INV-1043</td>
          <td>2026-08-01</td>
          <td style={{ textAlign: 'end' }}>$980.00</td>
        </tr>
        <tr>
          <td>INV-1044</td>
          <td>2026-09-02</td>
          <td style={{ textAlign: 'end' }}>$1,450.00</td>
        </tr>
      </tbody>
    </table>
  );
}
