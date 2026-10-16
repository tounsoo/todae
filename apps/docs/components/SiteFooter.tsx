import { Text } from '@tounsoo/todae/text';
import type { Locale } from '../lib/i18n/config';
import { DICTIONARIES } from '../lib/i18n/dictionaries';
import { LICENSE } from '../lib/license';
import { RELEASE } from '../lib/version';
import { SiteLink } from './SiteLink';

/** The footer on every page: the license, the package version with its changelog, and the copyright. */
export function SiteFooter({ locale }: { locale: Locale }) {
  const dict = DICTIONARIES[locale];
  const [licenseBefore, licenseAfter] = dict.license.split('{license}');
  const [releaseBefore, releaseAfter] = dict.release.replace('{version}', RELEASE.version).split('{changelog}');
  return (
    <footer className="site-footer">
      <div className="site-footer-inner">
        <Text.Root size="s" tone="muted">
          {licenseBefore}
          <SiteLink href={LICENSE.href}>{dict.licenseName}</SiteLink>
          {licenseAfter}
        </Text.Root>
        <Text.Root size="s" tone="muted">
          {releaseBefore}
          <SiteLink href={RELEASE.changelogHref}>{dict.changelog}</SiteLink>
          {releaseAfter}
        </Text.Root>
        <Text.Root size="s" tone="muted">
          {`Copyright © ${LICENSE.year} ${LICENSE.holder}`}
        </Text.Root>
      </div>
    </footer>
  );
}
