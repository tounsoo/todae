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
export const FOLD_AFTER_LINES = 40;
export const PEEK_LINES = 20;

type CodeChild = ReactElement<{ children?: ReactNode }>;

/** The `code` child of a fenced block and its text, when that child holds nothing but text, as MDX writes it. */
function codeText(children: ReactNode): { code: CodeChild; text: string } | null {
  if (!isValidElement<{ children?: ReactNode }>(children)) return null;
  const text = children.props.children;
  return typeof text === 'string' ? { code: children, text } : null;
}

/** The index of the newline that ends line {@link PEEK_LINES}, or -1 when the block is short enough to show whole. */
export function foldPoint(text: string): number {
  if (text.replace(/\n$/, '').split('\n').length <= FOLD_AFTER_LINES) return -1;
  let index = -1;
  for (let line = 0; line < PEEK_LINES; line += 1) index = text.indexOf('\n', index + 1);
  return index;
}

export function DocsPre({ children, ...props }: ComponentProps<'pre'>) {
  const found = codeText(children);
  const fold = found ? foldPoint(found.text) : -1;
  if (!found || fold < 0) {
    return (
      <ScrollRegion kind="code" className="docs-pre">
        <CodeBlock.Root {...props}>{children}</CodeBlock.Root>
      </ScrollRegion>
    );
  }
  return <FoldedPre {...props} code={found.code} peek={found.text.slice(0, fold)} rest={found.text.slice(fold + 1)} />;
}

const supportsUntilFound = () => 'onbeforematch' in document.body;

/**
 * A long block that shows its first lines under a fade, with a button that shows the rest. The rest stays in the
 * page, hidden with `hidden="until-found"` where the browser has it, so find in page still reaches it and opens the
 * block. React writes `hidden` only as a boolean, so an effect sets the attribute. Until it runs, `data-ready` is
 * absent and the stylesheet hides the rest, so the server's HTML and the first paint match.
 * Expanded, a newline joins the two parts, so the block's text is the fence's text again.
 */
function FoldedPre({ code, peek, rest, ...props }: ComponentProps<'pre'> & { code: CodeChild; peek: string; rest: string }) {
  const words = DICTIONARIES[useLocale()].codeFold;
  const id = useId();
  const restRef = useRef<HTMLSpanElement>(null);
  const toggleRef = useRef<HTMLButtonElement>(null);
  const foldedByReader = useRef(false);
  const [expanded, setExpanded] = useState(false);
  const [ready, setReady] = useState(false);

  useLayoutEffect(() => {
    const el = restRef.current;
    if (!el) return;
    if (expanded) el.removeAttribute('hidden');
    else el.setAttribute('hidden', supportsUntilFound() ? 'until-found' : '');
    setReady(true);
    // Folding shrinks the block above the button, so bring the button back into view.
    if (!expanded && foldedByReader.current) toggleRef.current?.scrollIntoView({ block: 'nearest' });
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
    <div className="docs-code-fold" data-expanded={expanded ? '' : undefined} data-ready={ready ? '' : undefined}>
      <ScrollRegion kind="code" className="docs-pre">
        <CodeBlock.Root {...props}>
          {cloneElement(
            code,
            undefined,
            peek,
            expanded ? '\n' : null,
            <span key="rest" ref={restRef} id={id} className="docs-code-rest">
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
          onClick={() => {
            foldedByReader.current = expanded;
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
