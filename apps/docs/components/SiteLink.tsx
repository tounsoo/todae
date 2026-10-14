import { Link, type LinkRenderProps, type LinkRootProps } from '@omsoo.design/todae/link';
import NextLink from 'next/link';

/** Link.Root that moves within the site through next/link, so a same-site link keeps the page loaded and prefetches. */
export function SiteLink(props: Omit<LinkRootProps, 'render'>) {
  return <Link.Root {...props} render={renderSiteLink} />;
}

/** Renders next/link for a same-site path. next/link needs an href, so a link without one, or to another site or an anchor, stays a plain <a>. */
export function renderSiteLink({ href, ...props }: LinkRenderProps) {
  return href?.startsWith('/') && !href.startsWith('//') ? <NextLink href={href} {...props} /> : <a href={href} {...props} />;
}
