import designSystem from '../../../packages/design-system/package.json';

/** The site footer's release line, and the version the MCP server reports. The docs build from the package's source, so this is the version its `package.json` holds. Production deploys from `docs-stable`, which only reaches commits whose package is on npm, so there it is the published version. */
export const RELEASE = {
  version: designSystem.version,
  changelogHref: 'https://github.com/tounsoo/todae/blob/main/packages/design-system/CHANGELOG.md',
} as const;
