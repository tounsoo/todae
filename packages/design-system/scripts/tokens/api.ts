import { fail, isRecord } from './shared.ts';

/** One public token path and the DTCG type both contexts share. */
export type TokenApiEntry = { path: string; type: string };

/** The committed public token API. `version` is 1. */
export type TokenApiSnapshot = { version: 1; tokens: readonly TokenApiEntry[] };

const EMPTY_SNAPSHOT: TokenApiSnapshot = { version: 1, tokens: [] };

function byCodePoint(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

/**
 * One entry per path. The same path in two contexts keeps a single type.
 * Two types for one path fail the build.
 */
export function tokenApiSnapshot(tokens: readonly { path: string; type: string }[]): TokenApiSnapshot {
  const types = new Map<string, string>();
  for (const token of tokens) {
    const previous = types.get(token.path);
    if (previous === undefined) types.set(token.path, token.type);
    else if (previous !== token.type) fail(`Token "${token.path}" has types "${previous}" and "${token.type}"`);
  }
  const entries = [...types.entries()].sort(([left], [right]) => byCodePoint(left, right)).map(([path, type]) => ({ path, type }));
  return { version: 1, tokens: entries };
}

export function formatTokenApiSnapshot(snapshot: TokenApiSnapshot): string {
  return `${JSON.stringify({ version: snapshot.version, tokens: snapshot.tokens }, null, 2)}\n`;
}

/** Parses `tokens/api.json`. Invalid JSON never becomes a snapshot. */
export function parseTokenApiSnapshot(input: unknown): TokenApiSnapshot {
  if (!isRecord(input)) fail('tokens/api.json must be a JSON object. Run pnpm tokens and commit tokens/api.json.');
  if (input.version !== 1) fail('tokens/api.json version must be 1. Run pnpm tokens and commit tokens/api.json.');
  if (!Array.isArray(input.tokens)) fail('tokens/api.json tokens must be an array. Run pnpm tokens and commit tokens/api.json.');
  const tokens: TokenApiEntry[] = [];
  const seen = new Set<string>();
  for (const entry of input.tokens) {
    if (!isRecord(entry) || typeof entry.path !== 'string' || typeof entry.type !== 'string') {
      fail('Each tokens/api.json entry needs a string path and a string type. Run pnpm tokens and commit tokens/api.json.');
    }
    if (seen.has(entry.path)) fail(`tokens/api.json lists "${entry.path}" more than once. Run pnpm tokens and commit tokens/api.json.`);
    seen.add(entry.path);
    tokens.push({ path: entry.path, type: entry.type });
  }
  return { version: 1, tokens };
}

export function emptyTokenApiSnapshot(): TokenApiSnapshot {
  return EMPTY_SNAPSHOT;
}

/** Paths present in `base` and absent in `head`. An added path is not a removal. */
export function removedPublicTokenPaths(base: TokenApiSnapshot, head: TokenApiSnapshot): string[] {
  const headPaths = new Set(head.tokens.map((token) => token.path));
  return base.tokens.map((token) => token.path).filter((path) => !headPaths.has(path)).sort(byCodePoint);
}

/**
 * Paths dropped between any two successive snapshots. Putting a path back
 * later does not clear it. The check has no changeset input.
 */
export function auditTokenApiHistory(snapshots: readonly TokenApiSnapshot[]): string[] {
  const removed = new Set<string>();
  for (let index = 1; index < snapshots.length; index += 1) {
    const before = snapshots[index - 1];
    const after = snapshots[index];
    if (before === undefined || after === undefined) continue;
    for (const path of removedPublicTokenPaths(before, after)) removed.add(path);
  }
  return [...removed].sort(byCodePoint);
}

export function removalFailure(paths: readonly string[]): string {
  const lines = paths.map((path) => `- ${path}`);
  return [
    'Public token API removed or renamed:',
    ...lines,
    'A changeset does not waive this. A removal needs Ben\'s approval.',
  ].join('\n');
}
