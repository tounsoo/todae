import {
  Children,
  isValidElement,
  useCallback,
  useLayoutEffect,
  useRef,
  useState,
  type ButtonHTMLAttributes,
  type ComponentPropsWithRef,
  type HTMLAttributes,
  type FocusEvent,
  type MouseEvent,
  type PointerEvent,
  type ReactElement,
  type ReactNode,
  type Ref,
  type RefCallback,
  type RefObject,
} from 'react';
import { useControlledState } from '../hooks/useControlledState.js';
import { anchorTriggerStyle } from '../overlay/anchorName.js';
import { useTooltipInternal, type TooltipInternalResult } from '../overlay/tooltip.js';
import { cx } from '../internal/cx.js';
import { useDomId } from '../internal/domId.js';
import styles from './Button.module.css';
import { composeHandlers, useComposedRefs } from '../internal/props.js';
import { Tooltip } from './Tooltip.js';

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

type ButtonOwnProps = {
  variant?: ButtonVariant;
  tooltip?: boolean;
};

/**
 * Props of a Button.Root that renders its own `<button>`; one drawn on
 * another element takes {@link ButtonRenderedProps}.
 * Passing `pressed` or `defaultPressed` makes the button a toggle: it sets
 * `aria-pressed` and flips on click, unless `onClick` calls `preventDefault()`
 * or the button is `aria-disabled`. An `aria-disabled` button ignores clicks:
 * `onClick` doesn't run, and it submits no form and follows no link.
 */
export type ButtonRootProps = ButtonOwnProps & {
  pressed?: boolean;
  defaultPressed?: boolean;
  onPressedChange?: (pressed: boolean) => void;
  render?: undefined;
  ref?: Ref<HTMLButtonElement | null>;
} & ButtonHTMLAttributes<HTMLButtonElement>;

/** What Button.Root hands `render`: its look, content and handlers, to spread on the element it returns. */
export type ButtonRenderProps = HTMLAttributes<HTMLElement> & {
  ref: RefCallback<HTMLElement>;
  [data: `data-${string}`]: string | undefined;
};

// Attributes only a <button> takes, so a rendered element can't be given them.
type ButtonOnlyAttribute = Exclude<keyof ButtonHTMLAttributes<HTMLButtonElement>, keyof HTMLAttributes<HTMLButtonElement>>;

/**
 * A Button.Root drawn on another element, such as a link: `render` returns
 * it, with the props it is handed. The element keeps its own role, so it
 * can't be a toggle or take the attributes only a button has.
 */
export type ButtonRenderedProps = ButtonOwnProps & {
  render: (props: ButtonRenderProps) => ReactElement;
  pressed?: never;
  defaultPressed?: never;
  onPressedChange?: never;
  ref?: Ref<HTMLElement | null>;
} & { [K in ButtonOnlyAttribute]?: never } & HTMLAttributes<HTMLElement>;

/** Button.Root props for a button that is never a toggle or another element, such as a close or menu trigger. */
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

const isPlain = (child: ReactNode) => typeof child === 'string' || typeof child === 'number';

// From direct children: the label text that can overflow (and so feeds the
// overflow tooltip), and whether the button is icon-only. When every child is
// a string, a number or a Button.Icon, that is exact: the button renders just
// those, so nothing needs reading. Otherwise it is a server-render hint used
// until the button can be read, and the read after each commit decides,
// seeing icons inside wrappers. A child that swaps an icon for text from its
// own state is read at the button's next commit.
function hint(children: ReactNode, rendered: boolean): { exact: boolean; iconOnly: boolean; text: string } {
  const items = Children.toArray(children);
  const isIcon = (child: ReactNode) => isValidElement(child) && child.type === Icon;
  const text = items
    .map((child) => (isPlain(child) ? String(child) : ''))
    .join('')
    .trim();
  // `render` draws the element, so it could add content of its own.
  const exact = !rendered && items.every((child) => isPlain(child) || isIcon(child));
  return {
    exact,
    iconOnly: exact ? text === '' && items.some(isIcon) : items.length > 0 && items.every(isIcon),
    text,
  };
}

