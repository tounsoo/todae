import { useMemo, useRef, type ChangeEvent, type CSSProperties, type Ref, type TextareaHTMLAttributes } from 'react';
import { mergeDescribedBy, useFieldContext } from './Field.context';
import { composeHandlers, cx, useComposedRefs } from './props';
import styles from './Field.module.css';
import { resolveTextareaRows } from './textareaRows';
import { TextareaHighlights, useTextareaHighlights, type FieldTextareaHighlight } from './TextareaHighlights';
import { mergeAnchorNames } from '../overlay/anchorName';
import { useField } from '../hooks/useField';
import { useTextEntry } from './Field.shared';

export type FieldTextareaProps = {
  value: string;
  onChange: (event: ChangeEvent<HTMLTextAreaElement>) => void;
  onValueChange?: (value: string) => void;
  placeholder?: string;
  rows?: number;
  maxRows?: number;
  autoGrow?: boolean;
  /** Ranges of the text drawn as tokens on a layer behind it, such as the mentions useMentions tracks. */
  highlights?: readonly FieldTextareaHighlight[];
  ref?: Ref<HTMLTextAreaElement>;
} & Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, 'value' | 'disabled' | 'onChange' | 'rows' | 'cols'>;

export function Textarea({
  value,
  onChange,
  onValueChange,
  rows: rowsProp,
  maxRows: maxRowsProp,
  autoGrow = false,
  highlights,
  className,
  style,
  maxLength,
  'aria-describedby': describedBy,
  onScroll,
  ref,
  ...props
}: FieldTextareaProps) {
  const field = useField();
  const own = useRef<HTMLTextAreaElement | null>(null);
  const textareaRef = useComposedRefs(own, ref);
  const layer = useTextareaHighlights(own, highlights !== undefined);
  const ctx = useFieldContext();
  const resolved = useMemo(
    () => resolveTextareaRows({ rows: rowsProp, maxRows: maxRowsProp }),
    [rowsProp, maxRowsProp],
  );
  const limit = typeof maxLength === 'number' ? maxLength : undefined;
  const counterMounted = useTextEntry(ctx.store, value, limit);
  const hint = counterMounted && limit !== undefined ? ctx.hintId : undefined;
  const textarea = (
    <textarea
      {...field.getControlProps({ ...props, ref: textareaRef, 'aria-describedby': mergeDescribedBy(describedBy, hint) })}
      maxLength={maxLength}
      value={value}
      rows={resolved.rows}
      data-auto-grow={autoGrow ? '' : undefined}
      data-max-rows={resolved.maxRows}
      data-highlighted={highlights !== undefined ? '' : undefined}
      className={cx(styles.textarea, className)}
      style={
        {
          ...style,
          '--_text-rows': resolved.rows,
          '--_max-rows': resolved.maxRows,
          ...(highlights !== undefined ? { anchorName: mergeAnchorNames(style?.anchorName, layer.anchorName) } : null),
        } as CSSProperties
      }
      onChange={(event) => {
        onChange(event);
        onValueChange?.(event.target.value);
      }}
      onScroll={composeHandlers(onScroll, layer.onScroll)}
    />
  );
  if (highlights === undefined) return textarea;
  return (
    <>
      {textarea}
      <TextareaHighlights ref={layer.ref} anchorName={layer.anchorName} value={value} highlights={highlights} />
    </>
  );
}
