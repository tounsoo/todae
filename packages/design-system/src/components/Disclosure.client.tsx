import { useGlyphs } from '../providers/GlyphsProvider';
import { Disclosure as ServerDisclosure, type DisclosureSummaryProps } from './Disclosure';
import styles from './Disclosure.module.css';

export type { DisclosureRootProps, DisclosureSummaryProps } from './Disclosure';

// The main entry's Summary: the server one, drawing the chevron glyph from
// GlyphsProvider in place of the browser's marker when one is set.
function Summary({ children, ...props }: DisclosureSummaryProps) {
  const { chevron } = useGlyphs();
  if (chevron == null) return <ServerDisclosure.Summary {...props}>{children}</ServerDisclosure.Summary>;
  return (
    <ServerDisclosure.Summary {...props} data-glyph="">
      <span className={styles.marker} aria-hidden="true">
        {chevron}
      </span>
      {children}
    </ServerDisclosure.Summary>
  );
}

export const Disclosure = { ...ServerDisclosure, Summary } as const;
