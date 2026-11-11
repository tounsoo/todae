import { useEffect, useLayoutEffect, type ComponentPropsWithRef, type CSSProperties } from 'react';
import { useFieldContext } from './Field.context.js';
import { useRegistryValue } from './fieldRegistry.js';
import { cx } from '../internal/props.js';
import styles from './Field.module.css';
import { useStrings, type Strings } from '../providers/StringsProvider.js';
import { VisuallyHidden } from './VisuallyHidden.js';
import { warnOnce } from '../internal/warnOnce.js';

export type FieldCounterProps = {
  className?: string;
  style?: CSSProperties;
} & Omit<ComponentPropsWithRef<'span'>, 'children'>;

function liveCopy(remaining: number, strings: Strings) {
  return remaining <= 0 ? strings.characterLimitReached : strings.charactersLeft(remaining);
}

export function Counter({ className, ...props }: FieldCounterProps) {
  const ctx = useFieldContext();
  const { registry } = ctx;
  const strings = useStrings();
  const entry = useRegistryValue(
    registry,
    (current) => current.text(),
    (current) => current.serverText(),
  );
  // Counted on commit, so a text control points at the limit before the first paint.
  useLayoutEffect(() => registry.addCounter(), [registry]);
  // After mount, once every text control's layout effect has published.
  useEffect(() => {
    if (!registry.text()) warnOnce('counter-no-input', 'Field.Counter has no Field.TextInput or Field.Textarea');
  });
  if (!entry) return null;
  const count = entry.value.length;
  const max = entry.maxLength;
  const atLimit = max !== undefined && count === max;
  const over = max !== undefined && count > max;
  const remaining = max === undefined ? undefined : max - count;
  return (
    <span
      {...props}
      data-todae-counter=""
      data-limit={atLimit ? '' : undefined}
      data-over={over ? '' : undefined}
      data-invalid={ctx.invalid ? '' : undefined}
      data-disabled={ctx.disabled ? '' : undefined}
      className={cx(styles.counter, className)}
    >
      <span aria-hidden="true">{max === undefined ? String(count) : `${count} / ${max}`}</span>
      {max === undefined ? null : (
        <>
          <VisuallyHidden.Root id={ctx.hintId}>{strings.characterLimit(max)}</VisuallyHidden.Root>
          <VisuallyHidden.Root aria-live="polite">
            {remaining !== undefined && remaining <= 20 ? liveCopy(remaining, strings) : ''}
          </VisuallyHidden.Root>
        </>
      )}
    </span>
  );
}
