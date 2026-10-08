import { type ComponentPropsWithRef, type ReactNode } from 'react';
import { Button, type ButtonRootProps } from './Button';
import { useDismissLabel } from './dismissLabel';
import { cx } from './props';
import styles from './Alert.module.css';

export type AlertTone = 'info' | 'success' | 'warning' | 'critical';

/**
 * `role` defaults by tone: `status` for info and success, `alert` for warning
 * and critical. Pass `role` to change it, such as `role="none"` for a banner
 * that is part of the page from the start and should not be announced.
 */
export type AlertRootProps = {
  tone?: AlertTone;
  children?: ReactNode;
} & ComponentPropsWithRef<'div'>;

export type AlertIconProps = ComponentPropsWithRef<'span'>;
export type AlertTitleProps = ComponentPropsWithRef<'p'>;
export type AlertDescriptionProps = ComponentPropsWithRef<'div'>;
export type AlertActionsProps = ComponentPropsWithRef<'div'>;
export type AlertCloseProps = ButtonRootProps;

const ASSERTIVE: ReadonlySet<AlertTone> = new Set(['warning', 'critical']);

function Root({ tone = 'info', role, className, ...props }: AlertRootProps) {
  return (
    <div
      {...props}
      role={role ?? (ASSERTIVE.has(tone) ? 'alert' : 'status')}
      data-tone={tone}
      className={cx(styles.root, className)}
    />
  );
}

/** A slot for any icon. Hidden from assistive technology unless it says otherwise. */
function Icon({ className, ...props }: AlertIconProps) {
  return <span aria-hidden {...props} className={cx(styles.icon, className)} />;
}

function Title({ className, ...props }: AlertTitleProps) {
  return <p {...props} className={cx(styles.title, className)} />;
}

function Description({ className, ...props }: AlertDescriptionProps) {
  return <div {...props} className={cx(styles.description, className)} />;
}

function Actions({ className, ...props }: AlertActionsProps) {
  return <div {...props} className={cx(styles.actions, className)} />;
}

/**
 * A ghost Button.Root. The alert has no open state: remove it in `onClick`.
 * Named "Dismiss" unless its own text names it, so a visible label stays its name.
 */
function Close({ 'aria-label': ariaLabel, className, children, ref, ...props }: AlertCloseProps) {
  const [label, refs] = useDismissLabel(children, ariaLabel, ref);
  return (
    <Button.Root variant="ghost" aria-label={label} {...props} ref={refs} className={cx(styles.close, className)}>
      {children}
    </Button.Root>
  );
}

export const Alert = { Root, Icon, Title, Description, Actions, Close } as const;
