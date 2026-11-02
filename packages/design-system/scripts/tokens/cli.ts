import { relative, resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { buildCompanyTokens } from './build.ts';
import { writeOrCheck } from './io.ts';
import { fail } from './shared.ts';

const USAGE = `Usage: todae-tokens build --resolver <file> [options]

Builds a company token package layered on Todae's tokens.

Options:
  --resolver <file>  Company DTCG 2025.10 resolver (required)
  --css <file>       CSS output, layered after Todae's (default: todae-theme.css)
  --catalog <file>   Merged token catalog (default: tokens.catalog.json)
  --types <file>     ThemeProvider overrideTypes module (default: todae-theme.types.ts)
  --base <dir>       Todae tokens directory (default: the installed package's)
  --scope <selector> Apply the theme only inside elements that match the
                     selector, such as ".brand-acme", instead of the whole page
  --check            Fail if the outputs are missing or out of date instead of writing
`;

export async function cli(argv: string[]): Promise<void> {
  const { positionals, values } = parseArgs({
    args: argv,
    allowPositionals: true,
    options: {
      resolver: { type: 'string' },
      css: { type: 'string', default: 'todae-theme.css' },
      catalog: { type: 'string', default: 'tokens.catalog.json' },
      types: { type: 'string', default: 'todae-theme.types.ts' },
      base: { type: 'string' },
      scope: { type: 'string' },
      check: { type: 'boolean', default: false },
      help: { type: 'boolean', default: false },
    },
  });
  if (values.help) {
    process.stdout.write(USAGE);
    return;
  }
  if (positionals[0] !== 'build' || positionals.length !== 1 || !values.resolver) fail(USAGE);
  const result = await buildCompanyTokens({
    resolver: values.resolver,
    ...(values.base ? { base: resolve(values.base) } : {}),
    ...(values.scope === undefined ? {} : { scope: values.scope }),
  });
  const outputs: [string, string][] = [
    [resolve(values.css), result.css],
    [resolve(values.catalog), result.json],
    [resolve(values.types), result.overrideTypes],
  ];
  await writeOrCheck(outputs, values.check, 'todae-tokens --check');
  if (!values.check) process.stdout.write(`Wrote ${outputs.map(([file]) => relative(process.cwd(), file)).join(', ')}\n`);
}
