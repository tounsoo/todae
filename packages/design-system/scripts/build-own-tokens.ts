// Rebuilds Todae's own generated token files for `pnpm tokens`. It is not
// compiled into dist, so the published `todae-tokens` bin can't run it and
// rewrite files inside an installed package.
import { buildTokens } from './tokens/build.ts';

try {
  await buildTokens({ check: process.argv.includes('--check') });
} catch (error) {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
}
