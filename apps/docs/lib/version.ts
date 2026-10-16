import designSystem from '../../../packages/design-system/package.json';

/** The site footer's release line. The docs build from the package's source, so this is the version its `package.json` holds, which the Version Packages pull request bumps on each release. */
export const RELEASE = {
  version: designSystem.version,
  changelogHref: 'https://github.com/tounsoo/todae/blob/main/packages/design-system/CHANGELOG.md',
} as const;
