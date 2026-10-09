import { useStrings } from '../providers/StringsProvider';
import { Breadcrumbs as ServerBreadcrumbs, type BreadcrumbsRootProps } from './Breadcrumbs';

export type { BreadcrumbsItemProps, BreadcrumbsRootProps } from './Breadcrumbs';

// The main entry's Root: the server one, named by StringsProvider.
function Root(props: BreadcrumbsRootProps) {
  const { breadcrumbs } = useStrings();
  return <ServerBreadcrumbs.Root {...props} aria-label={props['aria-label'] || (props['aria-labelledby'] ? undefined : breadcrumbs)} />;
}

export const Breadcrumbs = { ...ServerBreadcrumbs, Root } as const;
