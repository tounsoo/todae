import { GlyphsProvider, useGlyphs } from '../providers/GlyphsProvider';
import { useStrings } from '../providers/StringsProvider';
import { ItemWithGlyph, Breadcrumbs as ServerBreadcrumbs, type BreadcrumbsItemProps, type BreadcrumbsRootProps } from './Breadcrumbs';

export type { BreadcrumbsItemProps, BreadcrumbsRootProps } from './Breadcrumbs';

// A separator prop is set for this trail, so it beats the provider's glyph.
const TEXT_SEPARATOR = { separator: null };

// The main entry's Root: the server one, named by StringsProvider.
function Root(props: BreadcrumbsRootProps) {
  const { breadcrumbs } = useStrings();
  const root = <ServerBreadcrumbs.Root {...props} aria-label={props['aria-label'] || (props['aria-labelledby'] ? undefined : breadcrumbs)} />;
  return props.separator === undefined ? root : <GlyphsProvider glyphs={TEXT_SEPARATOR}>{root}</GlyphsProvider>;
}

// The main entry's Item: draws the separator glyph from GlyphsProvider, when
// one is set, in place of the separator text.
function Item(props: BreadcrumbsItemProps) {
  return <ItemWithGlyph {...props} separatorGlyph={useGlyphs().separator} />;
}

export const Breadcrumbs = { ...ServerBreadcrumbs, Root, Item } as const;
