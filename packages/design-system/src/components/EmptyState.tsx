import type { ComponentPropsWithRef } from 'react';
import { cx } from './cx.js';
import styles from './EmptyState.module.css';

/** The element a title renders: a heading level that fits the page, or `p` for a title that should stay out of the outline. */
export type EmptyStateTitleElement = 'h2' | 'h3' | 'h4' | 'h5' | 'h6' | 'p';

/**
 * What a list, table or search shows when it has nothing. A `div` with no role,
 * so it is not announced when it appears: announce it from your own code when
 * a user action caused it.
 */
export type EmptyStateRootProps = ComponentPropsWithRef<'div'>;
export type EmptyStateIconProps = ComponentPropsWithRef<'span'>;
export type EmptyStateTitleProps = { as?: EmptyStateTitleElement } & ComponentPropsWithRef<'h2'>;
export type EmptyStateDescriptionProps = ComponentPropsWithRef<'div'>;
export type EmptyStateActionsProps = ComponentPropsWithRef<'div'>;

function Root({ className, ...props }: EmptyStateRootProps) {
  return <div {...props} className={cx(styles.root, className)} />;
}

/** A slot for any icon. Hidden from assistive technology unless it says otherwise. */
function Icon({ className, ...props }: EmptyStateIconProps) {
  return <span aria-hidden {...props} className={cx(styles.icon, className)} />;
}

/** The empty state's heading, at the level `as` names. An `h2` by default. */
function Title({ as: Tag = 'h2', className, ...props }: EmptyStateTitleProps) {
  return <Tag {...props} className={cx(styles.title, className)} />;
}

/** Muted text under the title, kept to a readable width. A `div`, so it can hold more than one paragraph or a link. */
function Description({ className, ...props }: EmptyStateDescriptionProps) {
  return <div {...props} className={cx(styles.description, className)} />;
}

/** A centered row of buttons or links that wraps. */
function Actions({ className, ...props }: EmptyStateActionsProps) {
  return <div {...props} className={cx(styles.actions, className)} />;
}

export const EmptyState = { Root, Icon, Title, Description, Actions } as const;
