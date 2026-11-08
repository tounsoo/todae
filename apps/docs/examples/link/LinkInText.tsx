import { Link } from '@tounsoo/todae/link';
import { Text } from '@tounsoo/todae/text';

export default function LinkInText() {
  return (
    <Text.Root>
      Read the <Link.Root href="#tokens">token reference</Link.Root> or the{' '}
      <Link.Root href="#platform">native platform notes</Link.Root> before you theme Todae.
    </Text.Root>
  );
}
