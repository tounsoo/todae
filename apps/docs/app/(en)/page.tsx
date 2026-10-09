import { HomeContent } from '../../components/HomeContent';
import { DICTIONARIES } from '../../lib/i18n/dictionaries';
import { pageMetadata, SITE_NAME } from '../../lib/i18n/metadata';

export const metadata = pageMetadata({
  locale: 'en',
  slug: '',
  title: SITE_NAME,
  description: DICTIONARIES.en.hero.lead,
});

export default function HomePage() {
  return <HomeContent locale="en" />;
}
