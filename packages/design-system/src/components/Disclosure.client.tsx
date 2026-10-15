import { useGlyphs } from '../providers/GlyphsProvider.js';
import { Disclosure as ServerDisclosure, type DisclosureSummaryProps } from './Disclosure.js';
import { hasGlyph } from './glyphs.js';
import styles from './Disclosure.module.css';

export type { DisclosureRootProps, DisclosureSummaryProps } from './Disclosure.js';

// The main entry's Summary: the server one, drawing the chevron glyph from
// GlyphsProvider in place of the browser's marker when one is set. The
// children keep their place either way, so setting a glyph never remounts them.
function Summary({ children, ...props }: DisclosureSummaryProps) {
  const { chevron } = useGlyphs();
  const glyph = hasGlyph(chevron);
  return (
    <ServerDisclosure.Summary {...props} data-glyph={glyph ? '' : undefined}>
      {glyph ? (
        <span className={styles.marker} data-todae-glyph="" aria-hidden="true">
          {chevron}
        </span>
      ) : null}
      {children}
    </ServerDisclosure.Summary>
  );
}

export const Disclosure = { ...ServerDisclosure, Summary } as const;
