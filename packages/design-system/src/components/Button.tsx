import type { ButtonHTMLAttributes } from 'react';
import styles from './Button.module.css';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost';

export type ButtonProps = {
  variant?: ButtonVariant;
} & ButtonHTMLAttributes<HTMLButtonElement>;

export function Button({
  variant = 'primary',
  className,
  type = 'button',
  ...props
}: ButtonProps) {
  const classes = [styles.root, className].filter(Boolean).join(' ');
  return (
    <button
      {...props}
      type={type}
      className={classes}
      data-button-variant={variant === 'primary' ? undefined : variant}
    />
  );
}
