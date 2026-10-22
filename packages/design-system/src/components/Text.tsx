import type { HTMLAttributes, Ref } from 'react';
import { cx } from './cx.js';
import styles from './Text.module.css';

export type TextHeading = 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6';
export type TextAs = 'p' | 'span' | 'strong' | TextHeading;
export type TextSize = 's' | 'm' | 'l' | 'xl' | '2xl' | 'label';
export type TextTone = 'default' | 'muted' | 'accent';
export type TextWeight = 'regular' | 'medium' | 'bold';

export type TextRootProps = {
  as?: TextAs;
  size?: TextSize;
  tone?: TextTone;
  weight?: TextWeight;
  ref?: Ref<HTMLElement>;
} & HTMLAttributes<HTMLElement>;

/** The size a heading takes when none is given. Pick the level for the outline and `size` for the look. */
const HEADING_SIZE: Record<TextHeading, TextSize> = {
  h1: '2xl',
  h2: 'xl',
  h3: 'l',
  h4: 'm',
  h5: 'm',
  h6: 's',
};

// A class name can't start with a digit.
const SIZE_CLASS: Record<TextSize, string> = { s: 's', m: 'm', l: 'l', xl: 'xl', '2xl': 'xxl', label: 'label' };

function isHeading(tag: TextAs): tag is TextHeading {
  return Object.hasOwn(HEADING_SIZE, tag);
}

function Root({ as: Tag = 'p', size, tone, weight, className, ref, ...props }: TextRootProps) {
  const heading = isHeading(Tag);
  const classes = cx(
    styles.root,
    heading && styles.heading,
    styles[SIZE_CLASS[size ?? (heading ? HEADING_SIZE[Tag] : 'm')]],
    tone && styles[tone],
    weight && styles[weight],
    className,
  );
  // Each tag's element type extends HTMLElement; the ref is typed to the common base.
  return <Tag {...props} ref={ref as Ref<HTMLParagraphElement>} className={classes} />;
}

export const Text = { Root } as const;
