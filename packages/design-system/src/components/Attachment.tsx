import { createContext, useContext, useId, useLayoutEffect, useMemo, useRef, useState, type ComponentPropsWithRef } from 'react';
import { useStrings } from '../providers/StringsProvider';
import { Button, type ButtonActionProps } from './Button';
import { useCloseGlyph } from './closeGlyph';
import { useDismissLabel } from './dismissLabel';
import { Progress, type ProgressRootProps } from './Progress';
import { cx, useComposedRefs } from './props';
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

type AttachmentContext = {
  nameId: string;
  name: string | undefined;
  setName: (name: string | undefined) => void;
};

const Context = createContext<AttachmentContext | null>(null);

const ROOT_ATTR = 'data-todae-attachment';
const REMOVE_ATTR = 'data-todae-attachment-remove';

function removeButton(root: Element): HTMLButtonElement | null {
  for (const button of root.querySelectorAll<HTMLButtonElement>(`[${REMOVE_ATTR}]`)) {
    if (!button.disabled && button.closest(`[${ROOT_ATTR}]`) === root && button.checkVisibility()) return button;
  }
  return null;
}

function attachmentIn(el: Element): Element | null {
  return el.matches(`[${ROOT_ATTR}]`) ? el : el.querySelector(`:scope > [${ROOT_ATTR}]`);
}

/**
 * Where focus goes when an attachment holding it is removed: the remove button
 * of the next attachment beside it, else the one before. Beside it means a
 * sibling element, or, for an attachment that is an `li`'s only child, the
 * attachment in another `li` of the same list, so focus stays among the same
 * files.
 */
function focusNeighbor(root: HTMLElement) {
  const parent = root.parentElement;
  if (!parent) return;
  const item = parent.localName === 'li' && parent.childElementCount === 1 ? parent : root;
  const siblings = [...(item.parentElement?.children ?? [])];
  const index = siblings.indexOf(item);
  for (const sibling of [...siblings.slice(index + 1), ...siblings.slice(0, index).reverse()]) {
    const other = attachmentIn(sibling);
    const button = other && removeButton(other);
    if (button) {
      button.focus();
      return;
    }
  }
}

function useAttachment(part: string): AttachmentContext {
  const context = useContext(Context);
  if (!context) throw new Error(`Attachment.${part} must be rendered inside Attachment.Root`);
  return context;
}

function Root({ className, status = 'ready', ref, ...props }: AttachmentRootProps) {
  const own = useRef<HTMLDivElement>(null);
  const refs = useComposedRefs(own, ref);
  const nameId = useId();
  const [name, setName] = useState<string | undefined>(undefined);
  const context = useMemo(() => ({ nameId, name, setName }), [nameId, name]);
  // Layout cleanup runs before React takes the element out, so focus is still
  // inside it then.
  useLayoutEffect(() => {
    const root = own.current;
    return () => {
      if (root && root.contains(document.activeElement)) focusNeighbor(root);
    };
  }, []);
  return (
    <Context.Provider value={context}>
      <div
        role="group"
        aria-labelledby={name === undefined ? undefined : nameId}
        {...props}
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

function Name({ className, children, ...props }: AttachmentNameProps) {
  const { nameId, setName } = useAttachment('Name');
  if (process.env.NODE_ENV !== 'production' && typeof children !== 'string') {
    console.error('Attachment.Name children must be a string');
  }
  const name = String(children);
  useLayoutEffect(() => {
    setName(name);
  }, [name, setName]);
  useLayoutEffect(() => () => setName(undefined), [setName]);
  return (
    <span id={nameId} {...props} className={cx(styles.name, className)}>
      {name}
    </span>
  );
}

function Meta({ className, ...props }: AttachmentMetaProps) {
  useAttachment('Meta');
  return <span {...props} className={cx(styles.meta, className)} />;
}

function AttachmentProgress({ className, ...props }: AttachmentProgressProps) {
  const { nameId, name } = useAttachment('Progress');
  const named = props['aria-label'] || props['aria-labelledby'];
  return (
    <Progress.Root
      aria-labelledby={named || name === undefined ? undefined : nameId}
      {...props}
      className={cx(styles.progress, className)}
    />
  );
}

function Remove({ 'aria-label': ariaLabel, className, children, ref, ...props }: AttachmentRemoveProps) {
  const { name } = useAttachment('Remove');
  const { removeAttachment } = useStrings();
  const [label, refs] = useDismissLabel(children, ariaLabel, ref, removeAttachment(name ?? ''));
  const glyph = useCloseGlyph();
  return (
    <Button.Root
      variant="ghost"
      tooltip={children == null ? false : undefined}
      aria-label={label}
      {...props}
      ref={refs}
      {...{ [REMOVE_ATTR]: '' }}
      className={cx(styles.remove, className)}
    >
      {children ?? glyph}
    </Button.Root>
  );
}

export const Attachment = { Root, Preview, Name, Meta, Progress: AttachmentProgress, Remove } as const;
