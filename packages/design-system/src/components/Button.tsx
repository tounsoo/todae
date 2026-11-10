import {
  Children,
  isValidElement,
  useCallback,
  useEffect,
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
import { mergeAnchorNames, removeAnchorName } from '../overlay/anchorName.js';
import { pointerFocus, useTooltipInternal, type TooltipInternalResult } from '../overlay/tooltip.js';
import { cx } from '../internal/cx.js';
import { useDomId } from '../internal/domId.js';
import { watchInputModality } from '../internal/inputModality.js';
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
  // An icon-only button's tip turns on once the pointer or keys have reached
  // the button, as icon-only or not, and stays on, so a button held while
  // it turns icon-only keeps its tip.
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
  // someone looking at it. A label found to fit again turns the tip off.
  // The holds the person has on the button while no tip is on, the pointer
  // and the element focus reached, which the tip takes as it mounts; leaving
  // and blurring drop them.
  const waiting = useRef<Waiting>({ hover: false, focus: null });
  const reach = (hover: boolean, focus: Element | null) => {
    let wanted = iconOnly && iconName != null;
    if (!iconOnly) for (const el of labels.current) wanted ||= el.scrollWidth > el.clientWidth;
    // Only a reach that wants a tip counts, so a label that fit never mounts one.
    if (wanted && !reachedOnce) setReachedOnce(true);
    if (wanted && tipped) {
      if (hover) holds.current?.holdHover();
      else if (focus) holds.current?.holdFocus(focus);
    } else if (wanted) {
      if (hover) waiting.current.hover = true;
      // Focus a press put there takes no hold, now or when the tip mounts.
      else waiting.current.focus = focus && !pointerFocus(focus) ? focus : null;
      if (!iconOnly) setCutText(textName);
    } else if (tipped) setCutText(null);
  };

  // Focus after a press opens no tip, so the page's presses and keys are
  // watched before any tip mounts, by every Button, a press on one with no
  // tip included.
  useEffect(() => {
    watchInputModality(buttonRef.current?.ownerDocument);
  }, []);

  // While no tip is mounted, or Root stops listening for leave and blur,
  // holds still waiting are dropped on every render, so a later tip takes only
  // new ones. A reach sets its tip state in the same batch as its hold, so the
  // render that follows it has a tip and keeps the hold.
  const listens = tooltip && (iconOnly || Boolean(textName));
  const idle = !listens || tipText == null;
  useLayoutEffect(() => {
    if (idle) waiting.current = { hover: false, focus: null };
  });

  const base = { ref: refs as Ref<HTMLElement | null>, style, onPointerEnter, onPointerLeave, onFocus, onBlur };
  const trigger =
    !listens
      ? base
      : {
          ...base,
          onPointerEnter: composeHandlers(onPointerEnter, () => reach(true, null)),
          onFocus: composeHandlers(onFocus, (event: FocusEvent<HTMLElement>) => reach(false, event.target)),
          // Releases run even when the product's handler prevents the event,
          // so a prevented leave or blur cannot strand the tip open.
          onPointerLeave: (event: PointerEvent<HTMLElement>) => {
            (onPointerLeave as ((event: PointerEvent<HTMLElement>) => void) | undefined)?.(event);
            waiting.current.hover = false;
            holds.current?.releaseHover(event.relatedTarget);
          },
          onBlur: (event: FocusEvent<HTMLElement>) => {
            (onBlur as ((event: FocusEvent<HTMLElement>) => void) | undefined)?.(event);
            waiting.current.focus = null;
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
      {tipText == null ? null : <ButtonTip target={buttonRef} anchor={anchor} text={tipText} holds={holds} waiting={waiting} />}
    </>
  );
}

type TipHolds = Pick<TooltipInternalResult, 'holdHover' | 'releaseHover' | 'holdFocus' | 'releaseFocus'>;
type Waiting = { hover: boolean; focus: Element | null };

type ButtonTipProps = {
  target: RefObject<HTMLElement | null>;
  anchor: string;
  text: string;
  holds: RefObject<TipHolds | null>;
  waiting: RefObject<Waiting>;
};

/**
 * A Button's tip, after it, mounted only while it can show, so a Button the
 * person never reaches carries no tooltip state. Root reaches its holds
 * through `holds`. The tip shows the button's own name, so it is for the eye
 * alone: it describes nothing, or a screen reader would read the name twice.
 * It takes the holds still `waiting` each time it mounts, so the one that
 * turned it on, and StrictMode's second mount, open it; once it opens, none
 * are left waiting.
 */
function ButtonTip({ target, anchor, text, holds, waiting }: ButtonTipProps) {
  const tip = useTooltipInternal({}, { anchorName: anchor });
  const { triggerRef, holdHover, releaseHover, holdFocus, releaseFocus } = tip;
  // The tip's anchor name goes on the button from code, beside any a
  // Coachmark or popover added, so the button's own style never changes for
  // it and a Button with no tip carries none. Each render puts it back if a
  // style the product passed has replaced the list, and `render` can swap
  // the element the button is drawn on.
  const named = useRef<HTMLElement | null>(null);
  useLayoutEffect(() => {
    const el = target.current;
    triggerRef.current = el;
    if (named.current !== el) unname(named.current, anchor);
    named.current = el;
    if (!el) return;
    const names = el.style.getPropertyValue('anchor-name');
    if (!names.split(',').some((name) => name.trim() === anchor)) {
      el.style.setProperty('anchor-name', mergeAnchorNames(names, anchor));
    }
  });
  useLayoutEffect(
    () => () => {
      unname(named.current, anchor);
      named.current = null;
    },
    [anchor],
  );
  useLayoutEffect(() => {
    holds.current = { holdHover, releaseHover, holdFocus, releaseFocus };
    const { hover, focus } = waiting.current;
    if (hover) holdHover();
    // Focus a product handler moved on takes no hold.
    if (focus?.matches(':focus')) holdFocus(focus);
    return () => {
      triggerRef.current = null;
      holds.current = null;
    };
  }, [holdFocus, holdHover, holds, releaseFocus, releaseHover, triggerRef, waiting]);
  // Once open, the tip has taken them, and a later tip takes only new ones.
  useLayoutEffect(() => {
    if (tip.open) waiting.current = { hover: false, focus: null };
  }, [tip.open, waiting]);
  return (
    <Tooltip.Root {...tip.getTooltipProps()} aria-hidden="true">
      {text}
    </Tooltip.Root>
  );
}

function unname(el: HTMLElement | null, anchor: string) {
  if (!el) return;
  const rest = removeAnchorName(el.style.getPropertyValue('anchor-name'), anchor);
  if (rest) el.style.setProperty('anchor-name', rest);
  else el.style.removeProperty('anchor-name');
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
