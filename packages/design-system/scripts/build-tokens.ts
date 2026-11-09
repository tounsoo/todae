#!/usr/bin/env node
import { cli } from './tokens/cli.ts';

try {
  await cli(process.argv.slice(2));
} catch (error) {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
}
