'use client';

import { Badge, Code, Table } from '@omsoo/todae';
import type { Locale } from '../lib/i18n/config';
import { DICTIONARIES } from '../lib/i18n/dictionaries';
import { useLocale } from '../lib/i18n/useLocale';
import { ScrollRegion } from './OverflowRegion';
import type { PropRow } from './PropsTable';

export type PropDescription = { text: string; lang: Locale };

export type PropsTableRow = Omit<PropRow, 'description'> & { descriptions: Record<Locale, PropDescription> };

// A union this long or shorter stays on one line; a longer one puts each member on its own.
const UNION_LINE_LENGTH = 40;

const OPENERS: Record<string, string> = { '(': ')', '<': '>', '[': ']', '{': '}' };

/**
 * Splits a type at its top-level ` | `, leaving unions inside brackets, generics and strings whole.
 * A top-level function or conditional type is one member: its unions belong to its return or branches.
 */
export function unionMembers(type: string): string[] {
  // A leading `|`, as in a union written one member per line, is not a separator.
  const source = type.replace(/^\s*\|\s+/, '');
  const members: string[] = [];
  const closers: string[] = [];
  let quote: string | null = null;
  let start = 0;
  for (let i = 0; i < source.length; i += 1) {
    const char = source[i] ?? '';
    const arrow = char === '=' && source[i + 1] === '>';
    if (quote) {
      if (char === '\\') i += 1;
      else if (char === quote) quote = null;
    } else if (char === '"' || char === "'" || char === '`') {
      quote = char;
    } else if (closers.length === 0 && (arrow || char === '?')) {
      return [source];
    } else if (arrow) {
      // Skip the `>` so it does not close a generic.
      i += 1;
    } else if (OPENERS[char]) {
      closers.push(OPENERS[char]);
    } else if (char === closers[closers.length - 1]) {
      closers.pop();
    } else if (char === '|' && closers.length === 0 && source[i - 1] === ' ' && source[i + 1] === ' ') {
      members.push(source.slice(start, i - 1));
      start = i + 2;
    }
  }
  members.push(source.slice(start));
  return members;
}

function TypeCode({ type }: { type: string }) {
  const members = type.length > UNION_LINE_LENGTH ? unionMembers(type) : [type];
  if (members.length < 2) return <Code.Root className="props-type">{type}</Code.Root>;
  // One member per line, each after the first led by its `|`.
  return (
    <Code.Root className="props-type">
      {members.map((member, index) => (
        <span key={index} className="props-type-member">
          {index === 0 ? member : `| ${member}`}
        </span>
      ))}
    </Code.Root>
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
        <Table.Root lang={locale} role="table">
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
                    <Code.Root>{prop.name}</Code.Root>
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
                        <span className="props-default-label">{words.default}:</span>{' '}
                        {/* Defaults come from the English JSDoc and are not translated. */}
                        <span lang={locale === 'en' ? undefined : 'en'}>{prop.default}</span>
                      </p>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </Table.Root>
      </ScrollRegion>
    </div>
  );
}
