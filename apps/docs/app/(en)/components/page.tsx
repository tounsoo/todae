import { GroupIndexPage, groupIndexMetadata } from '../../../components/GroupIndex';

export const metadata = groupIndexMetadata('en', 'components');

export default function ComponentsIndexPage() {
  return <GroupIndexPage locale="en" id="components" />;
}
