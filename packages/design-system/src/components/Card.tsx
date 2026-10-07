import type { ComponentPropsWithRef } from 'react';
import { cx } from './props';
import styles from './Card.module.css';

/**
 * A bordered surface that groups related content. It is a `div` with no role: pass
 * native attributes, such as `role="region"` and a name for a card that is a
 * landmark. A card is not a button or a link; put the
 * actions inside it.
 */
export type CardRootProps = ComponentPropsWithRef<'div'>;
export type CardHeaderProps = ComponentPropsWithRef<'div'>;
export type CardBodyProps = ComponentPropsWithRef<'div'>;
export type CardFooterProps = ComponentPropsWithRef<'div'>;

function Root({ className, ...props }: CardRootProps) {
  return <div {...props} className={cx(styles.root, className)} />;
}

function Header({ className, ...props }: CardHeaderProps) {
  return <div {...props} className={cx(styles.header, className)} />;
}

function Body({ className, ...props }: CardBodyProps) {
  return <div {...props} className={className} />;
}

function Footer({ className, ...props }: CardFooterProps) {
  return <div {...props} className={cx(styles.footer, className)} />;
}

export const Card = { Root, Header, Body, Footer } as const;
