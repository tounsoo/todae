import { useId, type ComponentPropsWithRef, type ReactElement, type ReactNode } from 'react';
import { useGlyphs } from '../providers/GlyphsProvider.js';
import { ChevronGlyph, glyphOr, hasGlyph } from './glyphs.js';
import { cx } from './props.js';
import type { LinkRenderProps } from './Link.js';
import styles from './Nav.module.css';

/** A `nav` landmark. Name it with `aria-label` or `aria-labelledby` when the page has more than one. */
export type NavRootProps = ComponentPropsWithRef<'nav'>;

/** A list of Nav.Item elements, named by its `label` when it has one. `aria-label` and `aria-labelledby` name the list too, in place of the label. */
export type NavGroupProps = {
  /** Text shown above the list, which also names it for screen readers. */
  label?: ReactNode;
  children?: ReactNode;
  className?: string;
} & Omit<ComponentPropsWithRef<'div'>, 'children'>;

/** One entry: a Nav.Link, a Nav.Branch, or a Nav.Link followed by the Nav.Branch of its child pages. */
export type NavItemProps = ComponentPropsWithRef<'li'>;

/**
 * A row link. Mark the page you are on with `aria-current="page"`. Renders an
 * `a`, or whatever `render` returns, such as a router's link.
 */
export type NavLinkProps = {
  render?: (props: LinkRenderProps) => ReactElement;
} & ComponentPropsWithRef<'a'>;

/**
 * A native `details` holding a nested list of Nav.Item elements. Its toggle
 * shows `label`, or after a Nav.Link in the same item, only a chevron that
 * `label` names for screen readers.
 */
export type NavBranchProps = {
  /** The toggle's text. After a Nav.Link it is visually hidden, so name the child pages, such as "Field pages". */
  label: ReactNode;
  children?: ReactNode;
  className?: string;
} & Omit<ComponentPropsWithRef<'details'>, 'children'>;

function Root({ className, ...props }: NavRootProps) {
  return <nav {...props} className={cx(styles.root, className)} />;
}

function Group({ label, children, className, 'aria-label': ariaLabel, 'aria-labelledby': labelledby, ...props }: NavGroupProps) {
  const labelId = useId();
  const labelled = hasGlyph(label);
  return (
    <div {...props} className={cx(styles.group, className)}>
      {labelled ? (
        <span id={labelId} className={styles.label}>
          {label}
        </span>
      ) : null}
      {/* Safari drops the list role from a list without markers; role="list" keeps it. A name goes on the list, not the div. */}
      <ul
        role="list"
        aria-label={ariaLabel}
        aria-labelledby={labelledby ?? (labelled && !ariaLabel ? labelId : undefined)}
        className={styles.list}
      >
        {children}
      </ul>
    </div>
  );
}

function Item({ className, ...props }: NavItemProps) {
  return <li {...props} className={cx(styles.item, className)} />;
}

function Link({ render, className, ...props }: NavLinkProps) {
  const own = { ...props, className: cx(styles.link, className) };
  return render ? render(own) : <a {...own} />;
}

function Branch({ label, children, className, ...props }: NavBranchProps) {
  const { chevron } = useGlyphs();
  return (
    <details {...props} className={cx(styles.branch, className)}>
      <summary className={styles.toggle}>
        <span className={styles.toggleLabel}>{label}</span>
        <span className={styles.chevron} data-todae-glyph="" aria-hidden="true">
          {glyphOr(chevron, <ChevronGlyph />)}
        </span>
      </summary>
      <ul role="list" className={styles.list}>
        {children}
      </ul>
    </details>
  );
}

export const Nav = { Root, Group, Item, Link, Branch } as const;
