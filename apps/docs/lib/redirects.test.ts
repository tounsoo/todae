import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import config from '../next.config.mjs';

const app = join(dirname(fileURLToPath(import.meta.url)), '..', 'app');

describe('redirects', () => {
  it('sends each removed page, in every locale, to a page that exists', async () => {
    const redirects = await config.redirects!();
    const sources = redirects.map((redirect) => redirect.source);
    expect(sources).toEqual(
      expect.arrayContaining(['/field/time-input', '/ko/field/time-input', '/field/date-time-input', '/ko/field/date-time-input']),
    );
    for (const { source, destination } of redirects) {
      const ko = destination.startsWith('/ko/');
      const page = join(app, ko ? 'ko' : '(en)', ko ? destination.slice(4) : destination.slice(1), 'page.mdx');
      expect(existsSync(page), `${source} → ${destination}`).toBe(true);
    }
  });
});
