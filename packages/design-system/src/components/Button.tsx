import {
  Children,
  useLayoutEffect,
  useRef,
  useState,
  type ButtonHTMLAttributes,
  type ComponentPropsWithRef,
  type ReactNode,
  type Ref,
} from 'react';
import { useTooltip } from '../hooks/useTooltip';
import styles from './Button.module.css';
import { useComposedRefs } from './props';
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

const ICON_ATTR = 'data-todae-button-icon';

// Icons are found in the rendered button, not by component type, so a
// Button.Icon inside a company's own icon wrapper still counts.
function readContent(button: HTMLElement): { hasIcon: boolean; text: string } {
  let text = '';
  const walker = document.createTreeWalker(button, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT, {
    acceptNode: (node) =>
      node instanceof Element && node.hasAttribute(ICON_ATTR) ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT,
  });
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    if (node.nodeType === Node.TEXT_NODE) text += node.textContent ?? '';
  }
  return { hasIcon: button.querySelector(`[${ICON_ATTR}]`) !== null, text: text.trim() };
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
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const [content, setContent] = useState({ hasIcon: false, text: '' });
  const iconOnly = content.hasIcon && content.text === '';
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
    const button = buttonRef.current;
    if (!button) return;
    const next = readContent(button);
    setContent((prev) => (prev.hasIcon === next.hasIcon && prev.text === next.text ? prev : next));
  });

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

  const unnamed = iconOnly && iconName == null && (!labelledby || labelledbyText === null);
  useLayoutEffect(() => {
    if (process.env.NODE_ENV !== 'production' && unnamed) {
      console.error('Button.Root icon-only requires aria-label or aria-labelledby');
    }
  }, [unnamed]);

  const textName = iconOnly ? null : content.text;
  const tipText = !tooltip ? null : iconOnly ? iconName : overflowing && textName ? textName : null;
  const tip = useTooltip({ enabled: tipText != null });
  const refs = useComposedRefs(buttonRef, ref);
  const trigger =
    tipText != null
      ? tip.getTriggerProps({
          ref: refs as Ref<HTMLElement | null>,
          style,
          onPointerEnter,
          onPointerLeave,
          onFocus,
          onBlur,
        })
      : { ref: refs, style, onPointerEnter, onPointerLeave, onFocus, onBlur };

  const rendered = iconOnly
    ? children
    : Children.map(children, (child) => {
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
      {rendered}
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
  return (
    <span
      {...props}
      {...{ [ICON_ATTR]: '' }}
      aria-hidden={props['aria-hidden'] ?? true}
      className={[styles.icon, className].filter(Boolean).join(' ')}
    />
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
