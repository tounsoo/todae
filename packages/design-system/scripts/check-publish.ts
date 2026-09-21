import { spawnSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

const root = join(import.meta.dirname, '..');

function fail(message: string): never {
  throw new Error(message);
}

type PackFile = { path?: string; filename?: string };

function packPaths(): string[] {
  const result = spawnSync('pnpm', ['pack', '--dry-run', '--json'], {
    cwd: root,
    encoding: 'utf8',
  });
  if (result.status !== 0) fail(result.stderr || result.stdout || 'pnpm pack --dry-run failed');
  const raw = result.stdout.trim();
  if (!raw) fail('pnpm pack --dry-run produced no JSON');
  const parsed = JSON.parse(raw) as { files?: PackFile[] } | PackFile[];
  const files = Array.isArray(parsed) ? parsed : parsed.files;
  if (!files) fail('pnpm pack --dry-run JSON is missing files');
  return files.map((file) => file.path ?? file.filename ?? '').filter(Boolean);
}

const paths = packPaths();
const mustInclude = ['catalog/catalog.json', 'dist/catalog.js', 'dist/catalog/index.d.ts'];
for (const needed of mustInclude) {
  if (!paths.some((path) => path === needed || path.endsWith(`/${needed}`))) {
    fail(`pack must include ${needed}`);
  }
}

const deny = [
  { re: /(^|\/)graft\//, label: 'graft/' },
  { re: /(^|\/)\.env/, label: '.env' },
  { re: /\.meta\.ts$/, label: '*.meta.ts' },
  { re: /\.pattern\.ts$/, label: '*.pattern.ts' },
  { re: /jev/i, label: 'jev' },
];
for (const path of paths) {
  for (const rule of deny) {
    if (rule.re.test(path)) fail(`pack must not include ${rule.label}: ${path}`);
  }
}

const catalogJs = await readFile(join(root, 'dist/catalog.js'), 'utf8');
if (catalogJs.includes('use client')) fail('dist/catalog.js must not contain use client');

const pkg = JSON.parse(await readFile(join(root, 'package.json'), 'utf8')) as {
  dependencies?: Record<string, string>;
};
if (pkg.dependencies && Object.keys(pkg.dependencies).length > 0) {
  fail('package.json dependencies must be absent or empty');
}

process.stdout.write(`check-publish ok (${paths.length} files)\n`);
