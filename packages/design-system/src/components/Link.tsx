import type { ComponentPropsWithRef, ReactElement } from 'react';
import { cx } from './cx';
import styles from './Link.module.css';

export type LinkRenderProps = ComponentPropsWithRef<'a'>;

/**
 * A link styled from the link tokens. It renders an `a`, or whatever `render`
 * returns, such as a router's link, with the props it would have put on the `a`.
 */
export type LinkRootProps = {
  render?: (props: LinkRenderProps) => ReactElement;
} & ComponentPropsWithRef<'a'>;

function Root({ render, className, ...props }: LinkRootProps) {
  const own = { ...props, className: cx(styles.root, className) };
  return render ? render(own) : <a {...own} />;
}

export const Link = { Root } as const;
