'use client';

import { Text, useSheetPresentation } from '@tounsoo/todae';

export default function PresentationBadge() {
  const sheet = useSheetPresentation();
  return (
    <Text.Root>
      {sheet.presentation} · isSheet={String(sheet.isSheet)}
    </Text.Root>
  );
}
