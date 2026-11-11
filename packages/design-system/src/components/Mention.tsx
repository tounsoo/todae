import { createElement, type ComponentPropsWithRef, type ReactNode } from 'react';
import { useMentionPeek } from '../hooks/useMentionPeek.js';
import type { MentionPeekContext, MentionSource } from '../mentions/source.js';
import { mergeDescribedBy } from './Field.context.js';
import { PopoverSurface } from './Popover.js';
import { composeHandlers, cx, useComposedRefs } from '../internal/props.js';
import styles from './Mention.module.css';

export type MentionRootProps<T = unknown> = Omit<ComponentPropsWithRef<'button'>, 'type' | 'children'> & {
  source: MentionSource<T>;
  id: string;
  children?: ReactNode;
};

function textOf(children: ReactNode, id: string): string {
  if (typeof children === 'string' || typeof children === 'number') return String(children);
  return id;
}

function PeekBody<T>({
  source,
  loading,
  entity,
  context,
}: {
  source: MentionSource<T>;
  loading: boolean;
  entity: T | undefined;
  context: MentionPeekContext;
}) {
  return (
    <>
      {loading ? <span data-loading="" aria-hidden="true" /> : null}
      {entity !== undefined ? source.renderPeek?.(entity, context) : null}
    </>
  );
}

function Root<T>({
  source,
  id,
  children,
  className,
  ref,
  onClick,
  onKeyDown,
  onFocus,
  onBlur,
  onPointerEnter,
  onPointerLeave,
  'aria-describedby': describedBy,
  ...props
}: MentionRootProps<T>) {
  const peek = useMentionPeek({ source, id, text: textOf(children, id) });
  const href = source.href?.(id, peek.entity);
  const refs = useComposedRefs(ref, peek.triggerProps.ref);
  const trigger = createElement(
    href ? 'a' : 'button',
    {
      ...props,
      ...peek.triggerProps,
      ...(href ? { href } : { type: 'button' as const }),
      ref: refs,
      className: cx(styles.root, className),
      onClick: composeHandlers(onClick, peek.triggerProps.onClick),
      onKeyDown: composeHandlers(onKeyDown, peek.triggerProps.onKeyDown),
      onFocus: composeHandlers(onFocus, peek.triggerProps.onFocus),
      onBlur: composeHandlers(onBlur, peek.triggerProps.onBlur),
      onPointerEnter: composeHandlers(onPointerEnter, peek.triggerProps.onPointerEnter),
      onPointerLeave: composeHandlers(onPointerLeave, peek.triggerProps.onPointerLeave),
      'aria-describedby': mergeDescribedBy(describedBy, peek.triggerProps['aria-describedby']),
    },
    children,
  );
  // The peek is a span, a phrasing element, so a mention can sit inside a
  // paragraph: it stays mounted while closed, and a closed <div> would make
  // the HTML parser end a server-rendered <p> early. Its content renders from
  // its first open, as every popover's does, so server HTML holds an empty
  // span, and it stays once the peek closes, so the card fades out with what
  // it showed, not empty.
  // A component, not a call here, so renderPeek runs only once the peek has mounted its content.
  const body = <PeekBody source={source} loading={peek.loading} entity={peek.entity} context={peek.context} />;
  const card =
    source.renderPeek != null ? (
      peek.dialog ? (
        <PopoverSurface as="span" {...peek.peekProps} role="dialog" aria-label={peek.label || textOf(children, id)}>
          {body}
        </PopoverSurface>
      ) : (
        <PopoverSurface as="span" {...peek.peekProps}>
          {body}
        </PopoverSurface>
      )
    ) : null;
  return (
    <>
      {trigger}
      {card}
    </>
  );
}

export const Mention = { Root } as const;
