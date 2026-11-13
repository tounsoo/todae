'use client';

import { Button } from '@tounsoo/todae';
import { CodeBlock } from '@tounsoo/todae/code-block';
import { ChevronDown, ChevronUp } from 'lucide-react';
import {
  cloneElement,
  isValidElement,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type ComponentProps,
  type ReactElement,
  type ReactNode,
} from 'react';
import { flushSync } from 'react-dom';
import { DICTIONARIES } from '../lib/i18n/dictionaries';
import { useLocale } from '../lib/i18n/useLocale';
import { ScrollRegion } from './ScrollRegion';

/** A block longer than this many lines shows only its first {@link PEEK_LINES} until the reader asks for the rest. */
const FOLD_AFTER_LINES = 40;
const PEEK_LINES = 20;

type CodeChild = ReactElement<{ children?: ReactNode }>;

/**
 * A fenced block's `code` child split after line {@link PEEK_LINES}, when the child holds nothing but text, as MDX
 * writes it, and the text runs past {@link FOLD_AFTER_LINES} lines. `rest` starts with the newline that ends the peek,
 * so `peek + rest` is the fence's text.
 */
function splitFence(children: ReactNode): { code: CodeChild; peek: string; rest: string } | null {
  if (!isValidElement<{ children?: ReactNode }>(children)) return null;
  const text = children.props.children;
  if (typeof text !== 'string' || text.replace(/\n+$/, '').split('\n').length <= FOLD_AFTER_LINES) return null;
  let fold = -1;
  for (let line = 0; line < PEEK_LINES; line += 1) fold = text.indexOf('\n', fold + 1);
  return { code: children, peek: text.slice(0, fold), rest: text.slice(fold) };
}

export function DocsPre({ children, ...props }: ComponentProps<'pre'>) {
  const split = splitFence(children);
  if (!split) {
    return (
      <ScrollRegion kind="code" className="docs-pre">
        <CodeBlock.Root {...props}>{children}</CodeBlock.Root>
      </ScrollRegion>
    );
  }
  return <FoldedPre {...props} {...split} />;
}

/**
 * A long block that shows its first lines under a fade, with a button that shows the rest. Folded, the rest is
 * `hidden`, which the server writes too. React writes `hidden` only as a boolean, so where the browser has
 * `hidden="until-found"` a layout effect upgrades it, so find in page still reaches the rest and opens the block.
 */
function FoldedPre({ code, peek, rest, ...props }: ComponentProps<'pre'> & { code: CodeChild; peek: string; rest: string }) {
  const words = DICTIONARIES[useLocale()].codeFold;
  const id = useId();
  const restRef = useRef<HTMLSpanElement>(null);
  const [expanded, setExpanded] = useState(false);

  // A find in page match in the rest fires this, and the browser then removes `hidden`. Its own effect, so
  // toggling the block doesn't attach it again.
  useLayoutEffect(() => {
    const el = restRef.current;
    if (!el) return;
    const open = () => setExpanded(true);
    el.addEventListener('beforematch', open);
    return () => el.removeEventListener('beforematch', open);
  }, []);

  useLayoutEffect(() => {
    const el = restRef.current;
    if (!expanded && el && 'onbeforematch' in el) el.setAttribute('hidden', 'until-found');
  }, [expanded]);

  /**
   * Folds the block in one step: the block shrinks above the button, so scroll the page by as much, which keeps the
   * button under the reader's pointer and focus with the peek just above it. Scroll anchoring is off while it
   * happens, so the browser doesn't move the page too.
   */
  const fold = (button: HTMLElement) => {
    const from = button.getBoundingClientRect().top;
    const root = document.documentElement.style;
    const anchor = root.getPropertyValue('overflow-anchor');
    root.setProperty('overflow-anchor', 'none');
    try {
      flushSync(() => setExpanded(false));
      scrollBy({ top: button.getBoundingClientRect().top - from, behavior: 'instant' });
    } finally {
      if (anchor) root.setProperty('overflow-anchor', anchor);
      else root.removeProperty('overflow-anchor');
    }
  };

  return (
    <div className="docs-code-fold" data-expanded={expanded ? '' : undefined}>
      <ScrollRegion kind="code" className="docs-pre">
        <CodeBlock.Root {...props}>
          {cloneElement(
            code,
            undefined,
            peek,
            <span ref={restRef} id={id} className="docs-code-rest" hidden={!expanded}>
              {rest}
            </span>,
          )}
        </CodeBlock.Root>
      </ScrollRegion>
      <div className="docs-code-toggle">
        <Button.Root
          variant="ghost"
          aria-expanded={expanded}
          aria-controls={id}
          onClick={(event) => (expanded ? fold(event.currentTarget) : setExpanded(true))}
        >
          {expanded ? words.hide : words.show}
          <Button.Icon>{expanded ? <ChevronUp /> : <ChevronDown />}</Button.Icon>
        </Button.Root>
      </div>
    </div>
  );
}
