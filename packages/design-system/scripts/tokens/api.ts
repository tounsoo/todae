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

/** A path that disappeared, or a path whose type changed. A changeset is not an input. */
export type TokenApiBreak = { kind: 'removed'; path: string } | { kind: 'retyped'; path: string; from: string; to: string };

export type TokenApiApproval = { path: string; approved: string };

/** Paths Ben approved for removal or retype. `version` is 1. */
export type TokenApiApprovals = { version: 1; removals: readonly TokenApiApproval[] };

const EMPTY_APPROVALS: TokenApiApprovals = { version: 1, removals: [] };

export const APPROVAL_HINT =
  'If Ben approved this removal, add the path to tokens/api-approved-removals.json with his approval note. Otherwise restore the path.';

function typesOf(snapshot: TokenApiSnapshot): Map<string, string> {
  return new Map(snapshot.tokens.map((token) => [token.path, token.type]));
}

/** Removals and type changes from `before` to `after`. An added path is neither. */
export function tokenApiBreaks(before: TokenApiSnapshot, after: TokenApiSnapshot): TokenApiBreak[] {
  const afterTypes = typesOf(after);
  const breaks: TokenApiBreak[] = [];
  for (const token of before.tokens) {
    const next = afterTypes.get(token.path);
    if (next === undefined) breaks.push({ kind: 'removed', path: token.path });
    else if (next !== token.type) breaks.push({ kind: 'retyped', path: token.path, from: token.type, to: next });
  }
  return breaks;
}

function breakKey(item: TokenApiBreak): string {
  return item.kind === 'removed' ? `removed\u0000${item.path}` : `retyped\u0000${item.path}\u0000${item.from}\u0000${item.to}`;
}

/**
 * Removals and type changes between successive snapshots. Putting a path or
 * its old type back later does not clear the break. The check has no changeset input.
 */
export function auditTokenApiHistory(snapshots: readonly TokenApiSnapshot[]): TokenApiBreak[] {
  const found = new Map<string, TokenApiBreak>();
  for (let index = 1; index < snapshots.length; index += 1) {
    const before = snapshots[index - 1];
    const after = snapshots[index];
    if (before === undefined || after === undefined) continue;
    for (const item of tokenApiBreaks(before, after)) found.set(breakKey(item), item);
  }
  return [...found.values()].sort((left, right) => byCodePoint(formatTokenApiBreak(left), formatTokenApiBreak(right)));
}

export function formatTokenApiBreak(item: TokenApiBreak): string {
  if (item.kind === 'removed') return `- ${item.path}`;
  return `- ${item.path} (${item.from} → ${item.to})`;
}

export function emptyTokenApiApprovals(): TokenApiApprovals {
  return EMPTY_APPROVALS;
}

/** Parses `tokens/api-approved-removals.json`. An empty `approved` note fails. */
export function parseTokenApiApprovals(input: unknown): TokenApiApprovals {
  if (!isRecord(input)) fail('tokens/api-approved-removals.json must be a JSON object.');
  if (input.version !== 1) fail('tokens/api-approved-removals.json version must be 1.');
  if (!Array.isArray(input.removals)) fail('tokens/api-approved-removals.json removals must be an array.');
  const removals: TokenApiApproval[] = [];
  const seen = new Set<string>();
  for (const entry of input.removals) {
    if (!isRecord(entry) || typeof entry.path !== 'string' || entry.path === '') {
      fail('Each tokens/api-approved-removals.json entry needs a path.');
    }
    if (typeof entry.approved !== 'string' || entry.approved.trim() === '') {
      fail(`tokens/api-approved-removals.json has an empty approval for "${entry.path}". ${APPROVAL_HINT}`);
    }
    if (seen.has(entry.path)) fail(`tokens/api-approved-removals.json lists "${entry.path}" more than once.`);
    seen.add(entry.path);
    removals.push({ path: entry.path, approved: entry.approved });
  }
  return { version: 1, removals };
}

/** Drops breaks whose path Ben approved. Other breaks stay, changeset or not. */
export function withoutApprovals(breaks: readonly TokenApiBreak[], approvals: TokenApiApprovals): TokenApiBreak[] {
  const allowed = new Set(approvals.removals.map((entry) => entry.path));
  return breaks.filter((item) => !allowed.has(item.path));
}

export function removalFailure(breaks: readonly TokenApiBreak[]): string {
  return ['Public token API removed or renamed:', ...breaks.map(formatTokenApiBreak), APPROVAL_HINT].join('\n');
}
