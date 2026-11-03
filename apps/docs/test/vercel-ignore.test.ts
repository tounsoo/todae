import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

// Vercel runs ignoreCommand in a shell before each build: exit 0 skips it, anything else builds.
const { ignoreCommand } = JSON.parse(readFileSync(new URL('../vercel.json', import.meta.url), 'utf8')) as {
  ignoreCommand: string;
};

function skips(ref: string | undefined): boolean {
  const env = { PATH: process.env.PATH, ...(ref === undefined ? {} : { VERCEL_GIT_COMMIT_REF: ref }) };
  return spawnSync('sh', ['-c', ignoreCommand], { env }).status === 0;
}

describe('the Vercel ignored build step', () => {
  it("skips the changesets action's temporary branches", () => {
    expect(skips('changesets-ghcommit-temp/changeset-release/main')).toBe(true);
  });

  it.each(['docs-stable', 'main', 'changeset-release/main', 'claude/some-fix', 'fix/changesets-ghcommit-temp/x', ''])(
    'builds %j',
    (ref) => {
      expect(skips(ref)).toBe(false);
    },
  );

  it('builds when Vercel gives no branch', () => {
    expect(skips(undefined)).toBe(false);
  });
});
