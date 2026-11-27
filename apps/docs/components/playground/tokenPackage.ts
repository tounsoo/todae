import { parseThemeValue, type ThemeOverride, type ThemeOverrideKey } from '@tounsoo/todae';
import catalog from '@tounsoo/todae/tokens.json';
import { overridesPackage, type CatalogRow } from '../../lib/token-package/overrides';
import { BUILD_COMMAND, TOKENS_FOLDER } from '../../lib/token-package/package';
import { zipFiles } from '../../lib/token-package/zip';
import { DOCS_ORIGIN } from '../../lib/origin';

export type PlaygroundPackageInput = {
  /** The package's name: the preset's id, such as "graphite". */
  name: string;
  /** The preset's display name, for the README. */
  presetName: string;
  /** Everything the stage applies in each appearance. */
  light: ThemeOverride;
  dark: ThemeOverride;
};

function list(paths: readonly string[]): string {
  return paths.map((path) => `- \`${path}\``).join('\n');
}

function readme(name: string, presetName: string, files: readonly string[], result: ReturnType<typeof overridesPackage>): string {
  const lines = [
    `# ${name} tokens`,
    '',
    `A company token package for Todae, exported from the Playground starting from the ${presetName} preset. It layers on Todae's own tokens: each file holds only the tokens it changes, in the set or modifier that declares them.`,
    '',
    `Put this \`${TOKENS_FOLDER}\` folder at your project root, install \`@tounsoo/todae\`, and build the theme CSS and override types:`,
    '',
    '```sh',
    BUILD_COMMAND,
    '```',
    '',
    'The build checks the tokens, including the APCA contrast pairs Todae keeps, and names any it fails with a fix.',
    '',
    '## Files',
    '',
    list(files),
    '',
    `Rename the package in \`resolver.json\` (\`name\`) if you like. [Build on Todae](${DOCS_ORIGIN}/guides/build-on-todae) explains each set and modifier.`,
  ];
  if (result.split.length > 0) {
    lines.push(
      '',
      '## Tokens that differ by appearance',
      '',
      `Todae declares these once for both appearances, but the Playground set them differently in light and dark. Each reads a \`${result.root}.*\` token that \`appearance/light.json\` and \`appearance/dark.json\` declare:`,
      '',
      list(result.split),
    );
  }
  if (result.unsplit.length > 0) {
    lines.push(
      '',
      '## One value for both appearances',
      '',
      'The Playground showed these differently in light and dark, but the package could not split them, so they get one value in both. Check them in dark:',
      '',
      list(result.unsplit),
    );
  }
  if (result.skipped.length > 0) {
    lines.push('', '## Left out', '', "Todae's token catalog does not know these overrides:", '', list(result.skipped));
  }
  return `${lines.join('\n')}\n`;
}

/**
 * The Playground's theme as a token package: the token files, a README, and the
 * same files as one ZIP, laid out as `tokens/…`. The Playground loads this
 * module only when the reader asks for the package, since the catalog is large.
 */
export function playgroundPackage({ name, presetName, light, dark }: PlaygroundPackageInput) {
  const result = overridesPackage({
    name,
    description: `Exported from the Todae Playground, starting from the ${presetName} preset.`,
    light: light as Record<string, unknown>,
    dark: dark as Record<string, unknown>,
    catalog: (catalog as { tokens: CatalogRow[] }).tokens,
    parse: (path, css) => parseThemeValue(path as ThemeOverrideKey, css),
  });
  const paths = Object.keys(result.files);
  const files: Record<string, string> = {};
  for (const [path, contents] of Object.entries(result.files)) files[`${TOKENS_FOLDER}/${path}`] = contents;
  files[`${TOKENS_FOLDER}/README.md`] = readme(name, presetName, paths, result);
  return { ...result, archive: files, zip: zipFiles(files), fileName: `${name}-tokens.zip` };
}
