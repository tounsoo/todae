// Runs after next build: sorts .next/prerender-manifest.json so a rebuild of the same code writes the same
// deployed output. lib/stableBuild.mjs says why.
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { sortPrerenderManifest } from '../lib/stableBuild.mjs';

const file = join(import.meta.dirname, '..', '.next', 'prerender-manifest.json');
// Next writes it with two-space indents.
writeFileSync(file, JSON.stringify(sortPrerenderManifest(JSON.parse(readFileSync(file, 'utf8'))), null, 2));
