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
