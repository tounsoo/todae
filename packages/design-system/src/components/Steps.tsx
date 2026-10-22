import { createContext, useContext, type ComponentPropsWithRef } from 'react';
import { useGlyphs } from '../providers/GlyphsProvider.js';
import { useStrings } from '../providers/StringsProvider.js';
import { cx } from './cx.js';
import { CheckGlyph, ErrorGlyph, glyphOr } from './glyphs.js';
import { Loader } from './Loader.js';
import { VisuallyHidden } from './VisuallyHidden.js';
import styles from './Steps.module.css';

/** Where a step is: `done`, the `current` one running now, `pending`, or stopped with an `error`. */
export type StepsStatus = 'done' | 'current' | 'pending' | 'error';

/**
 * `plan` is work that runs: the current step spins and done steps are struck
 * through. `progress` is where a person is in a form: the current step is a
 * still marker and done steps keep their text.
 */
export type StepsVariant = 'plan' | 'progress';

/**
 * An ordered list of steps, such as an agent's plan, a checklist or the steps
 * of a form. The order is the list's; each Steps.Item says where it is.
 */
export type StepsRootProps = ComponentPropsWithRef<'ol'> & {
  /** How the steps are drawn. Sets `data-variant`. Default `plan`. */
  variant?: StepsVariant;
};

/** One step: a marker for its status, then its content. */
export type StepsItemProps = ComponentPropsWithRef<'li'> & {
  /** Sets `data-status` and the marker. A `current` step takes `aria-current="step"`. Default `pending`. */
  status?: StepsStatus;
  /** The hidden status word read before the step, in place of the StringsProvider one when not empty. */
  statusLabel?: string;
};

// The Root's variant, or null outside a Root.
const InRoot = /* @__PURE__ */ createContext<StepsVariant | null>(null);

function Root({ variant = 'plan', className, ...props }: StepsRootProps) {
  return (
    <InRoot.Provider value={variant}>
      {/* Safari drops the list role from a list without markers; role="list" keeps it. */}
      <ol role="list" {...props} data-variant={variant} className={cx(styles.root, className)} />
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
  const variant = useContext(InRoot);
  if (!variant) throw new Error('Steps.Item must be rendered inside Steps.Root');
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
        {status === 'current' && variant === 'plan' ? <Loader.Root className={styles.spinner} /> : null}
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
