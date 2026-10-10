import { useGlyphs } from '../providers/GlyphsProvider';
import { useStrings } from '../providers/StringsProvider';
import { Pagination as ServerPagination, type PaginationEllipsisProps, type PaginationRootProps } from './Pagination';

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

// The main entry's Ellipsis: with no content, the ellipsis glyph from GlyphsProvider, else "…".
function Ellipsis({ children, ...props }: PaginationEllipsisProps) {
  const { ellipsis } = useGlyphs();
  return <ServerPagination.Ellipsis {...props}>{children ?? ellipsis ?? '…'}</ServerPagination.Ellipsis>;
}

export const Pagination = { ...ServerPagination, Root, Ellipsis } as const;
