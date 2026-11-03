import { Text } from '@tounsoo/todae/text';

export default function TextTones() {
  return (
    <>
      <Text.Root tone="muted">Muted body</Text.Root>
      <Text.Root>Medium default</Text.Root>
      <Text.Root tone="accent" weight="bold">
        Accent, bold
      </Text.Root>
    </>
  );
}
