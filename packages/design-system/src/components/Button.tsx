import type { ButtonHTMLAttributes } from 'react';
import styles from './Button.module.css';

export type ButtonVariant = 'primary' | 'secondary';

export type ButtonProps = {
  variant?: ButtonVariant;
} & ButtonHTMLAttributes<HTMLButtonElement>;

export function Button({
  variant = 'primary',
  className,
  type = 'button',
  ...props
}: ButtonProps) {
  const classes = [styles.root, styles[variant], className].filter(Boolean).join(' ');
  return <button {...props} type={type} className={classes} />;
}
