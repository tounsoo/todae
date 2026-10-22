import {
  Children,
  createContext,
  useContext,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ComponentPropsWithRef,
  type MouseEvent,
} from 'react';
import { isReachable } from '../overlay/tabbables.js';
import { useStrings } from '../providers/StringsProvider.js';
import { Button, type ButtonActionProps } from './Button.js';
import { useCloseGlyph } from './closeGlyph.js';
import { useButtonName } from './buttonName.js';
import { useDomId } from './domId.js';
import { Progress, type ProgressRootProps } from './Progress.js';
import { cx, useComposedRefs } from './props.js';
import { activeIn, focusLost } from '../hooks/activeElement.js';
import { focusWithoutScroll } from './revealRing.js';
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
};

const Context = /* @__PURE__ */ createContext<AttachmentContext | null>(null);

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

/** The attachment an item holds: the item itself, or the one inside an `li`. */
function attachmentIn(el: Element): Element | null {
  return el.matches(`[${ROOT_ATTR}]`) ? el : el.querySelector(`:scope > [${ROOT_ATTR}]`);
}

/**
 * Called as an attachment holding focus unmounts, while it is still in the
 * page. Once the commit is done, if the attachment is gone and
 * nothing else has focus, focus goes to the remove button of the attachment
 * now in its place, else the one before. The items are the parent's children,
 * or the `li`s of a list when the attachment is an `li`'s only child, so focus
 * stays among the same files.
 */
function handOffFocus(root: HTMLElement) {
  const parent = root.parentElement;
  if (!parent) return;
  const item = parent.localName === 'li' && parent.childElementCount === 1 ? parent : root;
  const list = item.parentElement;
  if (!list) return;
  const items = () => [...list.children].filter((child) => attachmentIn(child));
  const slot = items().indexOf(item);
  const doc = root.ownerDocument;
  queueMicrotask(() => {
    // Still there: a StrictMode check, or a hidden Suspense or Activity tree.
    if (root.isConnected || !list.isConnected) return;
    if (!focusLost(doc)) return;
    const now = items();
    for (const other of [...now.slice(slot), ...now.slice(0, slot).reverse()]) {
      const button = removeButton(attachmentIn(other)!);
      if (!button) continue;
      button.focus();
      if (activeIn(button) === button) return;
    }
  });
}

/** The part's own name wins; else Attachment.Name's id names it. */
function labelledBy(props: { 'aria-label'?: string; 'aria-labelledby'?: string }, named: Named | undefined) {
  return props['aria-labelledby'] || (props['aria-label'] ? undefined : named?.id);
}

function Root({ className, status = 'ready', ref, ...props }: AttachmentRootProps) {
  const own = useRef<HTMLDivElement>(null);
  const refs = useComposedRefs(own, ref);
  const [named, setNamed] = useState<Named | undefined>(undefined);
  const context = useMemo(() => ({ named, setNamed }), [named]);
  // Layout cleanup runs before React takes the element out, so focus is still
  // inside it then; the hand-off itself waits until the commit is done.
  useLayoutEffect(() => {
    const root = own.current;
    return () => {
      if (root && root.contains(activeIn(root))) handOffFocus(root);
    };
  }, []);
  return (
    <Context.Provider value={context}>
      <div
        role="group"
        {...props}
        aria-labelledby={labelledBy(props, named)}
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
  const id = idProp || uid;
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
  const { named } = useAttachment('Remove');
  const { removeAttachment } = useStrings();
  const [label, refs] = useButtonName(children, ariaLabel, ref, removeAttachment(named?.text ?? ''));
  const glyph = useCloseGlyph();
  const handleClick = (event: MouseEvent<HTMLButtonElement>) => {
    // A click does not focus a button in every browser (Safari). Focus the
    // pressed button before the product's handler, which may remove the
    // attachment at once or move focus itself, so focus moves on when the
    // attachment leaves.
    const button = event.currentTarget;
    if (activeIn(button) !== button) focusWithoutScroll(button);
    onClick?.(event);
  };
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
