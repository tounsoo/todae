import { useGlyphs } from '../providers/GlyphsProvider.js';
import { useStrings } from '../providers/StringsProvider.js';
import { glyphOr } from './glyphs.js';
import { Pagination as ServerPagination, type PaginationEllipsisProps, type PaginationRootProps } from './Pagination.js';

export {
  paginationRange,
  type PaginationEllipsisProps,
  type PaginationItemProps,
  type PaginationRangeItem,
  type PaginationRangeOptions,
  type PaginationRootProps,
} from './Pagination.js';

// The main entry's Root: the server one, named by StringsProvider.
function Root(props: PaginationRootProps) {
  const { pagination } = useStrings();
  return <ServerPagination.Root {...props} aria-label={props['aria-label'] || (props['aria-labelledby'] ? undefined : pagination)} />;
}

// The main entry's Ellipsis: with no content, the ellipsis glyph from GlyphsProvider, else "…".
function Ellipsis({ children, ...props }: PaginationEllipsisProps) {
  const { ellipsis } = useGlyphs();
  return <ServerPagination.Ellipsis {...props}>{children ?? glyphOr(ellipsis, '…')}</ServerPagination.Ellipsis>;
}

export const Pagination = { ...ServerPagination, Root, Ellipsis } as const;
