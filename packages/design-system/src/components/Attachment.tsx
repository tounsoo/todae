import {
  Children,
  createContext,
  useCallback,
  useContext,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ComponentPropsWithRef,
  type MouseEvent,
} from 'react';
import { isReachable } from '../hooks/useRovingFocus';
import { useStrings } from '../providers/StringsProvider';
import { Button, type ButtonActionProps } from './Button';
import { useCloseGlyph } from './closeGlyph';
import { useDismissLabel } from './dismissLabel';
import { useDomId } from './domId';
import { Progress, type ProgressRootProps } from './Progress';
import { composeHandlers, cx, useComposedRefs } from './props';
import { focusWithoutScroll } from './revealRing';
import styles from './Attachment.module.css';

/** Where the file is: `ready` to send or open, `uploading`, or failed with an `error`. */
export type AttachmentStatus = 'ready' | 'uploading' | 'error';

/**
 * One file in a composer or a message: a group named by Attachment.Name. The
 * upload itself is product code; this shows its state.
 */
export type AttachmentRootProps = ComponentPropsWithRef<'div'> & {
  /** Sets `data-status`. An `error` takes the attachment.border.error and attachment.meta.fg.error tokens. Default `ready`. */
  status?: AttachmentStatus;
};
/** A thumbnail, such as an `img` with `alt=""`, or an icon of the file's type. */
export type AttachmentPreviewProps = ComponentPropsWithRef<'div'>;
export type AttachmentNameProps = Omit<ComponentPropsWithRef<'span'>, 'children'> & {
  /** The file's name. Text only: it names the group and the remove button. */
  children: string;
};
/** Size, type, or what went wrong. */
export type AttachmentMetaProps = ComponentPropsWithRef<'span'>;
/** A Progress.Root named by Attachment.Name unless it has a name of its own. */
export type AttachmentProgressProps = ProgressRootProps;
/** A Button.Root that removes the file. With no content it shows the close glyph. */
export type AttachmentRemoveProps = ButtonActionProps;

type Named = { id: string; text: string };

type AttachmentContext = {
  named: Named | undefined;
  setNamed: (named: Named | undefined) => void;
  /** Called when Attachment.Remove is pressed, so the unmount that follows hands focus on. */
  removing: () => void;
};

const Context = createContext<AttachmentContext | null>(null);

const ROOT_ATTR = 'data-todae-attachment';
const REMOVE_ATTR = 'data-todae-attachment-remove';

function useAttachment(part: string): AttachmentContext {
  const context = useContext(Context);
  if (!context) throw new Error(`Attachment.${part} must be rendered inside Attachment.Root`);
  return context;
}

function removeButton(root: Element): HTMLButtonElement | null {
  for (const button of root.querySelectorAll<HTMLButtonElement>(`[${REMOVE_ATTR}]`)) {
    if (!button.disabled && button.closest(`[${ROOT_ATTR}]`) === root && isReachable(button)) return button;
  }
  return null;
}

function attachmentIn(el: Element): Element | null {
  return el.matches(`[${ROOT_ATTR}]`) ? el : el.querySelector(`:scope > [${ROOT_ATTR}]`);
}

/** The focused element in the document or shadow root that holds `el`. */
function activeIn(el: Element): Element | null {
  const node = el.getRootNode();
  return node instanceof Document || node instanceof ShadowRoot ? node.activeElement : null;
}

/**
 * After a remove press, focus goes to the remove button of the next
 * attachment beside this one, else the one before. Beside it means a sibling
 * element, or, for an attachment that is an `li`'s only child, the attachment
 * in another `li` of the same list, so focus stays among the same files.
 */
function focusNeighbor(root: HTMLElement) {
  const active = activeIn(root);
  // Focus went somewhere else since the press: leave it there.
  if (active && active !== root.ownerDocument.body && !root.contains(active)) return;
  const parent = root.parentElement;
  if (!parent) return;
  const item = parent.localName === 'li' && parent.childElementCount === 1 ? parent : root;
  const siblings = [...(item.parentElement?.children ?? [])];
  const index = siblings.indexOf(item);
  for (const sibling of [...siblings.slice(index + 1), ...siblings.slice(0, index).reverse()]) {
    const other = attachmentIn(sibling);
    const button = other && removeButton(other);
    if (!button) continue;
    button.focus();
    if (activeIn(root) === button) return;
  }
}

