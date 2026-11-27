import { cleanup, render, screen } from '@testing-library/react';
import axe from 'axe-core';
import { useState } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { cdp, server } from 'vitest/browser';
import { Calendar, OptionList } from '../index.js';
import { settle } from '../test/settle.js';

/**
 * WCAG 2.5.3 Label in Name: a control's accessible name holds the text it
 * shows, so a speech user can say what they see. axe's
 * label-content-name-mismatch checks it, and Chromium's own accessibility
 * tree is the name a screen reader reads.
 */

/** vitest types the session without its methods; Playwright's session has `send`. */
const session = () => cdp() as unknown as { send(method: string, params?: object): Promise<unknown> };

type AXNode = { role?: { value?: string }; name?: { value?: string }; description?: { value?: string } };

type FrameTree = { frame: { id: string }; childFrames?: FrameTree[] };
const frameIds = (tree: FrameTree): string[] => [tree.frame.id, ...(tree.childFrames ?? []).flatMap(frameIds)];

/** The name and description Chromium's accessibility tree gives each node of a role, in every frame. */
async function axNodes(role: string): Promise<{ name: string; description: string }[]> {
  const { frameTree } = (await session().send('Page.getFrameTree')) as { frameTree: FrameTree };
  const found: { name: string; description: string }[] = [];
  for (const frameId of frameIds(frameTree)) {
    const { nodes } = (await session().send('Accessibility.getFullAXTree', { frameId })) as { nodes: AXNode[] };
    for (const node of nodes) {
      if (node.role?.value === role) found.push({ name: node.name?.value ?? '', description: node.description?.value ?? '' });
    }
  }
  return found;
}

async function mismatches(): Promise<string[]> {
  const result = await axe.run(document.body, { runOnly: ['label-content-name-mismatch'] });
  return result.violations.flatMap((v) => v.nodes.map((n) => n.target.join(' ')));
}

/** The words on screen, in order, as one run of the name's words: what the axe rule asks of an explicit name. */
const segmenter = new Intl.Segmenter(undefined, { granularity: 'word' });
const words = (text: string) =>
  [...segmenter.segment(text.toLocaleLowerCase())].filter((part) => part.isWordLike).map((part) => part.segment);
function shownInName(shown: string, name: string) {
  const want = words(shown);
  const have = words(name);
  let at = 0;
  for (const word of have) if (word === want[at]) at += 1;
  return at === want.length;
}

// axe's own text helpers, which its types leave out.
const axeText = axe.commons.text as typeof axe.commons.text & { visibleVirtual(node: unknown): string };
const axeUtils = axe.utils as typeof axe.utils & { getNodeFromTree(element: Element): unknown };

/** What the element shows and what it is named, both as axe reads them: text clipped or hidden on screen is not shown. */
function shownAndNamed(element: HTMLElement) {
  axe.setup(document.body);
  try {
    return { shown: axeText.visibleVirtual(axeUtils.getNodeFromTree(element)), name: axeText.accessibleText(element) };
  } finally {
    axe.teardown();
  }
}

afterEach(cleanup);

// Chromium's tree comes over CDP; Firefox and WebKit have no CDP to read theirs.
const axIt = it.runIf(server.browser === 'chromium');

const NOTES: Record<string, Record<string, string>> = {
  'en-US': { '2026-10-13': 'Review', '2026-10-20': 'Ship' },
  ko: { '2026-10-13': '검토', '2026-10-20': '출시' },
};

function NotedCalendar({ locale }: { locale: string }) {
  const [date, setDate] = useState<Temporal.PlainDate | null>(() => Temporal.PlainDate.from('2026-10-13'));
  return (
    <Calendar.Root aria-label="Start date" locale={locale} value={date} onValueChange={setDate}>
      <Calendar.Header />
      <Calendar.Grid renderDay={(day) => NOTES[locale]?.[day.date.toString()] ?? null} />
    </Calendar.Root>
  );
}

const fullDate = (iso: string, locale: string) =>
  new Intl.DateTimeFormat(locale, { dateStyle: 'full', calendar: 'gregory', timeZone: 'UTC' }).format(
    new Date(`${iso}T00:00:00Z`),
  );

describe('a calendar day with content', () => {
  it.each(['en-US', 'ko'])('passes label-content-name-mismatch in %s', async (locale) => {
    render(<NotedCalendar locale={locale} />);
    await settle();
    expect(await mismatches()).toEqual([]);
  });

  axIt.each(['en-US', 'ko'])('is named by its date, then its content, in %s', async (locale) => {
    render(<NotedCalendar locale={locale} />);
    await settle();
    const names = (await axNodes('button')).map((node) => node.name);
    expect(names).toContain(`${fullDate('2026-10-13', locale)} ${NOTES[locale]!['2026-10-13']}`);
    // A day without content keeps the date alone.
    expect(names).toContain(fullDate('2026-10-14', locale));
  });

  axIt('does not read the content a second time as the description', async () => {
    render(<NotedCalendar locale="en-US" />);
    await settle();
    const noted = (await axNodes('button')).find((node) => node.name.endsWith(' Review'));
    expect(noted?.description).toBe('');
  });

  it.each(['en-US', 'ko', 'fa-IR', 'ar-EG'])('shows each day in words its name holds, in %s', async (locale) => {
    render(<NotedCalendar locale={locale} />);
    await settle();
    const days = screen.getAllByRole('button').filter((button) => button.hasAttribute('data-todae-calendar-cell'));
    expect(days.length).toBeGreaterThan(27);
    for (const day of days) {
      const { shown, name } = shownAndNamed(day);
      expect(shownInName(shown, name), `${shown} in ${name}`).toBe(true);
    }
  });

  it.each(['fa-IR', 'ar-EG'])('passes label-content-name-mismatch with the locale digits in %s', async (locale) => {
    render(<NotedCalendar locale={locale} />);
    await settle();
    expect(await mismatches()).toEqual([]);
  });
});

const FRUIT = {
  en: [
    { value: 'apple', title: 'Apple', detail: 'Crisp and sweet' },
    { value: 'pear', title: 'Pear', detail: 'Soft when ripe' },
  ],
  ko: [
    { value: 'apple', title: '사과', detail: '아삭하고 달콤함' },
    { value: 'pear', title: '배', detail: '익으면 부드러움' },
  ],
} as const;

function DetailedList({ lang }: { lang: keyof typeof FRUIT }) {
  const [value, setValue] = useState<string | null>('pear');
  return (
    <OptionList.Root value={value} onValueChange={setValue} aria-label={lang === 'ko' ? '과일' : 'Fruit'}>
      {FRUIT[lang].map((row) => (
        <OptionList.Option key={row.value} value={row.value}>
          {row.title}
          <OptionList.OptionDetail>{row.detail}</OptionList.OptionDetail>
        </OptionList.Option>
      ))}
    </OptionList.Root>
  );
}

describe('an option with a detail line', () => {
  it.each(['en', 'ko'] as const)('passes label-content-name-mismatch in %s', async (lang) => {
    render(<DetailedList lang={lang} />);
    await settle();
    expect(await mismatches()).toEqual([]);
  });

  axIt.each(['en', 'ko'] as const)('is named by its title, then its detail, in %s', async (lang) => {
    render(<DetailedList lang={lang} />);
    await settle();
    const options = await axNodes('option');
    expect(options).toEqual(FRUIT[lang].map((row) => ({ name: `${row.title} ${row.detail}`, description: '' })));
  });
});
