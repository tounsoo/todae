import { Link } from '@tounsoo/todae/link';

export default function LinkCurrent() {
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
