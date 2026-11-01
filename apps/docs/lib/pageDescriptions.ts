import { join } from 'node:path';
import { loadPages } from './docs-mcp/mdx';
import type { Locale } from './i18n/config';
import { parseMdx } from './mdxAst';
import { pageSummary } from './pageSummary.mjs';

const LOCALE_DIRS: Record<Locale, string> = { en: '(en)', ko: 'ko' };

const cache = new Map<string, ReadonlyMap<string, string>>();

/**
 * The intro of each MDX page in `locale`, keyed by slug. A page with no intro
 * is absent, so a catalog can leave that line out. Build time only.
 */
export function pageDescriptions(locale: Locale, appDir = join(process.cwd(), 'app')): ReadonlyMap<string, string> {
  const key = `${locale}\0${appDir}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const descriptions = new Map<string, string>();
  for (const page of loadPages(join(appDir, LOCALE_DIRS[locale]))) {
    const summary = pageSummary(parseMdx(page.markdown));
    const description = summary && typeof summary.description === 'string' ? summary.description : '';
    if (description) descriptions.set(page.slug, description);
  }
  cache.set(key, descriptions);
  return descriptions;
}
