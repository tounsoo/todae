import { GroupIndexPage, groupIndexMetadata } from '../../../components/GroupIndex';

export const metadata = groupIndexMetadata('ko', 'components');

export default function KoreanComponentsIndexPage() {
  return <GroupIndexPage locale="ko" id="components" />;
}
