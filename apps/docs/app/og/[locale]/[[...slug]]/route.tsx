import { ImageResponse } from 'next/og';
import { OG_IMAGE_SIZE } from '../../../../lib/i18n/metadata';
import { ogFonts } from '../../../../lib/og/fonts';
import { OgCard, ogText } from '../../../../lib/og/OgCard';
import { ogPages } from '../../../../lib/og/pages';

// Drawn once per page at build time; there is nothing to draw for any other path.
export const dynamic = 'force-static';
export const dynamicParams = false;

type Params = { locale: string; slug?: string[] };

const PAGES = ogPages();

export function generateStaticParams(): Params[] {
  return PAGES.map((page) => ({ locale: page.locale, slug: page.slug ? page.slug.split('/') : [] }));
}

// One font request per build worker, cut down to every character any card draws.
let fonts: ReturnType<typeof ogFonts> | undefined;

export async function GET(_request: Request, { params }: { params: Promise<Params> }) {
  const { locale, slug = [] } = await params;
  const page = PAGES.find((item) => item.locale === locale && item.slug === slug.join('/'));
  if (!page) return new Response('Not found', { status: 404 });
  fonts ??= ogFonts(PAGES.map(ogText).join(''));
  return new ImageResponse(<OgCard page={page} />, { ...OG_IMAGE_SIZE, fonts: await fonts });
}
