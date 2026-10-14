import { createContext, useContext, type ComponentPropsWithRef } from 'react';
import { useGlyphs } from '../providers/GlyphsProvider';
import { useStrings } from '../providers/StringsProvider';
import { cx } from './cx';
import { CheckGlyph, ErrorGlyph, glyphOr } from './glyphs';
import { Spinner } from './Spinner';
import { VisuallyHidden } from './VisuallyHidden';
import styles from './Steps.module.css';

/** Where a step is: `done`, the `current` one running now, `pending`, or stopped with an `error`. */
export type StepsStatus = 'done' | 'current' | 'pending' | 'error';

/**
 * An ordered list of steps, such as an agent's plan or a checklist. The order
 * is the list's; each Steps.Item says where it is.
 */
export type StepsRootProps = ComponentPropsWithRef<'ol'>;

/** One step: a marker for its status, then its content. */
export type StepsItemProps = ComponentPropsWithRef<'li'> & {
  /** Sets `data-status` and the marker. A `current` step takes `aria-current="step"`. Default `pending`. */
  status?: StepsStatus;
  /** The hidden status word read before the step, in place of the StringsProvider one when not empty. */
  statusLabel?: string;
};

const InRoot = createContext(false);

function Root({ className, ...props }: StepsRootProps) {
  return (
    <InRoot.Provider value={true}>
      {/* Safari drops the list role from a list without markers; role="list" keeps it. */}
      <ol role="list" {...props} className={cx(styles.root, className)} />
    </InRoot.Provider>
  );
}

const STATUS_STRING = {
  done: 'stepDone',
  current: 'stepCurrent',
  pending: 'stepPending',
  error: 'stepError',
} as const;

function Item({ status = 'pending', statusLabel, className, children, ...props }: StepsItemProps) {
  if (!useContext(InRoot)) throw new Error('Steps.Item must be rendered inside Steps.Root');
  const strings = useStrings();
  const glyphs = useGlyphs();
  const word = statusLabel || strings[STATUS_STRING[status]];
  return (
    <li
      {...props}
      aria-current={status === 'current' ? 'step' : props['aria-current']}
      data-status={status}
      className={cx(styles.item, className)}
    >
      <span className={styles.marker} aria-hidden="true">
        {status === 'current' ? <Spinner.Root className={styles.spinner} /> : null}
        {status === 'done' ? <span data-todae-glyph="">{glyphOr(glyphs.check, <CheckGlyph />)}</span> : null}
        {status === 'error' ? <span data-todae-glyph="">{glyphOr(glyphs.error, <ErrorGlyph />)}</span> : null}
      </span>
      <div className={styles.content}>
        {word ? <VisuallyHidden.Root>{`${word}: `}</VisuallyHidden.Root> : null}
        {children}
      </div>
    </li>
  );
}

export const Steps = { Root, Item } as const;
