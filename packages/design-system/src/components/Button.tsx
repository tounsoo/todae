import type { ButtonHTMLAttributes, HTMLAttributes, ReactNode } from 'react';
import styles from './Button.module.css';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost';

export type ButtonRootProps = {
  variant?: ButtonVariant;
} & ButtonHTMLAttributes<HTMLButtonElement>;

export type ButtonIconProps = {
  children?: ReactNode;
  className?: string;
};

export type ButtonGroupProps = {
  'aria-label'?: string;
  'aria-labelledby'?: string;
  className?: string;
  children?: ReactNode;
} & Omit<HTMLAttributes<HTMLDivElement>, 'role'>;

function Root({
  variant = 'primary',
  className,
  type = 'button',
  ...props
}: ButtonRootProps) {
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

function Icon({ children, className }: ButtonIconProps) {
  return (
    <span className={[styles.icon, className].filter(Boolean).join(' ')} aria-hidden>
      {children}
    </span>
  );
}

export function ButtonGroup({ className, children, ...props }: ButtonGroupProps) {
  return (
    <div {...props} role="group" className={[styles.group, className].filter(Boolean).join(' ')}>
      {children}
    </div>
  );
}

export const Button = { Root, Icon } as const;
