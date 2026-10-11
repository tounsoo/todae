import type { ComponentPropsWithRef } from 'react';
import { cx } from './cx';
import styles from './Prose.module.css';

/** A `div` that styles the headings, paragraphs, lists and block quotes of rendered markdown or MDX inside it. */
export type ProseRootProps = ComponentPropsWithRef<'div'>;

function Root({ className, ...props }: ProseRootProps) {
  return <div {...props} className={cx(styles.root, className)} />;
}

export const Prose = { Root } as const;
