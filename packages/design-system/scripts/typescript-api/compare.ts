import type { ApiEntry } from './report.ts';

/** The committed public TypeScript API: entry point, then path, then rendered type. `version` is 1. */
export type ApiSnapshot = { version: 1; entries: Record<string, Record<string, string>> };

export type Bump = 'patch' | 'minor' | 'major';

/**
 * How a path on the base differs on the branch. An added path is none of these.
 * - `removed`: the path is gone.
 * - `narrowed`: a union lost a member, a member became required or was added as required, or an `Omit`
 *   leaves out one more DOM prop.
 * - `widened`: a union gained members, a member became optional, or an `Omit` leaves out fewer DOM props.
 *   That still breaks code that reads the type, such as a `switch` over a callback's argument.
 * - `changed`: any other change, such as a dropped parameter or overload.
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
  return members.map(unwrap);
}

/** `(A)` as `A`, when the parentheses hold the whole member. */
function unwrap(member: string): string {
  if (!member.startsWith('(') || !member.endsWith(')')) return member;
  let depth = 0;
  for (let index = 0; index < member.length; index += 1) {
    const char = member[index];
    if (char === '(') depth += 1;
    else if (char === ')') {
      depth -= 1;
      if (depth === 0 && index < member.length - 1) return member;
    }
  }
  return member.slice(1, -1);
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

/** A path's members: a long literal union or tuple lists them as their own paths, anything else as its text. */
function membersOf(paths: Record<string, string>, path: string, text: string): string[] {
  if (text === 'union' || text === 'tuple') {
    const prefix = `${path} ${text === 'union' ? '|' : 'has'} `;
    return Object.keys(paths).filter((key) => key.startsWith(prefix)).map((key) => key.slice(prefix.length));
  }
  return unionMembers(text);
}

/**
 * Whether a changed path widens its type, narrows it, or changes it some other way. Text can't show
 * assignability, so only the shapes below are read, and only a rename is safe for every caller.
 */
function changeKind(path: string, was: string, now: string, before: string[], after: string[]): 'narrowed' | 'changed' | 'widened' {
  if (path.includes(' extends ')) {
    const left = omitted(was);
    const right = omitted(now);
    if (left && right) return subset(right, left) ? 'widened' : 'narrowed';
  }
  if (subset(before, new Set(after))) return 'widened';
  return before.length > 1 ? 'narrowed' : 'changed';
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
    breaks.push(...addedRequired(entry, paths, next, map));
  }
  return breaks.sort((a, b) => byCodePoint(a.entry, b.entry) || byCodePoint(a.path, b.path));
}

