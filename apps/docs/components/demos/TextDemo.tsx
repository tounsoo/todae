import { Text } from '@omsoo/todae/text';

export function TextHeadings() {
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

export function TextHeadingSize() {
  return (
    <>
      <Text.Root as="h2" size="m" tone="muted" weight="medium">
        A level 2 heading set small
      </Text.Root>
      <Text.Root>The outline says h2; the size says it is a quiet section label.</Text.Root>
    </>
  );
}
