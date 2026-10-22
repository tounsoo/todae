import { useEffect, useRef } from 'react';
import { useGlyphs } from '../providers/GlyphsProvider.js';
import { Root, Disclosure as ServerDisclosure, type DisclosureSummaryProps } from './Disclosure.js';
import { activeIn } from './activeIn.js';
import { hasGlyph } from './glyphs.js';
import { useComposedRefs } from './props.js';
import { focusWithoutScroll } from './revealRing.js';
import styles from './Disclosure.module.css';

export type { DisclosureRootProps, DisclosureSummaryProps } from './Disclosure.js';

// The main entry's Summary: the server one, drawing the chevron glyph from
// GlyphsProvider in place of the browser's marker when one is set. The
// children keep their place either way, so setting a glyph never remounts them.
function Summary({ children, ref, ...props }: DisclosureSummaryProps) {
  const { chevron } = useGlyphs();
  const glyph = hasGlyph(chevron);
  const own = useRef<HTMLElement>(null);
  const refs = useComposedRefs(own, ref);

  // A disclosure closed by code, such as a prop change, hides the content that
  // has focus, and the browser drops focus to the page. The observer's
  // microtask runs before that in Chromium, Firefox and WebKit, so focus moves
  // to the summary instead, without scrolling a container that follows its end.
  useEffect(() => {
    const summary = own.current;
    const details = summary?.parentElement;
    if (!summary || details?.localName !== 'details') return;
    const observer = new MutationObserver(() => {
      const active = activeIn(details);
      if (!details.hasAttribute('open') && !summary.contains(active) && details.contains(active)) focusWithoutScroll(summary);
    });
    observer.observe(details, { attributes: true, attributeFilter: ['open'] });
    return () => observer.disconnect();
  }, []);

  return (
    <ServerDisclosure.Summary {...props} ref={refs} data-glyph={glyph ? '' : undefined}>
      {glyph ? (
        <span className={styles.marker} data-todae-glyph="" aria-hidden="true">
          {chevron}
        </span>
      ) : null}
      {children}
    </ServerDisclosure.Summary>
  );
}

export const Disclosure = { Root, Summary } as const;
