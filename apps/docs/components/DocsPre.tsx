'use client';

import { Button } from '@tounsoo/todae';
import { CodeBlock } from '@tounsoo/todae/code-block';
import { ChevronDown, ChevronUp } from 'lucide-react';
import {
  cloneElement,
  isValidElement,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type ComponentProps,
  type ReactElement,
  type ReactNode,
} from 'react';
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
  const toggleRef = useRef<HTMLButtonElement>(null);
  // Where the button sat in the viewport when the reader pressed it to fold the block.
  const foldFrom = useRef<number | null>(null);
  const [expanded, setExpanded] = useState(false);

  useLayoutEffect(() => {
    const el = restRef.current;
    if (!expanded && el && 'onbeforematch' in el) el.setAttribute('hidden', 'until-found');
    const from = foldFrom.current;
    foldFrom.current = null;
    // The block shrank above the button, so scroll the page by as much, which keeps the button under the reader's
    // pointer and focus, with the peek just above it.
    if (!expanded && from !== null && toggleRef.current) scrollBy({ top: toggleRef.current.getBoundingClientRect().top - from, behavior: 'instant' });
  }, [expanded]);

  useEffect(() => {
    const el = restRef.current;
    if (!el) return;
    // Find in page matched text in the rest, and the browser has already removed `hidden`.
    const open = () => setExpanded(true);
    el.addEventListener('beforematch', open);
    return () => el.removeEventListener('beforematch', open);
  }, []);

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
          ref={toggleRef}
          variant="ghost"
          aria-expanded={expanded}
          aria-controls={id}
          onClick={(event) => {
            if (expanded) foldFrom.current = event.currentTarget.getBoundingClientRect().top;
            setExpanded(!expanded);
          }}
        >
          {expanded ? words.hide : words.show}
          <Button.Icon>{expanded ? <ChevronUp /> : <ChevronDown />}</Button.Icon>
        </Button.Root>
      </div>
    </div>
  );
}
