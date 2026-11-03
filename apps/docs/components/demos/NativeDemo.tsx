
import { Link } from '@tounsoo/todae/link';
import { Text } from '@tounsoo/todae/text';
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
