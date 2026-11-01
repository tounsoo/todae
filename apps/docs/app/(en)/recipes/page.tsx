import { GroupIndexPage, groupIndexMetadata } from '../../../components/GroupIndex';

export const metadata = groupIndexMetadata('en', 'recipes');

export default function RecipesIndexPage() {
  return <GroupIndexPage locale="en" id="recipes" />;
}
