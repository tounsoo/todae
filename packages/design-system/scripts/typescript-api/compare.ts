import type { ApiEntry } from './report.ts';

/** The committed public TypeScript API: entry point, then path, then rendered type. `version` is 1. */
export type ApiSnapshot = { version: 1; entries: Record<string, Record<string, string>> };

export type Bump = 'patch' | 'minor' | 'major';

/** A path that disappeared, or a path whose rendered type changed. An added path is neither. */
export type ApiBreak =
  | { kind: 'removed'; entry: string; path: string; was: string }
  | { kind: 'changed'; entry: string; path: string; was: string; now: string };

/** A changeset this pull request adds: its bump for the package, if any, and its text. */
export type AddedChangeset = { file: string; bump: Bump | null; text: string };

export const SNAPSHOT_HINT = 'Run pnpm api and commit packages/design-system/typescript-api.json.';

const RANK: Record<Bump, number> = { patch: 0, minor: 1, major: 2 };

function byCodePoint(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function apiSnapshot(entries: readonly ApiEntry[]): ApiSnapshot {
  const grouped: Record<string, Record<string, string>> = {};
  for (const item of [...entries].sort((a, b) => byCodePoint(a.entry, b.entry) || byCodePoint(a.path, b.path))) {
    const paths = (grouped[item.entry] ??= {});
    if (item.path in paths && paths[item.path] !== item.text) {
      throw new Error(`"${item.path}" in ${item.entry} renders as both "${paths[item.path]}" and "${item.text}".`);
    }
    paths[item.path] = item.text;
  }
  return { version: 1, entries: grouped };
}

export function formatApiSnapshot(snapshot: ApiSnapshot): string {
  return `${JSON.stringify(snapshot, null, 2)}\n`;
}

/** Parses `typescript-api.json`. Anything malformed fails instead of reading as an empty API. */
export function parseApiSnapshot(text: string): ApiSnapshot {
  let input: unknown;
  try {
    input = JSON.parse(text) as unknown;
  } catch {
    throw new Error(`typescript-api.json is not valid JSON. ${SNAPSHOT_HINT}`);
  }
  if (!isRecord(input) || input.version !== 1 || !isRecord(input.entries)) {
    throw new Error(`typescript-api.json needs version 1 and an entries object. ${SNAPSHOT_HINT}`);
  }
  const entries: Record<string, Record<string, string>> = {};
  for (const [entry, paths] of Object.entries(input.entries)) {
    if (!isRecord(paths)) throw new Error(`typescript-api.json entry "${entry}" must be an object. ${SNAPSHOT_HINT}`);
    const parsed: Record<string, string> = {};
    for (const [path, text] of Object.entries(paths)) {
      if (typeof text !== 'string') throw new Error(`typescript-api.json "${entry}" "${path}" must be a string. ${SNAPSHOT_HINT}`);
      parsed[path] = text;
    }
    entries[entry] = parsed;
  }
  return { version: 1, entries };
}

export function emptyApiSnapshot(): ApiSnapshot {
  return { version: 1, entries: {} };
}

/**
 * Removed and changed paths from `before` to `after`. An `internal` type is one the API names
 * without exporting it, so when it is gone altogether, only renamed or inlined, its paths count as changed.
 * The paths that named it change too. A member gone from an internal type that is still there is a removal.
 */
export function apiBreaks(before: ApiSnapshot, after: ApiSnapshot): ApiBreak[] {
  const breaks: ApiBreak[] = [];
  for (const [entry, paths] of Object.entries(before.entries)) {
    const next = after.entries[entry] ?? {};
    const internal = new Set(Object.keys(next).filter((path) => path.startsWith('internal ')).map(exportName));
    for (const [path, was] of Object.entries(paths)) {
      const now = next[path];
      if (now === undefined) {
        if (path.startsWith('internal ') && !internal.has(exportName(path))) breaks.push({ kind: 'changed', entry, path, was, now: 'no longer named' });
        else breaks.push({ kind: 'removed', entry, path, was });
      } else if (now !== was) breaks.push({ kind: 'changed', entry, path, was, now });
    }
  }
  return breaks.sort((a, b) => byCodePoint(a.entry, b.entry) || byCodePoint(a.path, b.path));
}

/** The exported name a path belongs to: `type ButtonRootProps.variant?` belongs to `ButtonRootProps`. */
export function exportName(path: string): string {
  const name = /^(?:type |internal )?([A-Za-z_$][\w$]*)/.exec(path)?.[1];
  if (name === undefined) throw new Error(`Can't read an export name from "${path}".`);
  return name;
}

/** The bump a removal needs: `minor` while the package is on 0.x, `major` from 1.0.0. */
export function breakingBump(version: string): Bump {
  const major = Number(/^(\d+)\./.exec(version)?.[1]);
  if (!Number.isInteger(major)) throw new Error(`"${version}" is not a semver version.`);
  return major === 0 ? 'minor' : 'major';
}

function names(text: string, name: string): boolean {
  return new RegExp(`(?<![\\w$])${name.replace(/\$/g, '\\$')}(?![\\w$])`).test(text);
}

export type Unacknowledged = { name: string; needs: Bump; breaks: ApiBreak[] };

/**
 * Each name and every export whose type names it, directly or through another name.
 * A changeset may name any of them: `ButtonRootProps` or the `Button` that takes it.
 */
export function usersOf(snapshots: readonly ApiSnapshot[]): (name: string) => Set<string> {
  const users = new Map<string, Set<string>>();
  for (const snapshot of snapshots) {
    for (const paths of Object.values(snapshot.entries)) {
      for (const [path, text] of Object.entries(paths)) {
        const user = exportName(path);
        for (const word of `${path.replace(/^(?:type |internal )?[A-Za-z_$][\w$]*/, '')} ${text}`.match(/[A-Za-z_$][\w$]*/g) ?? []) {
          if (word === user) continue;
          const set = users.get(word) ?? new Set<string>();
          set.add(user);
          users.set(word, set);
        }
      }
    }
  }
  return (name) => {
    const found = new Set([name]);
    const queue = [name];
    for (let next = queue.pop(); next !== undefined; next = queue.pop()) {
      for (const user of users.get(next) ?? []) {
        if (!found.has(user)) {
          found.add(user);
          queue.push(user);
        }
      }
    }
    return found;
  };
}

/**
 * Exports with a removed or changed path that no added changeset acknowledges.
 * A changeset acknowledges an export when it bumps the package and names the export, or an export that uses it.
 * A removal also needs that changeset to be at least `removalBump`. A change may widen a type, so any bump will do.
 */
export function unacknowledged(
  breaks: readonly ApiBreak[],
  changesets: readonly AddedChangeset[],
  removalBump: Bump,
  accepted: (name: string) => Set<string> = (name) => new Set([name]),
): Unacknowledged[] {
  const byName = new Map<string, ApiBreak[]>();
  for (const item of breaks) {
    const name = exportName(item.path);
    byName.set(name, [...(byName.get(name) ?? []), item]);
  }
  const missing: Unacknowledged[] = [];
  for (const [name, items] of [...byName.entries()].sort(([a], [b]) => byCodePoint(a, b))) {
    const needs: Bump = items.some((item) => item.kind === 'removed') ? removalBump : 'patch';
    const candidates = [...accepted(name)];
    const ok = changesets.some(
      (set) => set.bump !== null && RANK[set.bump] >= RANK[needs] && candidates.some((candidate) => names(set.text, candidate)),
    );
    if (!ok) missing.push({ name, needs, breaks: items });
  }
  return missing;
}

export function formatApiBreak(item: ApiBreak): string {
  const where = `${item.entry} ${item.path}`;
  return item.kind === 'removed' ? `  - removed ${where}: ${item.was}` : `  - changed ${where}: ${item.was} → ${item.now}`;
}

export function unacknowledgedFailure(missing: readonly Unacknowledged[], packageName: string): string {
  const lines = ['Public TypeScript API removed or changed without a changeset that names it:'];
  for (const item of missing) {
    lines.push(`- ${item.name} (needs a ${item.needs} or larger changeset that names ${item.name} or an export that uses it)`);
    lines.push(...item.breaks.map(formatApiBreak));
  }
  lines.push(
    '',
    `Add a changeset for ${packageName} that names each export above, with one bullet per break saying what to change in your code.`,
    'A removal needs the breaking bump. A change that only widens a type can stay a patch, but the changeset still names it.',
    'If the change was not meant, restore the export instead.',
  );
  return lines.join('\n');
}

/** Reads the package's bump from a changeset's frontmatter. Unknown or missing means it doesn't bump the package. */
export function parseChangeset(file: string, text: string, packageName: string): AddedChangeset {
  const match = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/.exec(text);
  if (!match) return { file, bump: null, text };
  const [, front = '', body = ''] = match;
  let bump: Bump | null = null;
  for (const line of front.split(/\r?\n/)) {
    const entry = /^\s*["']?([^"':]+)["']?\s*:\s*["']?(patch|minor|major)["']?\s*$/.exec(line);
    if (entry && entry[1]?.trim() === packageName) bump = entry[2] as Bump;
  }
  return { file, bump, text: body };
}
