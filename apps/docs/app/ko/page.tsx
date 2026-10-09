import { HomeContent } from '../../components/HomeContent';
import { DICTIONARIES } from '../../lib/i18n/dictionaries';
import { pageMetadata, SITE_NAME } from '../../lib/i18n/metadata';

export const metadata = pageMetadata({
  locale: 'ko',
  slug: '',
  title: SITE_NAME,
  description: DICTIONARIES.ko.hero.lead,
});

export default function KoreanHomePage() {
  return <HomeContent locale="ko" />;
}
