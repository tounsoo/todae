import type { ApiEntry } from './report.ts';

/** The committed public TypeScript API: entry point, then path, then rendered type. `version` is 1. */
export type ApiSnapshot = { version: 1; entries: Record<string, Record<string, string>> };

export type Bump = 'patch' | 'minor' | 'major';

/**
 * How a path on the base differs on the branch. An added path is none of these.
 * - `removed`: the path is gone.
 * - `narrowed`: a union lost a member, a prop became required, or an `Omit` leaves out one more DOM prop.
 * - `changed`: any other change the gate can't show is a widening, such as a dropped parameter or overload.
 * - `widened`: a union gained members, a prop became optional, an `Omit` leaves out fewer DOM props,
 *   or a function takes a new optional parameter at the end.
 * - `renamed`: the text only swaps the name of a type that is gone, such as an internal props type. `from` lists the old names.
 */
export type ApiBreak =
  | { kind: 'removed'; entry: string; path: string; was: string }
  | { kind: 'narrowed' | 'changed' | 'widened'; entry: string; path: string; was: string; now: string }
  | { kind: 'renamed'; entry: string; path: string; was: string; now: string; from: readonly string[] };

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

/**
 * The members of a union printed at the top level of `text`, or the whole text as one member.
 * A function's return type belongs to the function, so nothing after a top-level `=>` is split.
 */
export function unionMembers(text: string): string[] {
  const members: string[] = [];
  let depth = 0;
  let quote: string | null = null;
  let start = 0;
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    if (quote !== null) {
      if (char === '\\') index += 1;
      else if (char === quote) quote = null;
    } else if (char === "'" || char === '"' || char === '`') quote = char;
    else if (char === '=' && text[index + 1] === '>') {
      if (depth === 0) break;
      index += 1;
    } else if (char === '(' || char === '[' || char === '{' || char === '<') depth += 1;
    else if (char === ')' || char === ']' || char === '}' || char === '>') depth -= 1;
    else if (depth === 0 && text.startsWith(' | ', index)) {
      members.push(text.slice(start, index));
      start = index + 3;
      index += 2;
    }
  }
  members.push(text.slice(start));
  return members;
}

/** The DOM props an `extends` path leaves out: `all` leaves out none. */
function omitted(text: string): Set<string> | null {
  if (text === 'all') return new Set();
  if (!text.startsWith('except ')) return null;
  return new Set(text.slice('except '.length).split(', '));
}

function subset(items: Iterable<string>, of: Set<string>): boolean {
  for (const item of items) if (!of.has(item)) return false;
  return true;
}

/** The parameters and the rest of a function signature that starts with `(`. */
function signature(text: string): { parameters: string[]; rest: string } | null {
  if (!text.startsWith('(')) return null;
  let depth = 0;
  let quote: string | null = null;
  let start = 1;
  const parameters: string[] = [];
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    if (quote !== null) {
      if (char === '\\') index += 1;
      else if (char === quote) quote = null;
    } else if (char === "'" || char === '"' || char === '`') quote = char;
    else if (char === '=' && text[index + 1] === '>') index += 1;
    else if (char === '(' || char === '[' || char === '{' || char === '<') depth += 1;
    else if (char === ')' || char === ']' || char === '}' || char === '>') {
      depth -= 1;
      if (depth === 0) {
        const last = text.slice(start, index).trim();
        if (last !== '') parameters.push(last);
        return { parameters, rest: text.slice(index + 1) };
      }
    } else if (char === ',' && depth === 1) {
      parameters.push(text.slice(start, index).trim());
      start = index + 1;
    }
  }
  return null;
}

/** The same parameters and return type, plus optional parameters at the end. */
function addedOptionalParameters(was: string, now: string): boolean {
  const before = signature(was);
  const after = signature(now);
  if (!before || !after || before.rest !== after.rest || after.parameters.length <= before.parameters.length) return false;
  return (
    before.parameters.every((parameter, index) => after.parameters[index] === parameter) &&
    after.parameters.slice(before.parameters.length).every((parameter) => /^arg\d+\?:/.test(parameter))
  );
}

