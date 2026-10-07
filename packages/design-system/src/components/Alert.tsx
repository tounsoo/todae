import { isValidElement, useLayoutEffect, useRef, useState, type ComponentPropsWithRef, type ReactNode } from 'react';
import { Button, type ButtonRootProps } from './Button';
import { cx, useComposedRefs } from './props';
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
 * Two or more letters or digits name the button, such as "Got it" or "닫기";
 * a symbol such as × or a lone "x" glyph does not.
 */
function isWorded(text: string): boolean {
  return (text.match(/[\p{L}\p{N}]/gu) ?? []).length >= 2;
}

function hasWords(children: ReactNode): boolean {
  if (typeof children === 'string' || typeof children === 'number') return isWorded(String(children));
  if (Array.isArray(children)) return children.some(hasWords);
  if (isValidElement<{ children?: ReactNode; 'aria-hidden'?: unknown }>(children)) {
    const hidden = children.props['aria-hidden'];
    return hidden !== true && hidden !== 'true' && hasWords(children.props.children);
  }
  return false;
}

/** The text a screen reader reads from the button's content: not aria-hidden parts or SVG titles. */
function spokenText(node: Node): string {
  if (node.nodeType === Node.TEXT_NODE) return node.textContent ?? '';
  if (!(node instanceof Element) || node.getAttribute('aria-hidden') === 'true' || node.namespaceURI === 'http://www.w3.org/2000/svg') {
    return '';
  }
  return [...node.childNodes].map(spokenText).join('');
}

/**
 * A ghost Button.Root. The alert has no open state: remove it in `onClick`.
 * Named "Dismiss" unless its own text names it, so a visible label stays its name.
 */
function Close({ 'aria-label': ariaLabel, className, children, ref, ...props }: AlertCloseProps) {
  // The rendered text decides, so a component that renders text (such as a
  // translation) names the button too. The children are a first guess for SSR.
  const [worded, setWorded] = useState(() => hasWords(children));
  const buttonRef = useRef<HTMLButtonElement>(null);
  const refs = useComposedRefs(buttonRef, ref);
  // Every commit, as the text can change; the same value bails out.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useLayoutEffect(() => {
    const button = buttonRef.current;
    setWorded(button ? isWorded(spokenText(button)) : false);
  });
  const label = ariaLabel ?? (worded ? undefined : 'Dismiss');
  return (
    <Button.Root variant="ghost" aria-label={label} {...props} ref={refs} className={cx(styles.close, className)}>
      {children}
    </Button.Root>
  );
}

export const Alert = { Root, Icon, Title, Description, Actions, Close } as const;
