import { Playground } from '../../../components/Playground';
import { DICTIONARIES } from '../../../lib/i18n/dictionaries';
import { pageMetadata } from '../../../lib/i18n/metadata';

export const metadata = pageMetadata({
  locale: 'ko',
  slug: 'playground',
  title: DICTIONARIES.ko.playground.title,
  description: DICTIONARIES.ko.playground.lead,
});

export default function KoreanPlaygroundPage() {
  return <Playground locale="ko" />;
}
