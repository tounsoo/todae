// @vitest-environment jsdom
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { act, cleanup, render, screen } from '@testing-library/react';
import { useInsertionEffect } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { HomeContent } from '../../components/HomeContent';
import { Example } from '../../components/Example';
import { LanguageAlternates } from '../../components/LanguageAlternates';
import { LanguageSwitcher } from '../../components/LanguageSwitcher';
import { LocalizedLink } from '../../components/LocalizedLink';
import { PropsTable } from '../../components/PropsTable';
import { TokensCatalog } from '../../components/TokensCatalog';
import { SiteNav } from '../../components/SiteNav';
import { SiteShell } from '../../components/SiteShell';
import { SITE_GROUPS } from '../../components/siteGroups';
import { UntranslatedPage } from '../../components/UntranslatedPage';
import { COMPLETE_LOCALES, LOCALES, stripLocale } from './config';
import { DICTIONARIES } from './dictionaries';
import { LICENSE } from '../license';
import { DOCS_ORIGIN } from '../origin';
import { ENGLISH_PAGES } from './englishPages';
import { PAGE_FILES, untranslatedByLocale, untranslatedSlugs } from './pages';
import { PROP_TRANSLATIONS, propDescription } from './propDescriptions';
import { codeBlocks, links, sections, sourceRecord, staleSections } from './sections';
import { stamp, type Sources } from './stamp';
import schema from '@omsoo/todae/schema/components.json';

const path = vi.hoisted(() => ({ current: '/ko/button' }));
vi.mock('next/navigation', () => ({ usePathname: () => path.current }));
// Lets a test pretend a page is untranslated; every page is translated today.
const untranslated = vi.hoisted(() => ({ current: undefined as Record<string, string[]> | undefined }));
const untranslatedRead = vi.hoisted(() => ({ current: undefined as (() => void) | undefined }));
vi.mock('./pages', async (importOriginal) => {
  const pages = await importOriginal<typeof import('./pages')>();
  return {
    ...pages,
    untranslatedByLocale: (appDir?: string) => {
      untranslatedRead.current?.();
      return untranslated.current ?? pages.untranslatedByLocale(appDir);
    },
  };
});

const APP = join(process.cwd(), 'app');

// The English a locale's pages were translated from, section by section, or nothing before any is stamped.
// Written by `pnpm --filter docs i18n:stamp`.
function sourcesOf(locale: string): Sources {
  const file = join(process.cwd(), 'lib', 'i18n', 'sources', `${locale}.json`);
  return existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) : {};
}

// A page's parse error names the page.
function withPage<T>(page: string, check: () => T): T {
  try {
    return check();
  } catch (error) {
    throw new Error(`${page}: ${error instanceof Error ? error.message : String(error)}`, { cause: error });
  }
}

// Static page slugs under `dir`; dynamic segments are not pages of their own.
function slugs(dir: string, prefix = ''): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    if (!entry.isDirectory() || /^[_[@(]/.test(entry.name)) return [];
    const slug = `${prefix}${entry.name}`;
    const own = PAGE_FILES.some((file) => existsSync(join(dir, entry.name, file))) ? [slug] : [];
    return [...own, ...slugs(join(dir, entry.name), `${slug}/`)];
  });
}

