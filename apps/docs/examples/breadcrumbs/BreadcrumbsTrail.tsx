'use client';

import { Breadcrumbs } from '@tounsoo/todae/breadcrumbs';
import { Link } from '@tounsoo/todae/link';

export default function BreadcrumbsTrail() {
  return (
    <Breadcrumbs.Root>
      <Breadcrumbs.Item>
        <Link.Root href="#home">Home</Link.Root>
      </Breadcrumbs.Item>
      <Breadcrumbs.Item>
        <Link.Root href="#settings">Settings</Link.Root>
      </Breadcrumbs.Item>
      <Breadcrumbs.Item current>Billing</Breadcrumbs.Item>
    </Breadcrumbs.Root>
  );
}
