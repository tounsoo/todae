import {
  Children,
  isValidElement,
  useCallback,
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
  return {
    hasIcon: button.querySelector(`[${ICON_ATTR}]`) !== null,
    text: text.trim(),
  };
}

type Content = { hasIcon: boolean; text: string };

// Server-render hint only, used until the button can be read: icon-only when
// every direct child is a Button.Icon. The read after layout is what counts,
// and it also sees icons inside wrappers.
function hint(children: ReactNode): { iconOnly: boolean; text: string } {
  const items = Children.toArray(children);
  return {
    iconOnly: items.length > 0 && items.every((child) => isValidElement(child) && child.type === Icon),
    text: items
      .map((child) => (typeof child === 'string' || typeof child === 'number' ? String(child) : ''))
      .join('')
      .trim(),
  };
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
  const [read, setRead] = useState<Content | null>(null);
  const guess = read ? null : hint(children);
  const iconOnly = read ? read.hasIcon && read.text === '' : guess!.iconOnly;
  const contentText = read ? read.text : guess!.text;
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

  const readButton = useCallback(() => {
    const button = buttonRef.current;
    if (!button) return;
    const next = readContent(button);
    setRead((prev) => (prev?.hasIcon === next.hasIcon && prev.text === next.text ? prev : next));
  }, []);

  useLayoutEffect(readButton);

  // A child can swap an icon for text from its own state without this
  // component rendering again.
  useLayoutEffect(() => {
    const button = buttonRef.current;
    if (!button || typeof MutationObserver === 'undefined') return;
    const observer = new MutationObserver(readButton);
    observer.observe(button, {
      childList: true,
      subtree: true,
      characterData: true,
    });
    return () => observer.disconnect();
  }, [readButton]);

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

  const textName = iconOnly ? null : contentText;
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

  // Always mapped: switching between mapped and raw children would re-key
  // and remount them whenever icon-only detection changes.
  const rendered = Children.map(children, (child) => {
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

  // One shape whether or not a tip shows, so gaining a tip never remounts
  // the button and its children.
  return (
    <>
      {button}
      {tipText == null ? null : <Tooltip {...tip.getTooltipProps()}>{tipText}</Tooltip>}
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