/** A path's members: a long literal union or tuple lists them as their own paths, anything else as its text. */
function membersOf(paths: Record<string, string>, path: string, text: string): string[] {
  if (text === 'union' || text === 'tuple') {
    const prefix = `${path} ${text === 'union' ? '|' : 'has'} `;
    return Object.keys(paths).filter((key) => key.startsWith(prefix)).map((key) => key.slice(prefix.length));
  }
  return unionMembers(text);
}

/**
 * Whether a changed path only widens what it takes, narrows it, or changes it some other way.
 * Text can't show assignability, so only the widenings below count as widenings.
 */
function changeKind(path: string, was: string, now: string, before: string[], after: string[]): 'narrowed' | 'changed' | 'widened' {
  if (path.includes(' extends ')) {
    const left = omitted(was);
    const right = omitted(now);
    if (left && right) return subset(right, left) ? 'widened' : 'narrowed';
  }
  if (subset(before, new Set(after))) return 'widened';
  if (before.length > 1) return 'narrowed';
  return addedOptionalParameters(was, now) ? 'widened' : 'changed';
}

/** An `extends` path's interface and, if its props show them, its type arguments. */
const EXTENDS = / extends ([\w$]+)(<.*>)?$/;

const IDENTIFIER = /([A-Za-z_$][\w$]*)/;

/** The names `now` swaps in for names in `gone`, when the two texts differ in nothing else. */
function renames(was: string, now: string, gone: Set<string>): Map<string, string> | null {
  const before = was.split(IDENTIFIER);
  const after = now.split(IDENTIFIER);
  if (before.length !== after.length) return null;
  const found = new Map<string, string>();
  for (let index = 0; index < before.length; index += 1) {
    const a = before[index] ?? '';
    const b = after[index] ?? '';
    if (a === b) continue;
    if (index % 2 === 0 || !gone.has(a) || (found.has(a) && found.get(a) !== b)) return null;
    found.set(a, b);
  }
  return found.size > 0 ? found : null;
}

function renamed(text: string, names: Map<string, string>): string {
  return text
    .split(IDENTIFIER)
    .map((part, index) => (index % 2 === 1 ? (names.get(part) ?? part) : part))
    .join('');
}

/** A new name for each gone type that every path renaming it agrees on. */
function renameMap(paths: Record<string, string>, next: Record<string, string>, gone: Set<string>, names: Set<string>): Map<string, string> {
  const candidates = new Map<string, Set<string>>();
  for (const [path, was] of Object.entries(paths)) {
    const now = next[path];
    if (now === undefined || now === was) continue;
    for (const [from, to] of renames(was, now, gone) ?? []) {
      candidates.set(from, (candidates.get(from) ?? new Set<string>()).add(to));
    }
  }
  const map = new Map<string, string>();
  for (const [from, to] of candidates) {
    const [only] = to;
    if (to.size === 1 && only !== undefined && names.has(only)) map.set(from, only);
  }
  return map;
}

export function emptyApiSnapshot(): ApiSnapshot {
  return { version: 1, entries: {} };
}

/**
 * Removed and changed paths from `before` to `after`.
 * A type that is gone may have been renamed: a path whose text only swaps its name for another is `renamed`,
 * and an internal type's own paths are compared under its new name. An exported type that is gone is still
 * removed, since code imports it by name. An internal type that is gone with no new name, such as one that
 * was inlined, counts as changed.
 */
