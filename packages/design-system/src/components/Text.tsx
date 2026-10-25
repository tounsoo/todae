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

/** The element Text.Root renders without `as`. */
export const DEFAULT_AS: TextAs = 'p';

type TextScale = 's' | 'm' | 'l' | 'xl' | '2xl' | 'label';

const HEADING_SIZE: Record<TextHeading, Exclude<TextScale, 'label'>> = {
  h1: '2xl',
  h2: 'xl',
  h3: 'l',
  h4: 'm',
  h5: 'm',
  h6: 's',
};

// A class name can't start with a digit.
const SCALE_CLASS: Record<TextScale, string> = { s: 's', m: 'm', l: 'l', xl: 'xl', '2xl': 'xxl', label: 'label' };

function isHeading(tag: TextAs): tag is TextHeading {
  return Object.hasOwn(HEADING_SIZE, tag);
}

/** `lines` when it can clamp: a whole number of one or more. Anything else clamps nothing. */
export function clampLines(lines: number | undefined): number | undefined {
  return lines !== undefined && Number.isInteger(lines) && lines >= 1 ? lines : undefined;
}

// Each invalid value is reported once, since this logs while rendering.
const reported = /* @__PURE__ */ new Set<number>();

function scaleOf(tag: TextAs, variant: TextVariant | undefined): TextScale {
  if (variant === 'label') return 'label';
  return isHeading(tag) ? HEADING_SIZE[tag] : 'm';
}

function Root({ as: Tag = DEFAULT_AS, variant, tone, weight, lines, className, style, ref, ...props }: TextRootProps) {
  const heading = isHeading(Tag);
  const clamp = clampLines(lines);
  // Logged while rendering, since a server render runs no effects.
  if (process.env.NODE_ENV !== 'production' && lines !== undefined && clamp === undefined && !reported.has(lines)) {
    reported.add(lines);
    console.error(`Text.Root lines must be a whole number of 1 or more; got ${String(lines)}`);
  }
  const classes = cx(
    styles.root,
    heading && styles.heading,
    styles[SCALE_CLASS[scaleOf(Tag, variant)]],
    tone && styles[tone],
    weight && styles[weight],
    clamp !== undefined && styles.clamp,
    className,
  );
  const ownStyle = clamp === undefined ? style : ({ ...style, '--_lines': clamp } as CSSProperties);
  // Each tag's element type extends HTMLElement; the ref is typed to the common base.
  return <Tag {...props} ref={ref as Ref<HTMLParagraphElement>} className={classes} style={ownStyle} />;
}

export const Text = { Root } as const;
