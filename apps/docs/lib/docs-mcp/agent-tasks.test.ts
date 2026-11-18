import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { deliver, LARGE_PAGE_TOKENS, MAX_RESPONSE_CHARS } from './budget';
import { getComponent, getDocsPage, listComponents, whenToUse } from './tools';
import { getRecipe } from './recipes';
import { getGuide } from './guides';
import { readExample } from './read';
import { presentSearch, searchDocs, type SearchHit } from './search';
import { getToken } from './tokens';
import { tokensOf } from './units';

const TASK_BUDGET = 8_000;

function cost(value: unknown): number {
  return tokensOf(JSON.stringify(value).length);
}

type Task = {
  id: string;
  query: string;
  locale?: 'en' | 'ko';
  /** A hit in the top 3 whose ref, title, path or component contains this. */
  match: string;
  /** The page or name the first suggested call must open. Defaults to the match without its anchor. */
  lands?: string;
  /** A phrase that belongs to that hit and not to a neighboring section. */
  phrase: string;
  follow: (hit: SearchHit) => unknown;
};

const tasks: Task[] = [
  {
    id: 'calendar-holiday-prop',
    query: 'Calendar prop for a holiday that cannot be picked',
    match: 'isDateDisabled',
    lands: 'calendar',
    phrase: 'cannot be picked',
    follow: (hit) => getComponent(hit.component ?? 'Calendar.Root'),
  },
  {
    id: 'scheduler-drag',
    query: 'drag a talk to another stage on the scheduler',
    match: 'recipes/scheduler#dragging',
    phrase: 'getHandleProps',
    follow: (hit) => getDocsPage(hit.ref),
  },
  {
    id: 'lane-drag-check',
    query: 'useLaneDrag check refuses a blocked drop',
    match: 'utilities/use-lane-drag#checking-a-place',
    lands: 'useLaneDrag',
    phrase: 'takes no drop',
    follow: (hit) => getDocsPage(hit.ref),
  },
  {
    id: 'accent-token',
    query: 'accent color token',
    match: 'color.accent',
    phrase: 'color.accent',
    follow: (hit) => getToken(hit.path ?? hit.title),
  },
  {
    id: 'sign-in-recipe',
    query: 'recipe for signing in',
    match: 'recipes/sign-in',
    phrase: 'password',
    follow: (hit) => getDocsPage(hit.ref),
  },
  {
    id: 'tooltip-hook',
    query: 'hook that shows a tooltip',
    match: 'useTooltip',
    phrase: 'useTooltip',
    follow: (hit) => getComponent(hit.component ?? 'useTooltip'),
  },
  {
    id: 'korean-scheduler-drag',
    query: '세션을 다른 무대로 끌기',
    locale: 'ko',
    match: 'recipes/scheduler#끌기',
    phrase: 'useLaneDrag',
    follow: (hit) => getDocsPage(hit.ref, { locale: 'ko' }),
  },
  {
    id: 'korean-calendar-holiday',
    query: '공휴일처럼 날짜를 제외',
    locale: 'ko',
    match: 'calendar#',
    phrase: '공휴일',
    follow: (hit) => getDocsPage(hit.ref, { locale: 'ko' }),
  },
  {
    id: 'form-error',
    query: 'show a form error on a field',
    match: 'errormessage#in-a-form',
    phrase: 'aria-describedby',
    follow: (hit) => getDocsPage(hit.ref, hit.locale === 'ko' ? { locale: 'ko' } : {}),
  },
  {
    id: 'wizard-recipe',
    query: 'multi-step wizard',
    match: 'recipes/wizard',
    phrase: 'wizard',
    follow: (hit) => getDocsPage(hit.ref),
  },
  {
    id: 'scheduler-example',
    query: 'scheduler conference example',
    match: 'SchedulerExample.tsx',
    phrase: 'findConflicts',
    follow: (hit) => readExample(hit.ref.split('#')[0] ?? hit.ref, 'SchedulerExample.tsx'),
  },
  {
    id: 'contrast-section',
    query: 'how contrast pairs are measured',
    match: 'tokens#contrast',
    phrase: 'APCA',
    follow: (hit) => getDocsPage(hit.ref),
  },
  {
    id: 'menu-keyboard',
    query: 'open a menu with the keyboard',
    match: 'menu#keyboard',
    phrase: 'ArrowDown',
    follow: (hit) => getDocsPage(hit.ref),
  },
];

