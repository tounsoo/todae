import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { UntranslatedPage } from '../../../components/UntranslatedPage';
import { ENGLISH_PAGES } from '../../../lib/i18n/englishPages';
import { untranslatedSlugs } from '../../../lib/i18n/pages';

// Only English pages without a Korean one; a Korean page in app/ko wins its own route.
export const dynamicParams = false;

export function generateStaticParams() {
  return untranslatedSlugs('ko').map((slug) => ({ slug: slug.split('/') }));
}

// The English page is the original; search engines should index that one.
export async function generateMetadata({ params }: { params: Promise<{ slug: string[] }> }): Promise<Metadata> {
  const { slug } = await params;
  return { alternates: { canonical: `/${slug.join('/')}` } };
}

export default async function KoreanFallbackPage({ params }: { params: Promise<{ slug: string[] }> }) {
  const { slug } = await params;
  const load = ENGLISH_PAGES[slug.join('/')];
  if (!load) notFound();
  const { default: Page } = await load();
  return (
    <UntranslatedPage locale="ko">
      <Page />
    </UntranslatedPage>
  );
}
