import {
  Children,
  isValidElement,
  useLayoutEffect,
  useRef,
  useState,
  type ButtonHTMLAttributes,
  type ComponentPropsWithRef,
  type ReactElement,
  type ReactNode,
  type Ref,
} from 'react';
import { useTooltip } from '../hooks/useTooltip';
import styles from './Button.module.css';
import { Tooltip } from './Tooltip';

/**
 * Button variants, one per `buttonVariant` context in the token resolver. A
 * company that adds a context declares it here too:
 * `declare module '@tounsoo/todae' { interface ButtonVariants { outline: true } }`.
 */
export interface ButtonVariants {
  primary: true;
  secondary: true;
  ghost: true;
}

export type ButtonVariant = keyof ButtonVariants;

export type ButtonRootProps = {
  variant?: ButtonVariant;
  tooltip?: boolean;
  ref?: Ref<HTMLButtonElement | null>;
} & ButtonHTMLAttributes<HTMLButtonElement>;

export type ButtonIconProps = {
  children?: ReactNode;
  className?: string;
} & ComponentPropsWithRef<'span'>;

export type ButtonGroupProps = {
  'aria-label'?: string;
  'aria-labelledby'?: string;
  className?: string;
  children?: ReactNode;
} & Omit<ComponentPropsWithRef<'div'>, 'role'>;

function isIconElement(child: ReactNode): child is ReactElement {
  return isValidElement(child) && child.type === Icon;
}

function isIconOnly(children: ReactNode): boolean {
  const items = Children.toArray(children);
  return items.length > 0 && items.every(isIconElement);
}

function labelText(children: ReactNode): string {
  return Children.toArray(children)
    .filter((child) => !isIconElement(child))
    .map((child) => (typeof child === 'string' || typeof child === 'number' ? String(child) : ''))
    .join('')
    .trim();
}

function Root({
  variant = 'primary',
  className,
  type = 'button',
  tooltip = true,
  ref,
  children,
  style,
  onPointerEnter,
  onPointerLeave,
  onFocus,
  onBlur,
  ...props
}: ButtonRootProps) {
  const iconOnly = isIconOnly(children);
  const [labelledbyText, setLabelledbyText] = useState<string | null | undefined>(undefined);
  const [overflowing, setOverflowing] = useState(false);
  const labelRef = useRef<HTMLSpanElement | null>(null);
  const labelledby = props['aria-labelledby'];

  useLayoutEffect(() => {
    if (!labelledby) {
      setLabelledbyText(undefined);
      return;
    }
    const text = document.getElementById(labelledby)?.textContent?.trim() ?? '';
    setLabelledbyText(text || null);
  }, [labelledby]);

  useLayoutEffect(() => {
    const el = labelRef.current;
    if (!el) {
      setOverflowing(false);
      return;
    }
    const check = () => {
      setOverflowing(el.scrollWidth > el.clientWidth);
    };
    check();
    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(check);
    observer.observe(el);
    return () => observer.disconnect();
  }, [children, iconOnly]);

  const ariaLabel = typeof props['aria-label'] === 'string' ? props['aria-label'].trim() : '';
  const iconName = iconOnly ? ariaLabel || (typeof labelledbyText === 'string' ? labelledbyText : null) : null;

  if (
    process.env.NODE_ENV !== 'production' &&
    iconOnly &&
    iconName == null &&
    (!labelledby || labelledbyText === null)
  ) {
    console.error('Button.Root icon-only requires aria-label or aria-labelledby');
  }

  const textName = iconOnly ? null : labelText(children);
  const tipText = !tooltip ? null : iconOnly ? iconName : overflowing && textName ? textName : null;
  const tip = useTooltip({ enabled: tipText != null });
  const trigger =
    tipText != null
      ? tip.getTriggerProps({
          ref: ref as Ref<HTMLElement | null>,
          style,
          onPointerEnter,
          onPointerLeave,
          onFocus,
          onBlur,
        })
      : { ref, style, onPointerEnter, onPointerLeave, onFocus, onBlur };

  const content = iconOnly
    ? children
    : Children.map(children, (child) => {
        if (isIconElement(child)) return child;
        if (typeof child === 'string' || typeof child === 'number') {
          return (
            <span className={styles.label} ref={labelRef}>
              {child}
            </span>
          );
        }
        return child;
      });

  const button = (
    <button
      {...props}
      {...trigger}
      type={type}
      className={[styles.root, className].filter(Boolean).join(' ')}
      data-button-variant={variant === 'primary' ? undefined : variant}
      data-icon-only={iconOnly ? '' : undefined}
    >
      {content}
    </button>
  );

  if (tipText == null) return button;
  return (
    <>
      {button}
      <Tooltip {...tip.getTooltipProps()}>{tipText}</Tooltip>
    </>
  );
}

function Icon({ className, ...props }: ButtonIconProps) {
  return <span aria-hidden {...props} className={[styles.icon, className].filter(Boolean).join(' ')} />;
}

export function ButtonGroup({ className, children, ...props }: ButtonGroupProps) {
  return (
    <div {...props} role="group" className={[styles.group, className].filter(Boolean).join(' ')}>
      {children}
    </div>
  );
}

export const Button = { Root, Icon } as const;
