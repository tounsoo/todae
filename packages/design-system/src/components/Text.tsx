import type { CSSProperties, HTMLAttributes, Ref } from 'react';
import { cx } from './cx.js';
import styles from './Text.module.css';

export type TextHeading = 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6';
export type TextAs = 'p' | 'span' | 'strong' | TextHeading;
export type TextVariant = 'label';
export type TextTone = 'default' | 'muted' | 'accent';
export type TextWeight = 'regular' | 'medium' | 'bold';

export type TextRootProps = {
  as?: TextAs;
  variant?: TextVariant;
  tone?: TextTone;
  weight?: TextWeight;
  lines?: number;
  ref?: Ref<HTMLElement>;
} & HTMLAttributes<HTMLElement>;

export const DEFAULT_AS: TextAs = 'p';

const HEADINGS: ReadonlySet<string> = new Set(['h1', 'h2', 'h3', 'h4', 'h5', 'h6']);

function isHeading(tag: TextAs): tag is TextHeading {
  return HEADINGS.has(tag);
}

/** `lines` when it can clamp: a whole number of one or more. Anything else clamps nothing. */
export function clampLines(lines: number | undefined): number | undefined {
  return lines !== undefined && Number.isInteger(lines) && lines >= 1 ? lines : undefined;
}

const reported = /* @__PURE__ */ new Set<number>();
const reportedSizes = /* @__PURE__ */ new Set<string>();

function Root({ as: Tag = DEFAULT_AS, variant, tone, weight, lines, className, style, ref, ...props }: TextRootProps) {
  const heading = isHeading(Tag);
  const clamp = clampLines(lines);
  const domProps = omitLegacySize(props);
  if (process.env.NODE_ENV !== 'production' && lines !== undefined && clamp === undefined && !reported.has(lines)) {
    reported.add(lines);
    console.error(`Text.Root lines must be a whole number of 1 or more; got ${String(lines)}`);
  }
  const classes = cx(
    styles.root,
    heading && styles.heading,
    variant === 'label' && styles.label,
    tone && styles[tone],
    weight && styles[weight],
    clamp !== undefined && styles.clamp,
    className,
  );
  const ownStyle = clamp === undefined ? style : ({ ...style, '--_lines': clamp } as CSSProperties);
  return <Tag {...domProps} ref={ref as Ref<HTMLParagraphElement>} className={classes} style={ownStyle} />;
}

function omitLegacySize(props: TextRootProps): TextRootProps {
  if (!('size' in props)) return props;
  const { size, ...rest } = props as TextRootProps & { size?: unknown };
  if (process.env.NODE_ENV !== 'production' && size != null && !reportedSizes.has(String(size))) {
    reportedSizes.add(String(size));
    console.error(
      `Text.Root no longer takes size; got ${String(size)}. Use variant="label" for the label role. Body draws at text.font.size (--todae-text-font-size). Set that variable on the element or an ancestor, or override text.font.size in the theme. An appearance or density attribute, or a scoped theme root, between that ancestor and the text declares the size token again. For a one-off size, set font-size from a font.size.* variable (--todae-font-size-*) in your CSS.`,
    );
  }
  return rest;
}

export const Text = { Root } as const;
