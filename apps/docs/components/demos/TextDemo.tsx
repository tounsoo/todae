import { Text } from '@tounsoo/todae/text';

export function TextHeadings() {
  return (
    <>
      <Text as="h1">Heading 1</Text>
      <Text as="h2">Heading 2</Text>
      <Text as="h3">Heading 3</Text>
      <Text as="h4">Heading 4</Text>
      <Text as="h5">Heading 5</Text>
      <Text as="h6">Heading 6</Text>
    </>
  );
}

export function TextHeadingSize() {
  return (
    <>
      <Text as="h2" size="m" tone="muted" weight="medium">
        A level 2 heading set small
      </Text>
      <Text>The outline says h2; the size says it is a quiet section label.</Text>
    </>
  );
}