/** The part's own name wins; else Attachment.Name's id names it. */
function labelledBy(props: { 'aria-label'?: string; 'aria-labelledby'?: string }, named: Named | undefined) {
  return props['aria-labelledby'] ?? (props['aria-label'] ? undefined : named?.id);
}

function Root({ className, status = 'ready', ref, ...props }: AttachmentRootProps) {
  const own = useRef<HTMLDivElement>(null);
  const refs = useComposedRefs(own, ref);
  const [named, setNamed] = useState<Named | undefined>(undefined);
  const pressed = useRef(false);
  const removing = useCallback(() => {
    pressed.current = true;
  }, []);
  const context = useMemo(() => ({ named, setNamed, removing }), [named, removing]);
  // Layout cleanup runs before React takes the element out, so focus is still
  // inside it then. Only an unmount after a remove press hands focus on, not a
  // remount for a new key or a StrictMode check.
  useLayoutEffect(() => {
    const root = own.current;
    return () => {
      if (root && pressed.current) focusNeighbor(root);
    };
  }, []);
  // A press that removed nothing, such as one the product confirms first,
  // stops counting once focus leaves the attachment.
  const onBlur = composeHandlers(props.onBlur, (event) => {
    if (!event.currentTarget.contains(event.relatedTarget as Node | null)) pressed.current = false;
  });
  return (
    <Context.Provider value={context}>
      <div
        role="group"
        {...props}
        aria-labelledby={labelledBy(props, named)}
        onBlur={onBlur}
        ref={refs}
        {...{ [ROOT_ATTR]: '' }}
        data-status={status}
        className={cx(styles.root, className)}
      />
    </Context.Provider>
  );
}

function Preview({ className, ...props }: AttachmentPreviewProps) {
  useAttachment('Preview');
  return <div {...props} className={cx(styles.preview, className)} />;
}

function Name({ className, children, id: idProp, ...props }: AttachmentNameProps) {
  const { setNamed } = useAttachment('Name');
  const uid = useDomId();
  const id = idProp ?? uid;
  if (process.env.NODE_ENV !== 'production' && typeof children !== 'string') {
    console.error('Attachment.Name children must be a string');
  }
  const text = Children.toArray(children).join('');
  useLayoutEffect(() => {
    setNamed({ id, text });
    return () => setNamed(undefined);
  }, [id, text, setNamed]);
  return (
    <span {...props} id={id} className={cx(styles.name, className)}>
      {text}
    </span>
  );
}

function Meta({ className, ...props }: AttachmentMetaProps) {
  useAttachment('Meta');
  return <span {...props} className={cx(styles.meta, className)} />;
}

function AttachmentProgress({ className, ...props }: AttachmentProgressProps) {
  const { named } = useAttachment('Progress');
  return <Progress.Root {...props} aria-labelledby={labelledBy(props, named)} className={cx(styles.progress, className)} />;
}

function Remove({ 'aria-label': ariaLabel, className, children, ref, onClick, ...props }: AttachmentRemoveProps) {
  const { named, removing } = useAttachment('Remove');
  const { removeAttachment } = useStrings();
  const [label, refs] = useDismissLabel(children, ariaLabel, ref, removeAttachment(named?.text ?? ''));
  const glyph = useCloseGlyph();
  const handleClick = composeHandlers(onClick, (event: MouseEvent<HTMLButtonElement>) => {
    // A click does not focus a button in every browser (Safari). Focus the
    // pressed button, so focus moves on when its attachment leaves.
    const button = event.currentTarget;
    if (activeIn(button) !== button) focusWithoutScroll(button);
    removing();
  });
  return (
    <Button.Root
      variant="ghost"
      tooltip={children == null ? false : undefined}
      aria-label={label}
      {...props}
      onClick={handleClick}
      ref={refs}
      {...{ [REMOVE_ATTR]: '' }}
      className={cx(styles.remove, className)}
    >
      {children ?? glyph}
    </Button.Root>
  );
}

export const Attachment = { Root, Preview, Name, Meta, Progress: AttachmentProgress, Remove } as const;
