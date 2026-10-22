'use client';

import { Link, Message, Prose, Text, Tooltip, useTooltip, VisuallyHidden } from '@tounsoo/todae';
import { Fragment, useId } from 'react';

type Source = { title: string; site: string; url: string };

/** A reply as a product's renderer might hand it over: text runs and the sources they cite. */
type Run = string | { cite: Source };

const POPOVER_API: Source = {
  title: 'Popover API',
  site: 'developer.mozilla.org',
  url: 'https://developer.mozilla.org/en-US/docs/Web/API/Popover_API',
};
const ANCHOR_POSITIONING: Source = {
  title: 'CSS anchor positioning',
  site: 'developer.mozilla.org',
  url: 'https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_anchor_positioning',
};
const POPOVER_SPEC: Source = {
  title: 'The popover attribute',
  site: 'html.spec.whatwg.org',
  url: 'https://html.spec.whatwg.org/multipage/popover.html',
};

const SOURCES = [POPOVER_API, ANCHOR_POSITIONING, POPOVER_SPEC] as const;

const REPLY: readonly (readonly Run[])[] = [
  [
    'A tooltip is drawn in the top layer through the Popover API',
    { cite: POPOVER_API },
    ', so no ancestor can clip it, and CSS anchor positioning places it against its trigger',
    { cite: ANCHOR_POSITIONING },
    '.',
  ],
  ['A manual popover stays open until code hides it, which leaves hover and focus to the page', { cite: POPOVER_SPEC }, '.'],
];

function Citation({ number, source, href }: { number: number; source: Source; href: string }) {
  const tooltip = useTooltip({ interactive: true });
  const titleId = useId();
  return (
    <>
      <sup>
        <Link.Root href={href} {...tooltip.getTriggerProps()}>
          <VisuallyHidden.Root>Source </VisuallyHidden.Root>
          {number}
        </Link.Root>
      </sup>
      <Tooltip.Root {...tooltip.getTooltipProps()} aria-labelledby={titleId}>
        <Link.Root id={titleId} href={source.url}>
          {source.title}
        </Link.Root>
        <br />
        <Text.Root as="span" size="s" tone="muted">
          {source.site}
        </Text.Root>
      </Tooltip.Root>
    </>
  );
}

export function CitationsExample() {
  const id = useId();
  const sourceId = (source: Source) => `${id}-source-${SOURCES.indexOf(source) + 1}`;
  return (
    <Message.Root aria-label="Assistant" style={{ maxInlineSize: '36rem' }}>
      <Message.Content>
        <Prose.Root>
          {REPLY.map((runs, index) => (
            <p key={index}>
              {runs.map((run, at) =>
                typeof run === 'string' ? (
                  <Fragment key={at}>{run}</Fragment>
                ) : (
                  <Citation
                    key={at}
                    number={SOURCES.indexOf(run.cite) + 1}
                    source={run.cite}
                    href={`#${sourceId(run.cite)}`}
                  />
                ),
              )}
            </p>
          ))}
          <Text.Root id={`${id}-sources`} size="s" weight="bold">
            Sources
          </Text.Root>
          <ol aria-labelledby={`${id}-sources`}>
            {SOURCES.map((source) => (
              <li key={source.url} id={sourceId(source)}>
                <Link.Root href={source.url}>{source.title}</Link.Root>{' '}
                <Text.Root as="span" size="s" tone="muted">
                  {source.site}
                </Text.Root>
              </li>
            ))}
          </ol>
        </Prose.Root>
      </Message.Content>
    </Message.Root>
  );
}
