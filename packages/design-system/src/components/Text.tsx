import type { HTMLAttributes } from 'react';
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
} & HTMLAttributes<HTMLElement>;

export function Text({
  as: Tag = 'p',
  size = 'm',
  tone = 'default',
  weight = 'regular',
  className,
  ...props
}: TextProps) {
  const classes = [styles.root, styles[size], styles[tone], styles[weight], className]
    .filter(Boolean)
    .join(' ');
  return <Tag {...props} className={classes} />;
}
