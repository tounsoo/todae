import { Playground } from '../../../components/Playground';
import { DICTIONARIES } from '../../../lib/i18n/dictionaries';
import { pageMetadata } from '../../../lib/i18n/metadata';

export const metadata = pageMetadata({
  locale: 'en',
  slug: 'playground',
  title: DICTIONARIES.en.playground.title,
  description: DICTIONARIES.en.playground.lead,
});

export default function PlaygroundPage() {
  return <Playground locale="en" />;
}