// aria-disabled is a string or a boolean in React's types.
const isAriaDisabled = (value: unknown) => value === true || value === 'true';

// Overloads, not one union, so a handler passed with `render` still gets its event type.
// The button one is last, since ComponentProps<typeof Button.Root> reads the last.
function Root(props: ButtonRenderedProps): ReactElement;
function Root(props: ButtonRootProps): ReactElement;
function Root({
  variant = 'primary',
  className,
  type,
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
  render,
  ...props
}: ButtonRootProps | ButtonRenderedProps) {
  const buttonRef = useRef<HTMLElement | null>(null);
  const toggle = pressedProp !== undefined || defaultPressed !== undefined;
  const [pressed, setPressed, latestPressed] = useControlledState(pressedProp, defaultPressed ?? false, onPressedChange);
  const composedClick = composeHandlers(onClick as ((event: MouseEvent<HTMLElement>) => void) | undefined, () => {
    if (toggle) setPressed(!latestPressed());
  });
  // aria-disabled keeps the button focusable, not usable: a click runs no
  // onClick, flips no toggle, submits no form and follows no link.
  const handleClick = (event: MouseEvent<HTMLElement>) => {
    if (isAriaDisabled(props['aria-disabled'])) {
      event.preventDefault();
      return;
    }
    composedClick(event);
  };
  const [read, setRead] = useState<Content | null>(null);
  const direct = hint(children, render !== undefined);
  const iconOnly = !direct.exact && read ? isIconOnly(read) : direct.iconOnly;
  const [labelledbyText, setLabelledbyText] = useState<string | null | undefined>(undefined);
  // The label text last found cut, when the person reached the button.
  const [cutText, setCutText] = useState<string | null>(null);
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

  // The labels the overflow tip reads.
  const labels = useRef(new Set<HTMLElement>());
  const labelRef = useCallback((el: HTMLSpanElement | null) => {
    if (!el) return;
    labels.current.add(el);
    return () => {
      labels.current.delete(el);
    };
  }, []);

  // Content other than strings, numbers and Button.Icons is read after each
  // commit; nothing watches it between commits.
  const exact = direct.exact;
  useLayoutEffect(() => {
    if (!exact) readButton();
  });

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

  const rendersElement = render !== undefined;
  useLayoutEffect(() => {
    if (process.env.NODE_ENV === 'production' || !rendersElement) return;
    // A div or span would look like a button but take no keyboard or role.
    const tag = buttonRef.current?.tagName;
    if (tag !== 'A' && tag !== 'BUTTON') console.error('Button.Root render must pass its props, ref included, to an a or a button');
  }, [rendersElement]);

  const textName = iconOnly ? null : direct.text;
  // An icon-only button's tip turns on the first time the pointer or keys
  // reach it, and stays on.
  const [reachedOnce, setReachedOnce] = useState(false);
  const tipText = !tooltip
    ? null
    : iconOnly
      ? reachedOnce
        ? iconName
        : null
      : textName && cutText === textName
        ? textName
        : null;
  const tipped = tipText != null;
  const refs = useComposedRefs(buttonRef, ref);
  const anchor = `--todae-tooltip-${useDomId()}`;
  // The mounted tip's holds, which ButtonTip sets.
  const holds = useRef<TipHolds | null>(null);

  // The tip mounts only once the person reaches the button, by pointer or by
  // keys: an icon-only button with a name, or a label found cut, which is
  // read then and not kept up to date, since a label is cut or not only to
  // someone looking at it. The hold that turned the tip on waits for that
  // render; a label found to fit again turns it off and takes no hold.
  // The holds waiting for that render: the pointer, and the element focus reached.
  const reached = useRef<{ hover: boolean; focus: Element | null }>({ hover: false, focus: null });
  const reach = (hover: boolean, focus: Element | null) => {
    let wanted = iconOnly && iconName != null;
    if (!iconOnly) for (const el of labels.current) wanted ||= el.scrollWidth > el.clientWidth;
    if (wanted && tipped) {
      if (hover) holds.current?.holdHover();
      else if (focus) holds.current?.holdFocus(focus);
    } else if (wanted) {
      if (hover) reached.current.hover = true;
      else reached.current.focus = focus;
      if (iconOnly) setReachedOnce(true);
      else setCutText(textName);
    } else if (tipped) setCutText(null);
  };
  useLayoutEffect(() => {
    const { hover, focus } = reached.current;
    reached.current = { hover: false, focus: null };
    const tip = holds.current;
    if (!tipped || !tip) return;
    if (hover) tip.holdHover();
    // Focus a product handler moved on takes no hold.
    if (focus?.matches(':focus')) tip.holdFocus(focus);
  }, [tipped]);

  const base = { ref: refs as Ref<HTMLElement | null>, style, onPointerEnter, onPointerLeave, onFocus, onBlur };
  const trigger =
    !tooltip || !(iconOnly || textName)
      ? base
      : {
          ...base,
          style: tipped ? anchorTriggerStyle('--todae-tooltip-anchor', anchor, style) : style,
          onPointerEnter: composeHandlers(onPointerEnter, () => reach(true, null)),
          onFocus: composeHandlers(onFocus, (event: FocusEvent<HTMLElement>) => reach(false, event.target)),
          // Releases run even when the product's handler prevents the event,
          // so a prevented leave or blur cannot strand the tip open.
          onPointerLeave: (event: PointerEvent<HTMLElement>) => {
            (onPointerLeave as ((event: PointerEvent<HTMLElement>) => void) | undefined)?.(event);
            reached.current.hover = false;
            holds.current?.releaseHover(event.relatedTarget);
          },
          onBlur: (event: FocusEvent<HTMLElement>) => {
            (onBlur as ((event: FocusEvent<HTMLElement>) => void) | undefined)?.(event);
            reached.current.focus = null;
            holds.current?.releaseFocus(event.relatedTarget);
          },
        };

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

  const element = {
    ...props,
    ...trigger,
    onClick: handleClick,
    className: cx(styles.root, className),
    'data-button-variant': variant === 'primary' ? undefined : variant,
    'data-icon-only': iconOnly ? '' : undefined,
    children: rendered,
  };
  const button = render ? (
    render(element as ButtonRenderProps)
  ) : (
    <button
      {...(element as ButtonHTMLAttributes<HTMLButtonElement>)}
      ref={trigger.ref as Ref<HTMLButtonElement>}
      type={type ?? 'button'}
      aria-pressed={toggle ? pressed : props['aria-pressed']}
    />
  );

  // One shape whether or not a tip shows, so gaining a tip never remounts
  // the button and its children.
  return (
    <>
      {button}
      {tipText == null ? null : <ButtonTip target={buttonRef} anchor={anchor} text={tipText} holds={holds} />}
    </>
  );
}

