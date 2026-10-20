'use client';

import { Button, type ButtonRenderedProps } from '@tounsoo/todae';
import type { ReactNode } from 'react';
import { renderSiteLink } from './SiteLink';

type SiteButtonLinkProps = Omit<ButtonRenderedProps, 'render'> & {
  href: string;
  /** Shown after the label in a Button.Icon, which a Server Component can't render itself. */
  trailingIcon?: ReactNode;
};

/** A link drawn as a Button.Root, moving within the site through next/link as SiteLink does. */
export function SiteButtonLink({ href, trailingIcon, children, ...props }: SiteButtonLinkProps) {
  return (
    <Button.Root {...props} render={(link) => renderSiteLink({ ...link, href })}>
      {children}
      {trailingIcon ? <Button.Icon>{trailingIcon}</Button.Icon> : null}
    </Button.Root>
  );
}
