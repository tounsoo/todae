#!/usr/bin/env node
import { buildTokens } from './tokens/build.ts';
import { cli } from './tokens/cli.ts';

const args = process.argv.slice(2);
try {
  // `self` rebuilds Todae's own generated files; it is for this repo's scripts only.
  if (args[0] === 'self') await buildTokens({ check: args.includes('--check') });
  else await cli(args);
} catch (error) {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
}