describe('docs locales', () => {
  afterEach(cleanup);

  it('can fall back to every English page', () => {
    expect(Object.keys(ENGLISH_PAGES).sort()).toEqual(slugs(join(APP, '(en)')).sort());
  });

  it('keeps each translation in step with its English page', () => {
    // A translation changes prose only. When an English page changes its imports, demos, props tables,
    // code or links, its translations must change with it.
    const shape = (text: string) => {
      const { code, rest: prose } = codeBlocks(text);
      return {
        imports: prose.match(/^import .*$/gm) ?? [],
        code,
        tags: (prose.match(/<\/?[A-Z][\w.]*/g) ?? []).sort(),
        props: prose.match(/<PropsTable\s+name="[^"]+"/g) ?? [],
        links: links(text),
        // Each top-level heading's level and the number of top-level blocks under it, so a section or
        // top-level paragraph added in English has to be added to the translation too.
        sections: sections(text).map((part) => `h${part.level}: ${part.blocks} blocks`),
      };
    };
    for (const locale of LOCALES.filter((item) => item !== 'en')) {
      for (const slug of slugs(join(APP, locale))) {
        const file = join(APP, locale, slug, 'page.mdx');
        if (!existsSync(file)) continue;
        const english = readFileSync(join(APP, '(en)', slug, 'page.mdx'), 'utf8');
        const translation = withPage(`${locale}/${slug}`, () => shape(readFileSync(file, 'utf8')));
        expect(translation, `${locale}/${slug}`).toEqual(withPage(`en/${slug}`, () => shape(english)));
      }
    }
  });

  it('records which English each translated page was made from', () => {
    // The structure check above cannot see prose edits, so each translated page records a fingerprint
    // of every English section it was translated from. Editing English prose fails here until the
    // page is stamped again.
    for (const locale of LOCALES.filter((item) => item !== 'en')) {
      const sources = sourcesOf(locale);
      const translated = slugs(join(APP, locale)).filter((slug) => existsSync(join(APP, locale, slug, 'page.mdx')));
      const stale = translated.flatMap((slug) => {
        const changed = withPage(`en/${slug}`, () => staleSections(readFileSync(join(APP, '(en)', slug, 'page.mdx'), 'utf8'), sources[slug]));
        return changed.length ? [`${locale}/${slug}: ${changed.join(', ')}`] : [];
      });
      // A record with no translated page: dropped by i18n:stamp once the English page is gone too.
      const orphaned = Object.keys(sources)
        .filter((slug) => !translated.includes(slug))
        .map((slug) =>
          existsSync(join(APP, '(en)', slug, 'page.mdx'))
            ? `${locale}/${slug}: no translated page.mdx; translate it again`
            : `${locale}/${slug}: page removed, so run i18n:stamp ${locale} ${slug} to drop it`,
        );
      expect(
        [...stale, ...orphaned],
        `Update app/${locale}/<slug>/page.mdx to match the English sections listed, then run pnpm --filter docs i18n:stamp ${locale} <slug>`,
      ).toEqual([]);
    }
  });

  it('notices a changed, new, removed or moved English section', () => {
    const english = '# Badge\n\nA label.\n\n## When to use\n\nOften.\n';
    const recorded = sourceRecord(english);
    expect(staleSections(english, recorded)).toEqual([]);
    // Trailing spaces, and blank lines at the end, are not a change.
    expect(staleSections(english.replace('A label.', 'A label.  \n'), recorded)).toEqual([]);
    expect(staleSections(english.replace('Often.', 'Rarely.'), recorded)).toEqual(['## When to use (changed)']);
    expect(staleSections(`${english}\n## Accessible composition\n\nNames.\n`, recorded)).toEqual(['## Accessible composition (new)', 'section order (changed)']);
    expect(staleSections('# Badge\n\nA label.\n', recorded)).toEqual(['## When to use (removed)', 'section order (changed)']);
    expect(staleSections(english, undefined)).toEqual(['# Badge (new)', '## When to use (new)']);
    // Moving a section changes no section's text, but the order is a change.
    const page = (...names: string[]) => `# A\n\n${names.map((name) => `## ${name}\n\n${name} text.\n`).join('\n')}`;
    const before = sourceRecord(page('B', 'C', 'D', 'E'));
    expect(staleSections(page('E', 'B', 'C', 'D'), before)).toEqual(['section order (changed)']);
    // A move is still reported when a section also changed or was added.
    expect(staleSections(page('E', 'B', 'C', 'D').replace('B text.', 'B edited.'), before)).toEqual(['## B (changed)', 'section order (changed)']);
    expect(staleSections(page('E', 'B', 'C', 'D', 'F'), before)).toEqual(['## F (new)', 'section order (changed)']);
    // The order is recorded on its own, so a tool that sorts the JSON keys does not read as a move.
    const sorted = Object.fromEntries(Object.entries(sourceRecord(page('B', 'C'))).sort());
    expect(staleSections(page('B', 'C'), sorted)).toEqual([]);
    // A heading inside a code block of any fence style is code, not a section.
    for (const fence of ['```md\n## Code\n```', '~~~md\n## Code\n~~~', '````md\n```\n## Code\n```\n````', '- Item\n\n  ```md\n  ## Code\n  ```']) {
      expect(sections(`# A\n\n${fence}\n\n## B\n`).map((part) => part.heading), fence).toEqual(['# A', '## B']);
    }
    // Code blocks are left out of a section's block count and out of the prose the shape test reads.
    expect(sections('# A\n\nText.\n\n```ts\nx\n```\n\n<Demo />\n')[0]!.blocks).toBe(2);
    // Link targets and hrefs are compared; link text and titles are translated.
    expect(links('[Tokens](/tokens "Design tokens")\n\n[ref]: /ref\n\n<a href={`/x/${y}#props`}>x</a> <Link href="/y">y</Link>\n')).toEqual(['/ref', '/tokens', '/y', '{`/x/${y}#props`}']);
    expect(links('[토큰](/tokens "디자인 토큰")\n')).toEqual(links('[Tokens](/tokens "Design tokens")\n'));
    expect(codeBlocks('Text.\n\n~~~ts\nimport x from "y";\n~~~\n')).toEqual({ code: ['~~~ts\nimport x from "y";\n~~~'], rest: 'Text.\n\n\n' });
  });

  it('stamps a translated page, drops a removed one and refuses an untranslated one', () => {
    const app = mkdtempSync(join(tmpdir(), 'todae-stamp-'));
    try {
      for (const [dir, text] of [['(en)/badge', '# Badge\n'], ['ko/badge', '# Badge\n'], ['(en)/card', '# Card\n']] as const) {
        mkdirSync(join(app, dir), { recursive: true });
        writeFileSync(join(app, dir, 'page.mdx'), text);
      }
      const { sources, log } = stamp(app, 'ko', { gone: { '# Gone': 'x' } }, ['badge', 'gone']);
      expect(sources).toEqual({ badge: sourceRecord('# Badge\n') });
      expect(log).toEqual(['ko/badge: # Badge (new)', 'ko/gone: dropped']);
      // A record whose English page is still there is kept until the page is translated again.
      expect(() => stamp(app, 'ko', { card: { '# Card': 'x' } }, ['card'])).toThrow(/translate it first/);
      // A slug must name a translated page's folder exactly.
      for (const slug of ['/badge/', 'recipes//combobox', './badge', '../ko/badge', 'Badge']) expect(() => stamp(app, 'ko', {}, [slug]), slug).toThrow(/as in the URL/);
      // An inherited name is not a recorded page.
      expect(() => stamp(app, 'ko', {}, ['constructor'])).toThrow(/translate it first/);
      // A translated page whose English page is gone is not stamped or dropped.
      mkdirSync(join(app, 'ko', 'only'), { recursive: true });
      writeFileSync(join(app, 'ko', 'only', 'page.mdx'), '# Only\n');
      expect(() => stamp(app, 'ko', { only: { '# Only': 'x' } }, ['only'])).toThrow(/No English page.mdx/);
    } finally {
      rmSync(app, { recursive: true, force: true });
    }
  });

  it('translates every page in a complete locale', () => {
    for (const locale of COMPLETE_LOCALES) expect(untranslatedSlugs(locale), `pages with no app/${locale} translation`).toEqual([]);
  });

  it('translates only pages that exist in English', () => {
    const english = new Set(Object.keys(ENGLISH_PAGES));
    for (const locale of LOCALES.filter((item) => item !== 'en')) {
      for (const slug of slugs(join(APP, locale))) expect(english.has(slug), `${locale}/${slug}`).toBe(true);
    }
  });

  it('falls back only where there is no translation', () => {
    expect(untranslatedSlugs('ko').length + slugs(join(APP, 'ko')).length).toBe(Object.keys(ENGLISH_PAGES).length);
    // A locale with one translated page falls back for the rest.
    const app = mkdtempSync(join(tmpdir(), 'todae-i18n-'));
    try {
      mkdirSync(join(app, 'ko', 'guides', 'build-on-todae'), { recursive: true });
      writeFileSync(join(app, 'ko', 'guides', 'build-on-todae', 'page.mdx'), '# Guide\n');
      const fallback = untranslatedSlugs('ko', app);
      expect(untranslatedByLocale(app)).toEqual({ ko: fallback });
      expect(fallback).toContain('button');
      expect(fallback).not.toContain('guides/build-on-todae');
      expect(fallback).toHaveLength(Object.keys(ENGLISH_PAGES).length - 1);
    } finally {
      rmSync(app, { recursive: true, force: true });
    }
  });

  it('redirects old URLs in every locale', () => {
    const config = readFileSync(join(process.cwd(), 'next.config.mjs'), 'utf8');
    const prefixes = /LOCALE_PREFIXES = (\[[^\]]*\])/.exec(config)?.[1]?.replaceAll("'", '"');
    expect(JSON.parse(prefixes ?? '[]')).toEqual(LOCALES.filter((locale) => locale !== 'en').map((locale) => `/${locale}`));
  });

  it('refuses to guess when the app directory is wrong', () => {
    expect(() => untranslatedSlugs('ko', join(APP, 'missing'))).toThrow(/No ko pages/);
  });

  it('keeps component and pattern names in English in Korean link text', () => {
    // A recipe is named after the component or pattern it builds; that name stays as it is in English.
    const recipes = SITE_GROUPS.find((group) => group.id === 'recipes')?.links ?? [];
    for (const [href, label] of recipes) {
      const name = label.replace(/ with .*$/, '');
      expect(DICTIONARIES.ko.links[href] ?? label, href).toContain(name);
    }
  });

  it('names every section in Korean', () => {
    expect(SITE_GROUPS.filter((group) => !DICTIONARIES.ko.groups[group.id])).toEqual([]);
  });

  it('keeps the Korean sidebar in Korean URLs', () => {
    path.current = '/ko/guides/build-on-todae';
    render(<SiteNav locale="ko" />);
    const nav = screen.getByRole('navigation', { name: '사이트' });
    const hrefs = [...nav.querySelectorAll('a')].map((link) => link.getAttribute('href'));
    expect(hrefs).toHaveLength(SITE_GROUPS.reduce((count, group) => count + group.links.length, 0));
    expect(hrefs.every((href) => href?.startsWith('/ko/'))).toBe(true);
    expect(screen.getByRole('list', { name: '컴포넌트' })).toBeTruthy();
    const current = [...nav.querySelectorAll('[aria-current="page"]')];
    expect(current.map((link) => link.textContent)).toEqual(['Todae로 디자인 시스템 만들기']);
  });

  it('lists every section but Foundations alphabetically, in the same order in each language', () => {
    const byName = (a: string, b: string) => a.localeCompare(b, 'en', { sensitivity: 'base' });
    for (const group of SITE_GROUPS.filter(({ id }) => id !== 'foundations')) {
      const names = group.links.map(([, label]) => label);
      expect(names, group.id).toEqual([...names].sort(byName));
    }
    const english = SITE_GROUPS.flatMap((group) => group.links.map(([href]) => href));
    for (const locale of LOCALES) {
      cleanup();
      render(<SiteNav locale={locale} />);
      const hrefs = [...screen.getByRole('navigation').querySelectorAll('a')].map((link) => link.getAttribute('href'));
      expect(hrefs.map((href) => stripLocale(href ?? '')), locale).toEqual(english);
    }
  });

  it('switches to the same page in each language', () => {
    path.current = '/ko/utilities/use-field';
    render(<LanguageSwitcher locale="ko" />);
    const nav = screen.getByRole('navigation', { name: '언어' });
    const links = [...nav.querySelectorAll('a')];
    expect(links.map((link) => [link.getAttribute('href'), link.getAttribute('lang'), link.textContent])).toEqual([
      ['/utilities/use-field', 'en', 'English'],
      ['/ko/utilities/use-field', 'ko', '한국어'],
    ]);
    expect(links.map((link) => link.getAttribute('aria-current'))).toEqual([null, 'true']);
  });

  it('keeps the query and hash when switching, through every URL change', async () => {
    // jsdom has no Navigation API, so stand in for the currententrychange it fires on each URL change.
    const navigation = new EventTarget();
    Object.defineProperty(window, 'navigation', { value: navigation, configurable: true });
    const setUrl = (url: string) => {
      window.history.replaceState(null, '', url);
      navigation.dispatchEvent(new Event('currententrychange'));
    };
    // Like Next, which changes the URL in an insertion effect as the new path commits.
    function Router({ url }: { url: string }) {
      useInsertionEffect(() => setUrl(url), [url]);
      return <LanguageSwitcher locale="en" />;
    }
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      path.current = '/tokens';
      const { rerender } = render(<Router url="/tokens?x=1#contrast" />);
      const korean = () => screen.getByRole('link', { name: '한국어' }).getAttribute('href');
      expect(korean()).toBe('/ko/tokens?x=1#contrast');
      await act(async () => setUrl('/tokens#props'));
      expect(korean()).toBe('/ko/tokens#props');
      // A client-side navigation to the same path drops the hash with no hashchange or popstate.
      await act(async () => rerender(<Router url="/tokens" />));
      expect(korean()).toBe('/ko/tokens');
      path.current = '/link';
      await act(async () => rerender(<Router url="/link#billing" />));
      expect(korean()).toBe('/ko/link#billing');
      expect(error).not.toHaveBeenCalled();
    } finally {
      error.mockRestore();
      Reflect.deleteProperty(window, 'navigation');
      window.history.replaceState(null, '', '/');
    }
  });

  it('sends a 404 to each home page, since the path is missing in every language', () => {
    path.current = '/ko/nope';
    render(<LanguageSwitcher locale="en" toHome />);
    const hrefs = [...screen.getByRole('navigation', { name: 'Language' }).querySelectorAll('a')].map((link) => link.getAttribute('href'));
    expect(hrefs).toEqual(['/', '/ko']);
  });

  it('lists the Korean home page in Korean', () => {
    const { container } = render(<HomeContent locale="ko" />);
    for (const name of SITE_GROUPS.map((group) => DICTIONARIES.ko.groups[group.id] ?? '')) {
      expect(screen.getByRole('heading', { level: 2, name })).toBeTruthy();
    }
    const hrefs = [...container.querySelectorAll('a')].map((link) => link.getAttribute('href') ?? '');
    const pages = new Set([...Object.keys(ENGLISH_PAGES)].map((slug) => `/ko/${slug}`));
    for (const href of hrefs) expect(pages.has(href), href).toBe(true);
  });

  it('keeps MDX links in the reader’s language', () => {
    path.current = '/ko/button';
    render(
      <>
        <LocalizedLink href="/tokens">Tokens</LocalizedLink>
        <LocalizedLink href="https://example.com">External</LocalizedLink>
      </>,
    );
    expect(screen.getByRole('link', { name: 'Tokens' }).getAttribute('href')).toBe('/ko/tokens');
    expect(screen.getByRole('link', { name: 'External' }).getAttribute('href')).toBe('https://example.com');
  });

  it('localizes every same-site link in a page or demo', () => {
    // MDX maps markdown links to LocalizedLink, but not a JSX <a>, so those must use LocalizedLink themselves.
    const files = [join(APP, '(en)'), join(APP, 'ko'), join(process.cwd(), 'components/demos')].flatMap((dir) =>
      readdirSync(dir, { recursive: true, encoding: 'utf8' })
        .filter((file) => /\.(mdx|tsx)$/.test(file) && !file.includes('.test.'))
        .map((file) => join(dir, file)),
    );
    expect(files.length).toBeGreaterThan(30);
    // <a> or next/link's <Link> with href="/x", href={'/x'} or href={`/x`}.
    const sameSite = /<(a|Link)\s[^>]*href=\{?["'`]\/(?!\/)/;
    expect(files.filter((file) => sameSite.test(readFileSync(file, 'utf8')))).toEqual([]);
  });

  it('pairs a page with its other languages for search engines', () => {
    path.current = '/ko/tokens';
    render(<LanguageAlternates />);
    // React hoists these into the document head.
    const links = [...document.head.querySelectorAll('link[rel="alternate"]')];
    expect(links.map((link) => [link.getAttribute('hreflang'), link.getAttribute('href')])).toEqual([
      ['en', `${DOCS_ORIGIN}/tokens`],
      ['ko', `${DOCS_ORIGIN}/ko/tokens`],
      ['x-default', `${DOCS_ORIGIN}/tokens`],
    ]);
  });

  it('leaves out a language that only shows the English page', () => {
    path.current = '/ko/tokens';
    render(<LanguageAlternates untranslated={{ ko: ['tokens'] }} />);
    expect(document.head.querySelectorAll('link[rel="alternate"]')).toHaveLength(0);
    cleanup();
    path.current = '/ko/recipes/combobox';
    render(<LanguageAlternates untranslated={{ ko: ['tokens'] }} />);
    expect([...document.head.querySelectorAll('link[rel="alternate"]')].map((link) => link.getAttribute('hreflang'))).toEqual(['en', 'ko', 'x-default']);
  });

  it('opens the first component in the sidebar from the top bar, in each language', () => {
    const first = SITE_GROUPS.find((group) => group.id === 'components')?.links[0]?.[0];
    for (const locale of LOCALES) {
      const markup = renderToStaticMarkup(<SiteShell locale={locale}>x</SiteShell>);
      const top = /<nav class="top-links"[^>]*>(.*?)<\/nav>/.exec(markup)?.[1] ?? '';
      const label = DICTIONARIES[locale].topLinks.components;
      expect(top, locale).toContain(`href="${locale === 'en' ? '' : `/${locale}`}${first}">${label}<`);
    }
  });

  it('names the license in the footer, in each language', () => {
    for (const locale of LOCALES) {
      const { license, licenseName } = DICTIONARIES[locale];
      expect(license.split('{license}'), locale).toHaveLength(2);
      // The name shown is the LICENSE file's, in the page language.
      expect(licenseName, locale).toContain(LICENSE.id);
      const markup = renderToStaticMarkup(<SiteShell locale={locale}>x</SiteShell>);
      const footer = new DOMParser().parseFromString(markup, 'text/html').querySelector('footer');
      const [licenseLine, copyright] = [...(footer?.querySelectorAll('p') ?? [])];
      expect(licenseLine?.textContent, locale).toBe(license.replace('{license}', licenseName));
      const link = licenseLine?.querySelector('a');
      expect(link?.textContent, locale).toBe(licenseName);
      expect(link?.getAttribute('href'), locale).toBe(LICENSE.href);
      expect(copyright?.textContent, locale).toBe(`Copyright © ${LICENSE.year} ${LICENSE.holder}`);
    }
    expect(DICTIONARIES.en.licenseName).toBe(`${LICENSE.id} License`);
  });

  it('gives the shell each locale’s untranslated pages, and no alternates on a 404', () => {
    const alternates = (markup: string) => [...markup.matchAll(/<link[^>]*rel="alternate"[^>]*>/g)].length;
    path.current = '/ko/tokens';
    try {
      untranslated.current = { ko: [] };
      expect(alternates(renderToStaticMarkup(<SiteShell locale="ko">x</SiteShell>))).toBe(3);
      untranslated.current = { ko: ['tokens'] };
      expect(alternates(renderToStaticMarkup(<SiteShell locale="ko">x</SiteShell>))).toBe(0);
      // The English page has no Korean version to pair with either.
      path.current = '/tokens';
      expect(alternates(renderToStaticMarkup(<SiteShell locale="en">x</SiteShell>))).toBe(0);
      // A 404 has no page to pair, so it does not read which pages exist at all.
      untranslated.current = undefined;
      untranslatedRead.current = vi.fn();
      path.current = '/_not-found';
      expect(alternates(renderToStaticMarkup(<SiteShell locale="en" notFound>x</SiteShell>))).toBe(0);
      expect(untranslatedRead.current).not.toHaveBeenCalled();
    } finally {
      untranslated.current = undefined;
      untranslatedRead.current = undefined;
      path.current = '/ko/button';
    }
  });

  it('names examples in the page language and marks their English demo copy', () => {
    path.current = '/ko/button';
    render(
      <Example>
        <button type="button">Save</button>
      </Example>,
    );
    const group = screen.getByRole('group', { name: '예시' });
    expect(group.getAttribute('lang')).toBeNull();
    expect(screen.getByRole('button', { name: 'Save' }).closest('[lang]')?.getAttribute('lang')).toBe('en');
    cleanup();
    path.current = '/button';
    render(
      <Example>
        <button type="button">Save</button>
      </Example>,
    );
    expect(screen.getByRole('group', { name: 'Example' }).querySelector('[lang]')).toBeNull();
  });

  it('translates every prop description a page shows, from the current English', () => {
    const shown = new Set(
      readdirSync(join(APP, '(en)'), { recursive: true, encoding: 'utf8' })
        .filter((file) => file.endsWith('page.mdx'))
        .flatMap((file) => [...readFileSync(join(APP, '(en)', file), 'utf8').matchAll(/<PropsTable\s+name="([^"]+)"/g)].map((hit) => hit[1])),
    );
    const english = Object.fromEntries(
      schema.components.filter((component) => shown.has(component.name) && component.props.length > 0).map((component) => [component.name, Object.fromEntries(component.props.map((prop) => [prop.name, prop.description]))]),
    );
    for (const locale of LOCALES.filter((other) => other !== 'en')) {
      const translations = PROP_TRANSLATIONS[locale] ?? {};
      // The English each translation was made from must still be the English: when a description changes, its translation must too.
      const sources = Object.fromEntries(
        Object.entries(translations).map(([component, props]) => [component, Object.fromEntries(Object.entries(props).map(([prop, entry]) => [prop, entry.en]))]),
      );
      expect(sources, `${locale} prop translations`).toEqual(english);
      for (const props of Object.values(translations)) for (const entry of Object.values(props)) expect(entry[locale]).toBeTruthy();
    }
  });

  it('shows a props table in the page language', () => {
    try {
      path.current = '/ko/button';
      const korean = renderToStaticMarkup(<PropsTable name="Button.Root" />);
      // Nothing but the table inside its scroll region.
      expect(korean).toMatch(/data-scroll-kind="table"[^>]*><div class="[^"]+"><table lang="ko" role="table" class="[^"]+"><caption class="[^"]+">Button.Root props<\/caption>/);
      expect(korean).toMatch(/<th scope="col" role="columnheader" class="[^"]+">설명<\/th>/);
      expect(korean).toContain('<p>시각 스타일. primary가 아니면 data-button-variant를 설정합니다.</p>');
      path.current = '/button';
      const english = renderToStaticMarkup(<PropsTable name="Button.Root" />);
      expect(english).toMatch(/data-scroll-kind="table"[^>]*><div class="[^"]+"><table lang="en" role="table" class="[^"]+">/);
      expect(english).toMatch(/<th scope="col" role="columnheader" class="[^"]+">Description<\/th>/);
      expect(english).toContain('<p>Visual style. Non-primary sets data-button-variant.</p>');
    } finally {
      path.current = '/ko/button';
    }
  });

  it('shows token catalog headings in the page language', () => {
    try {
      path.current = '/ko/tokens';
      expect(renderToStaticMarkup(<TokensCatalog />)).toMatch(/<th scope="col" class="[^"]+">경로<\/th><th scope="col" class="[^"]+">컨텍스트<\/th><th scope="col" class="[^"]+">CSS 변수<\/th>/);
      path.current = '/tokens';
      expect(renderToStaticMarkup(<TokensCatalog />)).toMatch(/<th scope="col" class="[^"]+">Path<\/th><th scope="col" class="[^"]+">Context<\/th><th scope="col" class="[^"]+">CSS variable<\/th>/);
    } finally {
      path.current = '/ko/button';
    }
  });

  it('shows the current English, marked as English, where a translation is missing or out of date', () => {
    expect(propDescription('ko', 'Button.Root', 'variant', 'Visual style. Non-primary sets data-button-variant.')).toEqual({
      text: '시각 스타일. primary가 아니면 data-button-variant를 설정합니다.',
      lang: 'ko',
    });
    expect(propDescription('ko', 'Button.Root', 'variant', 'Newer English.')).toEqual({ text: 'Newer English.', lang: 'en' });
    expect(propDescription('ko', 'Button.Root', 'nope', 'New prop.')).toEqual({ text: 'New prop.', lang: 'en' });
    expect(propDescription('en', 'Button.Root', 'variant', 'Visual style.')).toEqual({ text: 'Visual style.', lang: 'en' });
  });

  it('marks an untranslated page as English and links the guide', () => {
    const { container } = render(
      <UntranslatedPage locale="ko">
        <h1>Button</h1>
      </UntranslatedPage>,
    );
    expect(screen.getByRole('note').textContent).toContain(DICTIONARIES.ko.untranslated);
    expect(screen.getByRole('link', { name: DICTIONARIES.ko.contribute }).getAttribute('href')).toMatch(/TRANSLATING\.md$/);
    expect(container.querySelector('[lang="en"] h1')?.textContent).toBe('Button');
  });
});
