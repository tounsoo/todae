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
import { useControlledState } from '../hooks/useControlledState.js';
import { useTooltip } from '../hooks/useTooltip.js';
import { cx } from './cx.js';
import styles from './Button.module.css';
import { composeHandlers, useComposedRefs } from './props.js';
import { Tooltip } from './Tooltip.js';

/**
 * Button variants, one per `buttonVariant` context in the token resolver. A
 * company that adds a context declares it here too:
 * `declare module '@omsoo.design/todae' { interface ButtonVariants { outline: true } }`.
 */
export interface ButtonVariants {
  primary: true;
  secondary: true;
  ghost: true;
}

export type ButtonVariant = keyof ButtonVariants;

/**
 * Passing `pressed` or `defaultPressed` makes the button a toggle: it sets
 * `aria-pressed` and flips on click, unless `onClick` calls `preventDefault()`.
 */
export type ButtonRootProps = {
  variant?: ButtonVariant;
  tooltip?: boolean;
  pressed?: boolean;
  defaultPressed?: boolean;
  onPressedChange?: (pressed: boolean) => void;
  ref?: Ref<HTMLButtonElement | null>;
} & ButtonHTMLAttributes<HTMLButtonElement>;

/** Button.Root props for a button that is never a toggle, such as a close or menu trigger. */
export type ButtonActionProps = Omit<ButtonRootProps, 'pressed' | 'defaultPressed' | 'onPressedChange'>;

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

// Media outside an icon is content too: an <img alt> or a spinner can name or
// fill the button.
const MEDIA = /* @__PURE__ */ new Set(['IMG', 'SVG', 'svg', 'CANVAS', 'VIDEO', 'PICTURE', 'OBJECT', 'IFRAME', 'INPUT']);

// Icons are found in the rendered button, not by component type, so a
// Button.Icon inside a company's own icon wrapper still counts.
function readContent(button: HTMLElement): { hasIcon: boolean; text: string; media: boolean } {
  let text = '';
  let media = false;
  // nodeType rather than instanceof, so a button rendered into an iframe works.
  const walker = button.ownerDocument.createTreeWalker(button, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT, {
    acceptNode: (node) =>
      node.nodeType === Node.ELEMENT_NODE && (node as Element).hasAttribute(ICON_ATTR)
        ? NodeFilter.FILTER_REJECT
        : NodeFilter.FILTER_ACCEPT,
  });
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    if (node.nodeType === Node.TEXT_NODE) text += node.textContent ?? '';
    else if (MEDIA.has((node as Element).tagName)) media = true;
  }
  return {
    hasIcon: button.querySelector(`[${ICON_ATTR}]`) !== null,
    text: text.trim(),
    media,
  };
}

type Content = { hasIcon: boolean; text: string; media: boolean };

function isIconOnly(content: Content): boolean {
  return content.hasIcon && content.text === '' && !content.media;
}

// From direct children: the label text that can overflow (and so feeds the
// overflow tooltip), and a server-render icon-only hint used until the button
// can be read. The read after layout decides icon-only, and it also sees icons
// inside wrappers.
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
  pressed: pressedProp,
  defaultPressed,
  onPressedChange,
  onClick,
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
  const toggle = pressedProp !== undefined || defaultPressed !== undefined;
  const [pressed, setPressed] = useControlledState(pressedProp, defaultPressed ?? false);
  const handleClick = composeHandlers(onClick, () => {
    if (!toggle) return;
    setPressed(!pressed);
    onPressedChange?.(!pressed);
  });
  const [read, setRead] = useState<Content | null>(null);
  const direct = hint(children);
  const iconOnly = read ? isIconOnly(read) : direct.iconOnly;
  const [labelledbyText, setLabelledbyText] = useState<string | null | undefined>(undefined);
  const [overflowing, setOverflowing] = useState(false);
  const labelRef = useRef<HTMLSpanElement | null>(null);
  const labelledby = props['aria-labelledby'];

  useLayoutEffect(() => {
    if (!labelledby) {
      setLabelledbyText(undefined);
      return;
    }
    // An id list, joined in order as the accessible name joins it.
    const doc = buttonRef.current?.ownerDocument ?? document;
    const text = labelledby
      .split(/\s+/)
      .filter(Boolean)
      .map((id) => doc.getElementById(id)?.textContent?.trim() ?? '')
      .filter(Boolean)
      .join(' ');
    setLabelledbyText(text || null);
  }, [labelledby]);

  const readButton = useCallback(() => {
    const button = buttonRef.current;
    if (!button) return;
    const next = readContent(button);
    setRead((prev) =>
      prev?.hasIcon === next.hasIcon && prev.text === next.text && prev.media === next.media ? prev : next,
    );
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
    if (process.env.NODE_ENV === 'production' || !unnamed) return;
    // `read` can trail a render that swapped content and label together.
    const button = buttonRef.current;
    const fresh = button ? readContent(button) : null;
    if (fresh && !isIconOnly(fresh)) return;
    console.error('Button.Root icon-only requires aria-label or aria-labelledby');
  }, [unnamed]);

  const textName = iconOnly ? null : direct.text;
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
      aria-pressed={toggle ? pressed : props['aria-pressed']}
      onClick={handleClick}
      className={cx(styles.root, className)}
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
      {tipText == null ? null : <Tooltip.Root {...tip.getTooltipProps()}>{tipText}</Tooltip.Root>}
    </>
  );
}

function Icon({ className, ...props }: ButtonIconProps) {
  return (
    <span
      {...props}
      {...{ [ICON_ATTR]: '' }}
      aria-hidden={props['aria-hidden'] ?? true}
      className={cx(styles.icon, className)}
    />
  );
}

function Group({ className, children, ...props }: ButtonGroupProps) {
  return (
    <div {...props} role="group" className={cx(styles.group, className)}>
      {children}
    </div>
  );
}

export const Button = { Root, Icon, Group } as const;