function top(task: Task): SearchHit {
  const hits = searchDocs(task.query, { ...(task.locale ? { locale: task.locale } : {}), limit: 8 });
  const found = hits.slice(0, 3).find((hit) => `${hit.ref} ${hit.title} ${hit.path ?? ''} ${hit.component ?? ''}`.includes(task.match));
  expect(found, `${task.id} top 8: ${hits.map((hit) => `${hit.kind}:${hit.ref}:${hit.title}`).join(' | ')}`).toBeTruthy();
  return found!;
}

describe('agent tasks', () => {
  it.each(tasks)('$id finds the section in the top 3 and stays under the token budget', (task) => {
    const search = presentSearch(task.query, { ...(task.locale ? { locale: task.locale } : {}), limit: 8 });
    const first = search.hits[0];
    const next = search.nav.next[0];
    const landed = `${first?.ref ?? ''} ${first?.title ?? ''} ${first?.path ?? ''} ${first?.component ?? ''} ${JSON.stringify(next?.arguments ?? {})}`;
    const page = task.lands ?? task.match.split('#')[0] ?? task.match;
    expect(landed, `${task.id} first call ${landed}`).toContain(page);
    const hit = top(task);
    const follow = task.follow(hit);
    expect(JSON.stringify(follow)).toContain(task.phrase);
    const spent = cost(search) + cost(follow);
    expect(spent, `${task.id} spent ${spent}`).toBeLessThan(TASK_BUDGET);
  });

  it('answers an unknown name with search hits instead of a bare error', () => {
    expect(() => getDocsPage('drag to create event')).toThrow(/Did you mean:\n- \S+#\S+/);
    expect(() => getRecipe('drag to create')).toThrow(/Call list_recipes[\s\S]*Did you mean/);
    expect(() => getComponent('NotAComponent')).toThrow(/Call list_components[\s\S]*Did you mean/);
    const hits = searchDocs('drag to create event', { limit: 3 });
    expect(hits.length).toBeGreaterThan(0);
  });
});

describe('search', () => {
  it('returns title, kind, ref, snippet and the cost of fetching each hit', () => {
    const hits = searchDocs('dragging a talk', { limit: 5 });
    expect(hits.length).toBeGreaterThan(0);
    for (const hit of hits) {
      expect(hit.title).toBeTruthy();
      expect(hit.kind).toMatch(/page|section|component|prop|hook|recipe|example|token/);
      expect(hit.ref).toMatch(/^[^\s]+$/);
      expect(hit.snippet.length).toBeGreaterThan(0);
      expect(hit.tokens).toBeGreaterThan(0);
    }
    const korean = searchDocs('끌기', { locale: 'ko', limit: 5 });
    expect(korean.some((hit) => hit.locale === 'ko' && hit.ref.includes('#'))).toBe(true);
  });
});

describe('section reads', () => {
  it('opens a slug#anchor and a heading, and does not return the rest of the page', () => {
    const byAnchor = getDocsPage('recipes/scheduler#dragging');
    const byHeading = getDocsPage('recipes/scheduler', { section: 'Dragging' });
    expect(byAnchor).toMatchObject({ kind: 'section', anchor: 'dragging', locale: 'en' });
    if (byAnchor.kind !== 'section' || byHeading.kind !== 'section') throw new Error('expected a section');
    expect(byHeading.markdown).toBe(byAnchor.markdown);
    expect(byAnchor.markdown).toContain('getHandleProps');
    expect(byAnchor.markdown).not.toContain('## Undo and saving');
    const korean = getDocsPage('ko/recipes/scheduler#끌기');
    expect(korean).toMatchObject({ kind: 'section', locale: 'ko', slug: 'recipes/scheduler' });
    if (korean.kind !== 'section') throw new Error('expected a section');
    expect(korean.markdown).toContain('useLaneDrag');
    expect(korean.markdown).not.toContain('## 되돌리기와 저장');
  });

  it('returns an outline for a page over the large-page threshold', () => {
    const page = getDocsPage('utilities/strings-provider');
    expect(page.kind).toBe('outline');
    if (page.kind !== 'outline') throw new Error('expected an outline');
    expect(page.nav.tokens).toBeLessThanOrEqual(LARGE_PAGE_TOKENS);
    expect(page.intro).toContain('StringsProvider');
    expect(page.sections.some((section) => section.anchor === 'accessible-composition' && section.tokens > 0)).toBe(true);
    expect(JSON.stringify(page)).not.toContain('An empty string. Unlike');
    const section = getDocsPage('utilities/strings-provider#accessible-composition');
    expect(section.kind).toBe('section');
    if (section.kind !== 'section') throw new Error('expected a section');
    expect(section.markdown).toContain('An empty string. Unlike');
  });
});

describe('examples on demand', () => {
  it('stubs example source on the page and returns numbered lines from get_example', () => {
    const page = getDocsPage('recipes/scheduler');
    if (page.kind === 'outline') throw new Error('expected the stubbed page');
    expect(page.markdown).toContain('SchedulerExample.tsx');
    expect(page.markdown).not.toContain('function findConflicts');
    const example = readExample('recipes/scheduler', 'SchedulerExample.tsx', { startLine: 1, endLine: 40 });
    expect(example.code).toMatch(/^\s*1 \| /);
    expect(example.startLine).toBe(1);
    expect(example.endLine).toBeLessThanOrEqual(40);
    expect(example.totalLines).toBeGreaterThan(40);
    const whole = readExample('scheduler', 'SchedulerExample.tsx');
    expect(whole.code.split('\n').length).toBeLessThanOrEqual(whole.totalLines);
    if (whole.totalLines > whole.endLine) expect(whole.cursor).toEqual({ startLine: whole.endLine + 1 });
  });
});

describe('response budget', () => {
  it('returns an outline instead of a page with inlined source that does not fit', () => {
    const text = deliver(getDocsPage('recipes/scheduler', { includeCode: true }));
    expect(text.length).toBeLessThanOrEqual(MAX_RESPONSE_CHARS);
    const body = JSON.parse(text) as { kind: string; cursor?: { offset?: number }; note?: string };
    const continued = body.kind === 'outline' || body.kind === 'over-budget' || body.cursor != null;
    expect(continued).toBe(true);
    if (body.cursor?.offset != null) expect(body.cursor.offset).toBeGreaterThan(0);
  });

  it('refuses a payload over the budget with a cursor or an explicit over-budget result', () => {
    const text = deliver({ blob: 'x'.repeat(MAX_RESPONSE_CHARS + 5_000) });
    expect(text.length).toBeLessThanOrEqual(MAX_RESPONSE_CHARS);
    const body = JSON.parse(text) as { kind?: string; cursor?: unknown; note?: string };
    expect(body.kind === 'over-budget' || body.cursor != null).toBe(true);
    expect(text).not.toContain('x'.repeat(MAX_RESPONSE_CHARS));
  });
});

describe('forgiving lookup', () => {
  it('matches case, spaces and dashes, and serves Korean by prefix or locale', () => {
    expect(getDocsPage('use lane drag').slug).toBe('utilities/use-lane-drag');
    expect(getDocsPage('RECIPES/SCHEDULER').slug).toBe('recipes/scheduler');
    expect(getDocsPage('ko/calendar')).toMatchObject({ locale: 'ko', slug: 'calendar' });
    expect(getDocsPage('calendar', { locale: 'ko' }).locale).toBe('ko');
    expect(getGuide('tokens', { locale: 'ko', section: '대비' }).locale).toBe('ko');
    expect(whenToUse('Calendar', { locale: 'ko' }).whenToUse).toContain('날짜');
  });
});

describe('self-navigating responses', () => {
  it('names what the result is, how big it is, and a next call', () => {
    for (const result of [getDocsPage('tooltip'), getComponent('Button'), listComponents(), getRecipe('data-table'), presentSearch('dialog', { limit: 3 })]) {
      if (!result.nav) throw new Error('missing nav');
      expect(result.nav.what).toBeTruthy();
      expect(result.nav.chars).toBe(JSON.stringify(result).length);
      expect(result.nav.tokens).toBe(tokensOf(result.nav.chars));
      expect(result.nav.next.length).toBeGreaterThan(0);
      expect(result.nav.next[0]?.tool).toBeTruthy();
    }
  });
});

describe('docs page', () => {
  it('explains the search, section and example flow in English and Korean', () => {
    const english = readFileSync(new URL('../../app/(en)/mcp/page.mdx', import.meta.url), 'utf8');
    const korean = readFileSync(new URL('../../app/ko/mcp/page.mdx', import.meta.url), 'utf8');
    for (const page of [english, korean]) {
      expect(page).toContain('search_docs');
      expect(page).toContain('get_example');
      expect(page).toContain('get_docs_page');
      expect(page).toMatch(/40,?000/);
      expect(page).toContain('1.18');
      expect(page).toContain('1.76');
    }
  });
});
