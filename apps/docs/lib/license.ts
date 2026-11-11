/** The license in the site footer. `license.test.ts` checks it against the LICENSE file and each workspace package.json; the i18n test checks that each locale's `licenseName` contains `id`. */
export const LICENSE = {
  /** SPDX identifier, as in package.json. */
  id: 'MIT',
  year: 2026,
  holder: 'Ben Ho',
  href: 'https://github.com/tounsoo/todae/blob/main/LICENSE',
} as const;
