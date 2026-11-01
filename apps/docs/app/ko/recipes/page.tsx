import { GroupIndexPage, groupIndexMetadata } from '../../../components/GroupIndex';

export const metadata = groupIndexMetadata('ko', 'recipes');

export default function KoreanRecipesIndexPage() {
  return <GroupIndexPage locale="ko" id="recipes" />;
}
