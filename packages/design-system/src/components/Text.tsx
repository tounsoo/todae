import type { HTMLAttributes, Ref } from 'react';
import styles from './Text.module.css';

export type TextAs = 'p' | 'span' | 'strong';
export type TextSize = 's' | 'm' | 'l';
export type TextTone = 'default' | 'muted' | 'accent';
export type TextWeight = 'regular' | 'medium' | 'bold';

export type TextProps = {
  as?: TextAs;
  size?: TextSize;
  tone?: TextTone;
  weight?: TextWeight;
  ref?: Ref<HTMLElement>;
} & HTMLAttributes<HTMLElement>;

export function Text({
  as: Tag = 'p',
  size = 'm',
  tone = 'default',
  weight = 'regular',
  className,
  ref,
  ...props
}: TextProps) {
  const classes = [styles.root, styles[size], styles[tone], styles[weight], className]
    .filter(Boolean)
    .join(' ');
  // Each tag's element type extends HTMLElement; the ref is typed to the common base.
  return <Tag {...props} ref={ref as Ref<HTMLParagraphElement>} className={classes} />;
}
