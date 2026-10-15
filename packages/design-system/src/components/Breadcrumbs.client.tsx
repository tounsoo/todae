import { GlyphsProvider, useGlyphs } from '../providers/GlyphsProvider.js';
import { useStrings } from '../providers/StringsProvider.js';
import { ItemWithGlyph, Breadcrumbs as ServerBreadcrumbs, type BreadcrumbsItemProps, type BreadcrumbsRootProps } from './Breadcrumbs.js';

export type { BreadcrumbsItemProps, BreadcrumbsRootProps } from './Breadcrumbs.js';

// A separator prop set on the trail beats the provider's glyph. The provider
// is always there, so setting the prop never remounts the trail.
const TEXT_SEPARATOR = { separator: null };
const NO_CHANGE = {};

// The main entry's Root: the server one, named by StringsProvider.
function Root(props: BreadcrumbsRootProps) {
  const { breadcrumbs } = useStrings();
  const root = <ServerBreadcrumbs.Root {...props} aria-label={props['aria-label'] || (props['aria-labelledby'] ? undefined : breadcrumbs)} />;
  return <GlyphsProvider glyphs={props.separator === undefined ? NO_CHANGE : TEXT_SEPARATOR}>{root}</GlyphsProvider>;
}

// The main entry's Item: draws the separator glyph from GlyphsProvider, when
// one is set, in place of the separator text.
function Item(props: BreadcrumbsItemProps) {
  return <ItemWithGlyph {...props} separatorGlyph={useGlyphs().separator} />;
}

export const Breadcrumbs = { ...ServerBreadcrumbs, Root, Item } as const;
