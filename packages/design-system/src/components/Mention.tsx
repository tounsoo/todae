import { createElement, type ComponentPropsWithRef, type ReactNode } from 'react';
import { useMentionPeek } from '../hooks/useMentionPeek.js';
import type { MentionSource } from '../mentions/source.js';
import { Popover } from './Popover.js';
import { composeHandlers, cx, useComposedRefs } from './props.js';
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

function Root<T>({ source, id, children, className, ref, onClick, onKeyDown, ...props }: MentionRootProps<T>) {
  const peek = useMentionPeek({
    source,
    id,
    mode: 'interactive',
    text: textOf(children, id),
  });
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
    },
    children,
  );
  const card =
    source.renderPeek != null ? (
      peek.dialog ? (
        <Popover.Root {...peek.peekProps} role="dialog" aria-label={peek.label || textOf(children, id)}>
          {peek.loading ? <span data-loading="" aria-hidden="true" /> : null}
          {peek.entity !== undefined ? source.renderPeek(peek.entity, peek.context) : null}
        </Popover.Root>
      ) : (
        <Popover.Root {...peek.peekProps}>
          {peek.loading ? <span data-loading="" aria-hidden="true" /> : null}
          {peek.entity !== undefined ? source.renderPeek(peek.entity, peek.context) : null}
        </Popover.Root>
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
