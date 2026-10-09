import { useStrings } from '../providers/StringsProvider';
import { Pagination as ServerPagination, type PaginationRootProps } from './Pagination';

export {
  paginationRange,
  type PaginationEllipsisProps,
  type PaginationItemProps,
  type PaginationRangeItem,
  type PaginationRangeOptions,
  type PaginationRootProps,
} from './Pagination';

// The main entry's Root: the server one, named by StringsProvider.
function Root(props: PaginationRootProps) {
  const { pagination } = useStrings();
  return <ServerPagination.Root {...props} aria-label={props['aria-label'] || (props['aria-labelledby'] ? undefined : pagination)} />;
}

export const Pagination = { ...ServerPagination, Root } as const;
