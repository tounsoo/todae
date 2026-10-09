'use client';

import { Badge } from '@tounsoo/todae';
import type { Locale } from '../lib/i18n/config';
import { DICTIONARIES } from '../lib/i18n/dictionaries';
import { useLocale } from '../lib/i18n/useLocale';
import { ScrollRegion } from './OverflowRegion';
import type { PropRow } from './PropsTable';

export type PropDescription = { text: string; lang: Locale };

export type PropsTableRow = Omit<PropRow, 'description'> & { descriptions: Record<Locale, PropDescription> };

// A union shorter than this stays on one line; a longer one puts each member on its own.
const UNION_LINE_LENGTH = 40;

const OPENERS: Record<string, string> = { '(': ')', '<': '>', '[': ']', '{': '}' };

/** Splits a type at its top-level ` | `, leaving unions inside brackets, generics and strings whole. */
export function unionMembers(type: string): string[] {
  const members: string[] = [];
  const closers: string[] = [];
  let quote: string | null = null;
  let start = 0;
  for (let i = 0; i < type.length; i += 1) {
    const char = type[i] ?? '';
    if (quote) {
      if (char === '\\') i += 1;
      else if (char === quote) quote = null;
    } else if (char === '"' || char === "'" || char === '`') {
      quote = char;
    } else if (OPENERS[char]) {
      closers.push(OPENERS[char]);
    } else if (char === closers[closers.length - 1] && !(char === '>' && type[i - 1] === '=')) {
      closers.pop();
    } else if (char === '|' && closers.length === 0 && type[i - 1] === ' ' && type[i + 1] === ' ') {
      members.push(type.slice(start, i - 1));
      start = i + 2;
    }
  }
  members.push(type.slice(start));
  return members;
}

function TypeCode({ type }: { type: string }) {
  const members = unionMembers(type);
  if (members.length < 2 || type.length <= UNION_LINE_LENGTH) return <code className="props-type">{type}</code>;
  // One member per line, each after the first led by its `|`, as Prettier lays out a long union.
  return (
    <code className="props-type">
      {members.map((member, index) => (
        <span key={index} className="props-type-member">
          {index === 0 ? member : `| ${member}`}
        </span>
      ))}
    </code>
  );
}

export function PropsTableView({
  name,
  rows,
}: {
  name: string;
  rows: PropsTableRow[];
}) {
  const locale = useLocale();
  const words = DICTIONARIES[locale].propsTable;
  // The table carries its own lang: an untranslated page wraps its English content in lang="en".
  // Explicit roles keep the table's semantics when a narrow screen stacks its rows with CSS display.
  return (
    <div className="props-table">
      <ScrollRegion>
        <table lang={locale} role="table">
          <caption>{words.caption.replace('{name}', name)}</caption>
          <thead role="rowgroup">
            <tr role="row">
              <th scope="col" role="columnheader">
                {words.name}
              </th>
              <th scope="col" role="columnheader">
                {words.type}
              </th>
              <th scope="col" role="columnheader">
                {words.description}
              </th>
            </tr>
          </thead>
          <tbody role="rowgroup">
            {rows.map((prop) => {
              const description = prop.descriptions[locale];
              return (
                <tr key={prop.name} role="row">
                  <th scope="row" role="rowheader" className="props-name">
                    <code>{prop.name}</code>
                    {prop.required ? (
                      <>
                        {' '}
                        <Badge.Root className="props-required">{words.required}</Badge.Root>
                      </>
                    ) : null}
                  </th>
                  <td role="cell">
                    <TypeCode type={prop.type} />
                  </td>
                  <td role="cell">
                    <p lang={description.lang === locale ? undefined : description.lang}>{description.text}</p>
                    {prop.default === undefined ? null : (
                      <p className="props-default">
                        <span className="props-default-label">{words.default}:</span> {prop.default}
                      </p>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </ScrollRegion>
    </div>
  );
}