export function apiBreaks(before: ApiSnapshot, after: ApiSnapshot): ApiBreak[] {
  const breaks: ApiBreak[] = [];
  for (const [entry, paths] of Object.entries(before.entries)) {
    const next = after.entries[entry] ?? {};
    const names = new Set(Object.keys(next).map(exportName));
    const gone = new Set(Object.keys(paths).map(exportName).filter((name) => !names.has(name)));
    const map = renameMap(paths, next, gone, names);
    const oldNames = [...map.keys()];
    for (const [path, was] of Object.entries(paths)) {
      const name = exportName(path);
      const internal = path.startsWith('internal ');
      let target = path;
      if (internal && map.has(name)) {
        const rest = path.slice('internal '.length + name.length);
        const newName = map.get(name) ?? name;
        target = [`internal ${newName}${rest}`, `type ${newName}${rest}`].find((candidate) => candidate in next) ?? `internal ${newName}${rest}`;
      } else if (internal && !(path in next) && `type ${path.slice('internal '.length)}` in next) {
        target = `type ${path.slice('internal '.length)}`;
      }
      const expected = renamed(was, map);
      const now = next[target];
      const set = /^(.*) (?:\||has) (.*)$/.exec(path);
      if (now === undefined) {
        const base = set?.[1];
        if (was === 'member' && base !== undefined && next[base] !== undefined && membersOf(next, base, next[base] ?? '').includes(set?.[2] ?? '')) continue;
        const owner = EXTENDS.exec(target);
        const sameOwner = owner
          ? Object.keys(next).find((key) => {
              const match = EXTENDS.exec(key);
              return match !== null && match[1] === owner[1] && key.slice(0, match.index) === target.slice(0, owner.index);
            })
          : undefined;
        const flipped = target.endsWith('?') ? target.slice(0, -1) : `${target}?`;
        const other = next[flipped];
        if (owner && sameOwner !== undefined) {
          // The interface's type arguments are read off its props, so they show only while a prop that uses them is kept.
          const args = EXTENDS.exec(sameOwner)?.[2];
          const kind = owner[2] !== undefined && args !== undefined ? 'changed' : changeKind(path, was, next[sameOwner] ?? '', [], []);
          breaks.push({ kind, entry, path, was, now: `${next[sameOwner]} (as ${sameOwner.replace(/^(?:type |internal )/, '')})` });
        } else if (other !== undefined) {
          const kind = target.endsWith('?') ? 'narrowed' : subset(unionMembers(expected), new Set(unionMembers(other))) ? 'widened' : 'changed';
          breaks.push({ kind, entry, path, was, now: `${other} (as ${flipped.replace(/^(?:type |internal )/, '')})` });
        } else if (internal && gone.has(name)) {
          breaks.push({ kind: 'changed', entry, path, was, now: 'no longer named' });
        } else breaks.push({ kind: 'removed', entry, path, was });
      } else if (now === expected) {
        if (now !== was || target !== path) {
          const from = oldNames.filter((old) => old === name || new RegExp(`(?<![\\w$])${escape(old)}(?![\\w$])`).test(was));
          breaks.push({ kind: 'renamed', entry, path, was, now, from });
        }
      } else {
        const kind = changeKind(path, expected, now, membersOf(paths, path, expected), membersOf(next, target, now));
        breaks.push({ kind, entry, path, was, now });
      }
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

function escape(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Whether `text` names `name` as a whole word: `Button` or `Button.Root`, not `Buttons` or `ButtonGroup`. */
function names(text: string, name: string): boolean {
  return new RegExp(`(?<![\\w$])${escape(name)}(?![\\w$])`).test(text);
}

export type Unacknowledged = { name: string; needs: Bump; breaks: ApiBreak[] };

/** Who uses a path: a type or internal type by its name, a value by its dotted path, such as `Message.Avatar`. */
function userOf(path: string): string {
  return /^(?:type|internal) /.test(path) ? exportName(path) : (path.split(' ')[0] ?? path);
}

/**
 * The names a changeset may use for a break in `name`: the name itself, each type or value whose type
 * names it, directly or through another name, and each component a type is named after
 * (`AvatarRootProps` is Avatar's). A compound part counts by its own dotted name, so `Message.Avatar`
 * taking `AvatarRootProps` makes `Message.Avatar` a user, not all of Message.
 */
export function usersOf(snapshots: readonly ApiSnapshot[]): (name: string) => Set<string> {
  const users = new Map<string, Set<string>>();
  const values = new Set<string>();
  for (const snapshot of snapshots) {
    for (const paths of Object.values(snapshot.entries)) {
      for (const [path, text] of Object.entries(paths)) {
        const user = userOf(path);
        if (!/^(?:type|internal) /.test(path) && !/[. ]/.test(path)) values.add(path);
        for (const word of text.match(/[A-Za-z_$][\w$]*/g) ?? []) {
          if (word === user) continue;
          users.set(word, (users.get(word) ?? new Set<string>()).add(user));
        }
      }
    }
  }
  const owners = (name: string) =>
    [...values].filter((value) => value !== name && name.startsWith(value) && /[A-Z]/.test(name.charAt(value.length)));
  return (name) => {
    const found = new Set([name]);
    const queue = [name];
    for (let next = queue.pop(); next !== undefined; next = queue.pop()) {
      for (const user of [...(users.get(next) ?? []), ...(next.includes('.') ? [] : owners(next))]) {
        if (!found.has(user)) {
          found.add(user);
          queue.push(user);
        }
      }
    }
    return found;
  };
}

const PATCH_KINDS = new Set<ApiBreak['kind']>(['widened', 'renamed']);

/**
 * Exports with a removed or changed path that no added changeset acknowledges.
 * A changeset acknowledges an export when it bumps the package and names the export, a type or value
 * that uses it, or the old name of a type it renamed.
 * Only widenings and renames may be a patch. Anything else needs at least `breaking`, since text
 * can't show that a change is safe.
 */
export function unacknowledged(
  breaks: readonly ApiBreak[],
  changesets: readonly AddedChangeset[],
  breaking: Bump,
  accepted: (name: string) => Set<string> = (name) => new Set([name]),
): Unacknowledged[] {
  const byName = new Map<string, ApiBreak[]>();
  for (const item of breaks) {
    const name = exportName(item.path);
    byName.set(name, [...(byName.get(name) ?? []), item]);
  }
  const missing: Unacknowledged[] = [];
  for (const [name, items] of [...byName.entries()].sort(([a], [b]) => byCodePoint(a, b))) {
    const needs: Bump = items.every((item) => PATCH_KINDS.has(item.kind)) ? 'patch' : breaking;
    const candidates = new Set(accepted(name));
    for (const item of items) if (item.kind === 'renamed') for (const old of item.from) for (const user of accepted(old)) candidates.add(user);
    const ok = changesets.some(
      (set) => set.bump !== null && RANK[set.bump] >= RANK[needs] && [...candidates].some((candidate) => names(set.text, candidate)),
    );
    if (!ok) missing.push({ name, needs, breaks: items });
  }
  return missing;
}

export function formatApiBreak(item: ApiBreak): string {
  const where = `${item.entry} ${item.path}`;
  return item.kind === 'removed' ? `  - removed ${where}: ${item.was}` : `  - ${item.kind} ${where}: ${item.was} → ${item.now}`;
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
    'A widening (a union that gains members, a prop that becomes optional, an Omit that leaves out fewer DOM props, an optional parameter added at the end) or a renamed type can be a patch.',
    'Anything else needs the breaking bump, since the gate cannot tell that it is safe.',
    'If the change was not meant, restore the export instead.',
  );
  return lines.join('\n');
}

/** Reads the package's bump from a changeset's frontmatter. Unknown or missing means it doesn't bump the package. */
export function parseChangeset(file: string, text: string, packageName: string): AddedChangeset {
  const match = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/.exec(text.replace(/^\uFEFF/, ''));
  if (!match) return { file, bump: null, text };
  const [, front = '', body = ''] = match;
  let bump: Bump | null = null;
  for (const line of front.split(/\r?\n/)) {
    const entry = /^\s*["']?([^"':#]+?)["']?\s*:\s*["']?(patch|minor|major)["']?\s*(?:#.*)?$/.exec(line);
    if (entry && entry[1]?.trim() === packageName) bump = entry[2] as Bump;
  }
  return { file, bump, text: body };
}
