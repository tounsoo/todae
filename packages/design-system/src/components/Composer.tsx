import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  type ComponentPropsWithRef,
  type KeyboardEvent,
  type MouseEvent,
} from 'react';
import { useGlyphs } from '../providers/GlyphsProvider';
import { useStrings } from '../providers/StringsProvider';
import { Button, type ButtonActionProps } from './Button';
import { glyphOr, SendGlyph, StopGlyph } from './glyphs';
import { composeHandlers, cx, useComposedRefs } from './props';
import styles from './Composer.module.css';

/**
 * The prompt input of a chat: a `form` around a Field.Root that holds a
 * Field.Textarea. Enter in a textarea of the form sends it; Shift+Enter adds a
 * line.
 */
export type ComposerRootProps = ComponentPropsWithRef<'form'> & {
  /** A response is running: Enter sends nothing, and Composer.Submit turns into Stop. Sets `data-busy`. */
  busy?: boolean;
};
/** A Button.Root that sends the form, or stops the response while the composer is busy. With no content it shows the send or stop glyph. */
export type ComposerSubmitProps = ButtonActionProps & {
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

/** The button implicit submission would press: the form's first submit button. */
function defaultButton(form: HTMLFormElement): HTMLButtonElement | HTMLInputElement | undefined {
  for (const el of form.elements) {
    if (el instanceof HTMLButtonElement && el.type === 'submit') return el;
    if (el instanceof HTMLInputElement && (el.type === 'submit' || el.type === 'image')) return el;
  }
  return undefined;
}

function Root({ busy = false, className, onKeyDown, ...props }: ComposerRootProps) {
  const context = useMemo(() => ({ busy }), [busy]);
  const handleKeyDown = (event: KeyboardEvent<HTMLFormElement>) => {
    const target = event.target;
    if (!(target instanceof HTMLTextAreaElement) || target.form !== event.currentTarget) return;
    if (event.key !== 'Enter' || event.shiftKey || event.altKey || event.ctrlKey || event.metaKey) return;
    // Enter that ends an IME composition, such as a Korean or Japanese word,
    // only commits the word. Safari sends it after compositionend, with keyCode 229.
    if (event.nativeEvent.isComposing || event.keyCode === 229) return;
    if (event.defaultPrevented || target.readOnly || target.disabled) return;
    event.preventDefault();
    if (busy) return;
    const form = event.currentTarget;
    const button = defaultButton(form);
    // As implicit submission does: a disabled default button sends nothing.
    if (button?.disabled) return;
    form.requestSubmit(button);
  };
  return (
    <Context.Provider value={context}>
      <form
        {...props}
        onKeyDown={composeHandlers(onKeyDown, handleKeyDown)}
        data-busy={busy ? '' : undefined}
        className={cx(styles.root, className)}
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
  onStop,
  ref,
  ...props
}: ComposerSubmitProps) {
  const { busy } = useComposer('Submit');
  const strings = useStrings();
  const glyphs = useGlyphs();
  const own = useRef<HTMLButtonElement>(null);
  const refs = useComposedRefs(own, ref);
  const off = busy ? !onStop : Boolean(disabled);
  // A focused button that turns disabled, such as Stop turning back into Send
  // with nothing typed, drops focus to the page: Chromium blurs it at once,
  // during React's commit. Focus goes to the form's text field instead, once
  // the commit is done, unless something else has taken it.
  useEffect(() => {
    const button = own.current;
    if (!button) return;
    const onFocusOut = (event: FocusEvent) => {
      if (!button.disabled || event.relatedTarget) return;
      queueMicrotask(() => {
        const doc = button.ownerDocument;
        if (doc.activeElement && doc.activeElement !== doc.body) return;
        button.form?.querySelector<HTMLTextAreaElement>('textarea:not(:disabled)')?.focus();
      });
    };
    button.addEventListener('focusout', onFocusOut);
    return () => button.removeEventListener('focusout', onFocusOut);
  }, []);
  const handleClick = () => {
    if (busy) onStop?.();
  };
  const name = ariaLabel ?? (children == null ? (busy ? strings.stop : strings.send) : undefined);
  return (
    <Button.Root
      {...props}
      aria-label={name}
      type={busy ? 'button' : 'submit'}
      disabled={off}
      onClick={composeHandlers<MouseEvent<HTMLButtonElement>>(onClick, handleClick)}
      ref={refs}
      className={cx(styles.submit, className)}
    >
      {children ?? (
        <Button.Icon>{busy ? glyphOr(glyphs.stop, <StopGlyph />) : glyphOr(glyphs.send, <SendGlyph />)}</Button.Icon>
      )}
    </Button.Root>
  );
}

export const Composer = { Root, Submit } as const;
