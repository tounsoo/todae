import {
  Children,
  createContext,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  type ComponentPropsWithRef,
  type KeyboardEvent,
  type MouseEvent,
  type SubmitEvent as ReactSubmitEvent,
} from 'react';
import { useGlyphs } from '../providers/GlyphsProvider';
import { useStrings } from '../providers/StringsProvider';
import { Button, type ButtonActionProps } from './Button';
import { useDismissLabel } from './dismissLabel';
import { glyphOr, SendGlyph, StopGlyph } from './glyphs';
import { composeHandlers, cx, useComposedRefs } from './props';
import styles from './Composer.module.css';

/**
 * The prompt input of a chat: a `form` around a Field.Root that holds a
 * Field.Textarea. Enter in a textarea of the form sends it; Shift+Enter adds a
 * line.
 */
export type ComposerRootProps = ComponentPropsWithRef<'form'> & {
  /** Called for this form's own submits, not those of a form rendered inside it with createPortal. */
  onSubmit?: ComponentPropsWithRef<'form'>['onSubmit'];
  /** A response is running: no submit event goes through, from Enter, a submit button or requestSubmit, and Composer.Submit turns into Stop. Sets `data-busy`. */
  busy?: boolean;
};
/** A Button.Root that sends the form, or stops the response while the composer is busy. With no content it shows the send or stop glyph. */
export type ComposerSubmitProps = Omit<ButtonActionProps, 'type'> & {
  /** Called when Stop is pressed. Without it, Stop is disabled while the composer is busy. */
  onStop?: () => void;
};

type ComposerContext = { busy: boolean };

const Context = createContext<ComposerContext | null>(null);

function useComposer(part: string): ComposerContext {
  const context = useContext(Context);
  if (!context) throw new Error(`Composer.${part} must be rendered inside Composer.Root`);
  return context;
}

/**
 * The button implicit submission would press: the form's first submit button
 * in tree order, including an image input, which `form.elements` leaves out.
 * It searches the document or shadow root that holds the form.
 */
function defaultButton(form: HTMLFormElement): HTMLButtonElement | HTMLInputElement | undefined {
  const tree = form.getRootNode() as Document | ShadowRoot;
  const candidates = tree.querySelectorAll<HTMLButtonElement | HTMLInputElement>(
    'button, input[type="submit" i], input[type="image" i]',
  );
  for (const el of candidates) {
    if (el.form === form && el.type !== 'button' && el.type !== 'reset') return el;
  }
  return undefined;
}

function Root({ busy = false, className, onKeyDown, onSubmit, ...props }: ComposerRootProps) {
  const context = useMemo(() => ({ busy }), [busy]);
  const handleKeyDown = (event: KeyboardEvent<HTMLFormElement>) => {
    const target = event.target;
    if (!(target instanceof HTMLTextAreaElement) || target.form !== event.currentTarget) return;
    if (event.key !== 'Enter' || event.shiftKey || event.altKey || event.ctrlKey || event.metaKey) return;
    // Enter that ends an IME composition, such as a Korean or Japanese word,
    // only commits the word. Safari sends it after compositionend, with keyCode 229.
    if (event.nativeEvent.isComposing || event.keyCode === 229) return;
    if (event.defaultPrevented || target.readOnly || target.matches(':disabled')) return;
    event.preventDefault();
    // A held Enter sends once, even if busy is not set yet when it repeats.
    if (busy || event.repeat) return;
    const form = event.currentTarget;
    const button = defaultButton(form);
    // As implicit submission does: a disabled default button sends nothing.
    if (button?.matches(':disabled')) return;
    form.requestSubmit(button);
  };
  // Nothing sends while busy, whatever starts it: Enter in a text input, a
  // product button, or a call to requestSubmit. A form rendered inside the
  // composer with createPortal is its own: its submit is left alone.
  const handleSubmit = (event: ReactSubmitEvent<HTMLFormElement>) => {
    if (event.target !== event.currentTarget) return;
    if (busy) {
      event.preventDefault();
      return;
    }
    onSubmit?.(event);
  };
  return (
    <Context.Provider value={context}>
      <form
        {...props}
        onKeyDown={composeHandlers(onKeyDown, handleKeyDown)}
        onSubmit={handleSubmit}
        data-busy={busy ? '' : undefined}
        className={className}
      />
    </Context.Provider>
  );
}

function Submit({
  'aria-label': ariaLabel,
  className,
  children,
  disabled,
  onClick,
  onKeyDown,
  onStop,
  ref,
  ...props
}: ComposerSubmitProps) {
  const { busy } = useComposer('Submit');
  const strings = useStrings();
  const glyphs = useGlyphs();
  const own = useRef<HTMLButtonElement>(null);
  const empty = Children.toArray(children).length === 0;
  const [label, labelRef] = useDismissLabel(empty ? undefined : children, ariaLabel, ref, busy ? strings.stop : strings.send);
  const refs = useComposedRefs(own, labelRef);
  const off = busy ? !onStop : Boolean(disabled);
  // Whether the button was enabled at the last commit. A focusout while the
  // layout effect below has not caught up yet comes from the commit that
  // disabled it.
  const enabled = useRef(false);
  useLayoutEffect(() => {
    enabled.current = own.current ? !own.current.matches(':disabled') : false;
  });
  // A focused button that turns disabled, such as Stop turning back into Send
  // with nothing typed, drops focus to the page: Chromium blurs it at once,
  // during React's commit. Focus goes to the form's text field instead, once
  // the commit is done, unless something else has taken it.
  useEffect(() => {
    const button = own.current;
    if (!button) return;
    const onFocusOut = (event: FocusEvent) => {
      if (event.relatedTarget || !enabled.current || !button.matches(':disabled')) return;
      queueMicrotask(() => {
        const doc = button.ownerDocument;
        if (doc.activeElement && doc.activeElement !== doc.body) return;
        button.form?.querySelector<HTMLTextAreaElement>('textarea:not(:disabled)')?.focus();
      });
    };
    button.addEventListener('focusout', onFocusOut);
    return () => button.removeEventListener('focusout', onFocusOut);
  }, []);
  const handleClick = (event: MouseEvent<HTMLButtonElement>) => {
    // Send and Stop swap under a repeated press: the second click of a double
    // click lands after the swap, so it does nothing rather than act in the
    // other mode.
    if (event.detail > 1) {
      event.preventDefault();
      return;
    }
    if (!busy) return;
    // Stopping clears busy before the browser acts on the click, and the
    // button is a submit button again by then: cancel that, so Stop does not
    // also send what was typed meanwhile.
    event.preventDefault();
    onStop?.();
  };
  // A held Enter clicks once for each repeat, so it would swap back and forth.
  const handleKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (event.key === 'Enter' && event.repeat) event.preventDefault();
  };
  return (
    <Button.Root
      {...props}
      aria-label={label}
      type={busy ? 'button' : 'submit'}
      disabled={off}
      onClick={composeHandlers(onClick, handleClick)}
      onKeyDown={composeHandlers(onKeyDown, handleKeyDown)}
      ref={refs}
      className={cx(styles.submit, className)}
    >
      {empty ? (
        <Button.Icon>{busy ? glyphOr(glyphs.stop, <StopGlyph />) : glyphOr(glyphs.send, <SendGlyph />)}</Button.Icon>
      ) : (
        children
      )}
    </Button.Root>
  );
}

export const Composer = { Root, Submit } as const;
