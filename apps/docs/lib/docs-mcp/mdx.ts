import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

export const DOCS_ORIGIN = 'https://todae-rho.vercel.app';

export type PageDoc = {
  slug: string;
  title: string;
  props: string[];
  whenToUse: string | null;
  whenNotToUse: string | null;
};

const WHEN_TO_USE = 'When to use';
const WHEN_NOT_TO_USE = 'When not to use';

function absolutize(markdown: string): string {
  return markdown.replace(/\]\(([^)\s]+)\)/g, (match, href: string) => {
    if (/^[a-z][a-z0-9+.-]*:/i.test(href) || href.startsWith('#')) return match;
    const path = href.startsWith('/') ? href : `/${href.replace(/^\.\//, '')}`;
    return `](${DOCS_ORIGIN}${path})`;
  });
}

function section(markdown: string, heading: string): string | null {
  const lines = markdown.split('\n');
  const start = lines.findIndex((line) => line === `## ${heading}`);
  if (start < 0) return null;
  let end = lines.length;
  for (let i = start + 1; i < lines.length; i++) {
    const line = lines[i];
    if (line !== undefined && /^#{1,2} /.test(line)) {
      end = i;
      break;
    }
  }
  return absolutize(lines.slice(start + 1, end).join('\n').trim());
}

function readPages(): PageDoc[] {
  const appDir = join(process.cwd(), 'app');
  let entries: string[];
  try {
    entries = readdirSync(appDir, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name);
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    throw new Error(`Failed to read docs pages: ${detail}`);
  }

  return entries.flatMap((slug) => {
    const file = join(appDir, slug, 'page.mdx');
    let markdown: string;
    try {
      markdown = readFileSync(file, 'utf8');
    } catch (error) {
      const code = typeof error === 'object' && error && 'code' in error ? error.code : undefined;
      if (code === 'ENOENT') return [];
      const detail = error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to read ${slug}/page.mdx: ${detail}`);
    }
    const titleLine = markdown.split('\n').find((line) => line.startsWith('# '));
    if (!titleLine) throw new Error(`Missing title in ${slug}/page.mdx`);
    const props = [...markdown.matchAll(/<PropsTable\s+name="([^"]+)"\s*\/>/g)].map((hit) => hit[1] ?? '');
    return [
      {
        slug,
        title: titleLine.slice(2),
        props,
        whenToUse: section(markdown, WHEN_TO_USE),
        whenNotToUse: section(markdown, WHEN_NOT_TO_USE),
      },
    ];
  });
}

const pages = readPages();

export function pageFor(name: string): PageDoc | null {
  return pages.find((page) => page.props.includes(name) || page.title === name) ?? null;
}

export function docsUrlFor(name: string): string | null {
  const page = pageFor(name);
  return page ? `${DOCS_ORIGIN}/${page.slug}` : null;
}
