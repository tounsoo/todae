'use client';

import { Disclosure } from '@tounsoo/todae/disclosure';
import { Text } from '@tounsoo/todae/text';

export default function DisclosureAccordion() {
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
