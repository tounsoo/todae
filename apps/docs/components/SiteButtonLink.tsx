'use client';

import { Button, type ButtonRenderedProps } from '@tounsoo/todae';
import { renderSiteLink } from './SiteLink';

/** A link drawn as a Button.Root, moving within the site through next/link as SiteLink does. */
export function SiteButtonLink({ href, ...props }: Omit<ButtonRenderedProps, 'render'> & { href: string }) {
  return <Button.Root {...props} render={(link) => renderSiteLink({ ...link, href })} />;
}
