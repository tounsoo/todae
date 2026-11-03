// ICU reads LANG when the process starts. Vitest forks workers with this env.
export const testLocaleEnv = {
  TZ: 'UTC',
  LANG: 'en-US.UTF-8',
  LC_ALL: 'en-US.UTF-8',
} as const;

export function pinTestLocale(): void {
  process.env.TZ = testLocaleEnv.TZ;
  process.env.LANG = testLocaleEnv.LANG;
  process.env.LC_ALL = testLocaleEnv.LC_ALL;
}
