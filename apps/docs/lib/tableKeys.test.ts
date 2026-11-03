import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const css = readFileSync(join(process.cwd(), 'app/globals.css'), 'utf8');

describe('docs table row headers', () => {
  it('keeps a key name on one line in the shared table styles', () => {
    const rule = css.match(/\.docs-prose > \.scroll-x th\[scope="row"\]\s*\{[^}]*\}/)?.[0] ?? '';
    expect(rule).toContain('white-space: nowrap');
  });

  it('does not force that on a props table, which sets its own wrap', () => {
    expect(css).toMatch(/\.props-table tbody :is\(th, td\)\s*\{[^}]*white-space:\s*normal/);
  });
});
