'use client';

import { Text } from '@tounsoo/todae/text';

export default function TextHeadings() {
  return (
    <>
      <Text.Root as="h1">Heading 1</Text.Root>
      <Text.Root as="h2">Heading 2</Text.Root>
      <Text.Root as="h3">Heading 3</Text.Root>
      <Text.Root as="h4">Heading 4</Text.Root>
      <Text.Root as="h5">Heading 5</Text.Root>
      <Text.Root as="h6">Heading 6</Text.Root>
    </>
  );
}