type TipHolds = Pick<TooltipInternalResult, 'holdHover' | 'releaseHover' | 'holdFocus' | 'releaseFocus'>;

type ButtonTipProps = {
  target: RefObject<HTMLElement | null>;
  anchor: string;
  text: string;
  holds: RefObject<TipHolds | null>;
};

/**
 * A Button's tip, after it, mounted only while it can show, so a Button the
 * person never reaches carries no tooltip state. Root reaches its holds
 * through `holds`. The tip shows the button's own name, so it is for the eye
 * alone: it describes nothing, or a screen reader would read the name twice.
 */
function ButtonTip({ target, anchor, text, holds }: ButtonTipProps) {
  const tip = useTooltipInternal({}, { anchorName: anchor });
  const { triggerRef, holdHover, releaseHover, holdFocus, releaseFocus } = tip;
  // `render` can swap the element the button is drawn on.
  useLayoutEffect(() => {
    triggerRef.current = target.current;
  });
  useLayoutEffect(() => {
    holds.current = { holdHover, releaseHover, holdFocus, releaseFocus };
    return () => {
      triggerRef.current = null;
      holds.current = null;
    };
  }, [holdFocus, holdHover, holds, releaseFocus, releaseHover, triggerRef]);
  return (
    <Tooltip.Root {...tip.getTooltipProps()} aria-hidden="true">
      {text}
    </Tooltip.Root>
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