/** A required member path, such as `type ButtonRootProps.label`: not optional, not an index signature, not a DOM interface, not a literal. */
const REQUIRED_MEMBER = /^((?:type|internal) [A-Za-z_$][\w$]*)(\.(?:[^ [?]|[^ [][^ ]*[^?]))$/;

/**
 * Required members a type gained, measured against the type on the base with the same name, or the one
 * a rename replaced. Every caller that builds the type must now pass them, so each is `narrowed`.
 */
function addedRequired(entry: string, paths: Record<string, string>, next: Record<string, string>, renamed: ReadonlyMap<string, string>): ApiBreak[] {
  const breaks: ApiBreak[] = [];
  const has = (name: string, rest: string) => [`type ${name}${rest}`, `internal ${name}${rest}`].some((path) => path in paths);
  for (const [path, now] of Object.entries(next)) {
    const match = REQUIRED_MEMBER.exec(path);
    if (!match) continue;
    const name = exportName(path);
    const rest = match[2] ?? '';
    const earlier = [name, ...[...renamed].filter(([, to]) => to === name).map(([from]) => from)];
    for (const old of earlier) {
      if ((paths[`type ${old}`] ?? paths[`internal ${old}`]) !== 'object') continue;
      if (has(old, rest) || has(old, `${rest}?`)) continue;
      breaks.push({ kind: 'narrowed', entry, path, was: 'not there', now: old === name ? `${now} (required)` : `${now} (required, not on ${old})` });
    }
  }
  return breaks;
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

/**
 * Whether `text` names `name` as a whole word: `Button`, not `Buttons` or `ButtonGroup`. With `component`,
 * the name doesn't count where the text names one of its parts, so `Field` isn't in "`Field.Label` takes a size".
 * A type's name still counts before a member, as in `ButtonRootProps.defaultPressed`.
 */
function names(text: string, name: string, component = false): boolean {
  const part = component ? '(?!\\.[A-Za-z_$])' : '';
  return new RegExp(`(?<![\\w$])${escape(name)}(?![\\w$])${part}`).test(text);
}

export type Unacknowledged = { name: string; needs: Bump; breaks: ApiBreak[] };

/** Who uses a path: a type or internal type by its name, a value by its dotted path, such as `Message.Avatar`. */
function userOf(path: string): string {
  return /^(?:type|internal) /.test(path) ? exportName(path) : (path.split(' ')[0] ?? path);
}

/**
 * The names a changeset may use for a break in `name`: the name itself, each type or value whose type
 * names it, directly or through another name, and each component a type is named after
 * (`AvatarRootProps` is Avatar's, and `ChipListRootProps` is ChipList's, not Chip's). A compound part counts by its own dotted name, so `Message.Avatar`
 * taking `AvatarRootProps` makes `Message.Avatar` a user, not all of Message.
 */
export type Users = ((name: string) => Set<string>) & { components?: ReadonlySet<string> };

export function usersOf(snapshots: readonly ApiSnapshot[]): Users {
  const users = new Map<string, Set<string>>();
  const values = new Set<string>();
  const parts = new Set<string>();
  for (const snapshot of snapshots) {
    for (const paths of Object.values(snapshot.entries)) {
      for (const [path, text] of Object.entries(paths)) {
        const user = userOf(path);
        if (!/^(?:type|internal) /.test(path) && !/[. ]/.test(path)) values.add(path);
        if (!/^(?:type|internal) /.test(path) && /^[\w$]+\.[\w$]+$/.test(path)) parts.add(path);
        for (const word of text.match(/[A-Za-z_$][\w$]*/g) ?? []) {
          if (word === user) continue;
          users.set(word, (users.get(word) ?? new Set<string>()).add(user));
        }
      }
    }
  }
  const startsWord = (name: string, prefix: string) => name !== prefix && name.startsWith(prefix) && /[A-Z]/.test(name.charAt(prefix.length));
  const longest = (items: string[]) => items.sort((a, b) => b.length - a.length)[0];
  /**
   * What a type is named after: the longest value name it starts with, so `ChipListRootProps` is ChipList's,
   * not Chip's, then the longest part of that component, so `FieldColorPickerProps` is `Field.ColorPicker`'s,
   * not all of Field's. A `Root` part's type is the whole component's too.
   */
  const owners = (name: string): string[] => {
    const component = longest([...values].filter((value) => startsWord(name, value)));
    if (component === undefined) return [];
    const rest = name.slice(component.length);
    const part = longest([...parts].filter((path) => path.startsWith(`${component}.`) && (rest === path.slice(component.length + 1) || startsWord(rest, path.slice(component.length + 1)))));
    if (part === undefined) return parts.has(`${component}.Root`) ? [component, `${component}.Root`] : [component];
    return part.endsWith('.Root') ? [part, component] : [part];
  };
  const accept: Users = (name) => {
    const found = new Set([name]);
    const queue = [name];
    for (let next = queue.pop(); next !== undefined; next = queue.pop()) {
      for (const user of [...(users.get(next) ?? []), ...(next.includes('.') || values.has(next) ? [] : owners(next))]) {
        if (!found.has(user)) {
          found.add(user);
          queue.push(user);
        }
      }
    }
    return found;
  };
  accept.components = values;
  return accept;
}

const PATCH_KINDS = new Set<ApiBreak['kind']>(['renamed']);

/**
 * Exports with a removed or changed path that no added changeset acknowledges.
 * A changeset acknowledges an export when it bumps the package and names the export, a type or value
 * that uses it, or the old name of a type it renamed.
 * Only a rename may be a patch. Anything else needs at least `breaking`: text can't tell a type callers
 * pass in from one they read back, so even a widening can break someone.
 */
export function unacknowledged(
  breaks: readonly ApiBreak[],
  changesets: readonly AddedChangeset[],
  breaking: Bump,
  accepted: Users = (name) => new Set([name]),
): Unacknowledged[] {
  const components = accepted.components ?? new Set<string>();
  const byName = new Map<string, ApiBreak[]>();
  for (const item of breaks) {
    const name = exportName(item.path);
    byName.set(name, [...(byName.get(name) ?? []), item]);
  }
  const missing: Unacknowledged[] = [];
  for (const [name, items] of [...byName.entries()].sort(([a], [b]) => byCodePoint(a, b))) {
    const needs: Bump = items.every((item) => PATCH_KINDS.has(item.kind)) ? 'patch' : breaking;
    const candidates = new Set(accepted(name));
    for (const item of items) for (const user of accepted(userOf(item.path))) candidates.add(user);
    for (const item of items) if (item.kind === 'renamed') for (const old of item.from) for (const user of accepted(old)) candidates.add(user);
    const ok = changesets.some(
      (set) => set.bump !== null && RANK[set.bump] >= RANK[needs] && [...candidates].some((candidate) => names(set.text, candidate, components.has(candidate))),
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
    'Only a rename of a type that is gone can be a patch, and the changeset may name the old name.',
    'Anything else needs the breaking bump: the gate cannot tell a type callers pass in from one they read back, so even a widening can break someone.',
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
