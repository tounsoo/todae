import { cssVarOf, dependents, readsOf, type ConsumerFile, type CssVar, type Snapshot } from './consumers.ts';
import type { Layer } from './shared.ts';

const STATES = ['default', 'hover', 'active', 'pressed', 'focus', 'disabled'] as const;

export type State = (typeof STATES)[number];

export type Schema = {
  states: ReadonlySet<State>;
  statefulProperties: ReadonlySet<string>;
};

export type Rule = 'depth' | 'state' | 'dead';

export type Violation =
  | { rule: 'depth'; path: string }
  | { rule: 'state'; path: string; word: string }
  | { rule: 'dead'; path: string; cssVar: CssVar };

export type Grandfather = ReadonlyMap<`${Rule}:${string}`, Violation>;

export type RatchetInput = {
  found: Violation[];
  list: Grandfather;
  base?: Grandfather | 'missing';
};

export type RatchetResult = {
  unlisted: Violation[];
  stale: Violation[];
  added: Violation[];
  note: string | null;
};

export const MISSING_BASE_NOTE = 'no grandfather list at base; skipping shrink check';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isStateWord(value: string): value is State {
  for (const state of STATES) if (state === value) return true;
  return false;
}

function knownState(states: ReadonlySet<State>, word: string): word is State {
  for (const state of states) if (state === word) return true;
  return false;
}

function isRule(value: string): value is Rule {
  return value === 'depth' || value === 'state' || value === 'dead';
}

export function violationKey(violation: { rule: Rule; path: string }): `${Rule}:${string}` {
  return `${violation.rule}:${violation.path}`;
}

export function violationOrder(a: { rule: Rule; path: string }, b: { rule: Rule; path: string }): number {
  if (a.rule !== b.rule) return a.rule < b.rule ? -1 : 1;
  if (a.path !== b.path) return a.path < b.path ? -1 : 1;
  return 0;
}

export function isConsumerPath(file: string): boolean {
  const normalized = file.replaceAll('\\', '/');
  const base = normalized.slice(normalized.lastIndexOf('/') + 1);
  if (base.includes('.generated.')) return false;
  return base.endsWith('.css') || base.endsWith('.ts') || base.endsWith('.tsx');
}

export function parseSchema(json: unknown): Schema {
  if (!isRecord(json)) throw new Error('name schema must be an object');
  if (json.version !== 1) throw new Error('name schema version must be 1');
  if (!Array.isArray(json.states)) throw new Error('name schema states must be an array');
  if (!Array.isArray(json.statefulProperties)) throw new Error('name schema statefulProperties must be an array');
  const states = new Set<State>();
  for (const state of json.states) {
    if (typeof state !== 'string' || !isStateWord(state)) {
      throw new Error(`name schema state "${String(state)}" is not one of ${STATES.join(', ')}`);
    }
    if (states.has(state)) throw new Error(`name schema repeats state "${state}"`);
    states.add(state);
  }
  const statefulProperties = new Set<string>();
  for (const property of json.statefulProperties) {
    if (typeof property !== 'string' || property.length === 0) {
      throw new Error('name schema statefulProperties must be non-empty strings');
    }
    if (statefulProperties.has(property)) throw new Error(`name schema repeats stateful property "${property}"`);
    statefulProperties.add(property);
  }
  return { states, statefulProperties };
}

function deadVar(path: string): CssVar {
  return cssVarOf(`--todae-${path.replaceAll('.', '-')}`);
}

function parseEntry(entry: unknown, index: number): Violation {
  if (!isRecord(entry)) throw new Error(`name grandfather entry ${index} must be an object`);
  if (typeof entry.rule !== 'string' || !isRule(entry.rule)) {
    throw new Error(`name grandfather rule "${String(entry.rule)}" is unknown`);
  }
  if (typeof entry.path !== 'string' || entry.path.length === 0) {
    throw new Error(`name grandfather entry ${index} needs a path`);
  }
  if (entry.rule === 'state') {
    if (typeof entry.word !== 'string' || entry.word.length === 0) {
      throw new Error(`name grandfather state entry ${entry.path} needs a word`);
    }
    return { rule: 'state', path: entry.path, word: entry.word };
  }
  if ('word' in entry) throw new Error(`name grandfather ${entry.rule} entry ${entry.path} cannot name a word`);
  if (entry.rule === 'depth') return { rule: 'depth', path: entry.path };
  return { rule: 'dead', path: entry.path, cssVar: deadVar(entry.path) };
}

export function parseGrandfather(json: unknown): Grandfather {
  if (!isRecord(json)) throw new Error('name grandfather must be an object');
  if (json.version !== 1) throw new Error('name grandfather version must be 1');
  if (!Array.isArray(json.entries)) throw new Error('name grandfather entries must be an array');
  const entries = json.entries.map((entry, index) => parseEntry(entry, index));
  for (let index = 1; index < entries.length; index += 1) {
    const previous = entries[index - 1];
    const current = entries[index];
    if (previous === undefined || current === undefined) continue;
    const order = violationOrder(previous, current);
    if (order === 0) throw new Error(`name grandfather repeats ${current.rule} ${current.path}`);
    if (order > 0) throw new Error('name grandfather entries are not sorted');
  }
  return new Map(entries.map((entry) => [violationKey(entry), entry]));
}

export function formatGrandfather(found: readonly Violation[]): string {
  const entries = [...found].sort(violationOrder).map((violation) => {
    if (violation.rule === 'state') return { rule: violation.rule, path: violation.path, word: violation.word };
    return { rule: violation.rule, path: violation.path };
  });
  return `${JSON.stringify({ version: 1, entries }, null, 2)}\n`;
}

export function nameViolations(path: string, schema: Schema): Violation[] {
  const segments = path.split('.');
  const last = segments[segments.length - 1] ?? '';
  const stem = knownState(schema.states, last) ? segments.length - 1 : segments.length;
  const violations: Violation[] = [];
  if (stem < 2 || stem > 3) violations.push({ rule: 'depth', path });
  for (let index = 1; index < segments.length - 1; index += 1) {
    const segment = segments[index] ?? '';
    const next = segments[index + 1] ?? '';
    if (schema.statefulProperties.has(segment) && !knownState(schema.states, next)) {
      violations.push({ rule: 'state', path, word: next });
      break;
    }
  }
  return violations;
}

function representatives(snapshot: Snapshot): Map<string, { layer: Layer; cssVars: [CssVar, ...CssVar[]] }> {
  const byPath = new Map<string, { layer: Layer; cssVars: [CssVar, ...CssVar[]] }>();
  for (const row of snapshot.values()) {
    const current = byPath.get(row.path);
    if (current) current.cssVars.push(row.cssVar);
    else byPath.set(row.path, { layer: row.layer, cssVars: [row.cssVar] });
  }
  return byPath;
}

function reachable(snapshot: Snapshot, read: ReadonlySet<CssVar>): Set<CssVar> {
  const reverse = dependents(snapshot, snapshot);
  const memo = new Map<CssVar, boolean>();
  const stack = new Set<CssVar>();
  const isLive = (cssVar: CssVar): boolean => {
    const cached = memo.get(cssVar);
    if (cached !== undefined) return cached;
    if (read.has(cssVar)) {
      memo.set(cssVar, true);
      return true;
    }
    if (stack.has(cssVar)) return false;
    stack.add(cssVar);
    let live = false;
    for (const next of reverse.get(cssVar) ?? []) {
      if (!isLive(next)) continue;
      live = true;
      break;
    }
    stack.delete(cssVar);
    memo.set(cssVar, live);
    return live;
  };
  const live = new Set<CssVar>();
  for (const row of snapshot.values()) {
    if (isLive(row.cssVar)) live.add(row.cssVar);
  }
  return live;
}

export function deadTokens(snapshot: Snapshot, files: readonly ConsumerFile[]): Violation[] {
  const read = new Set<CssVar>();
  for (const file of files) {
    for (const cssVar of readsOf(file.path, file.source)) read.add(cssVar);
  }
  const live = reachable(snapshot, read);
  const dead: Violation[] = [];
  for (const [path, row] of representatives(snapshot)) {
    if (row.cssVars.some((cssVar) => live.has(cssVar))) continue;
    dead.push({ rule: 'dead', path, cssVar: row.cssVars[0] });
  }
  dead.sort(violationOrder);
  return dead;
}

export function collectViolations(snapshot: Snapshot, schema: Schema, files: readonly ConsumerFile[]): Violation[] {
  const names: Violation[] = [];
  for (const [path, row] of representatives(snapshot)) {
    if (row.layer !== 'contract') continue;
    names.push(...nameViolations(path, schema));
  }
  names.sort(violationOrder);
  return [...names, ...deadTokens(snapshot, files)];
}

export function hint(violation: Violation): string {
  if (violation.rule === 'state') {
    return `${violation.path}: unknown state "${violation.word}". States are ${STATES.join(', ')}. Rename to one of them, or if "${violation.word}" is a variant, move it before the property (e.g. option.selected.bg).`;
  }
  if (violation.rule === 'depth') {
    return `${violation.path}: too deep. Names are component.(part.)property(.state); fold the extra segment into the part or property (e.g. text.h3-font.size).`;
  }
  return `${violation.path} (${violation.cssVar}): no CSS var() or src string reads this token, directly or through an alias. Read it from a component stylesheet or don't add it.`;
}

export function staleLine(violation: { rule: Rule; path: string }): string {
  return `grandfathered name ${violation.path} (${violation.rule}) is fixed; remove it from tokens/name-grandfather.json`;
}

export function addedLine(violation: { rule: Rule; path: string }): string {
  return `grandfather list can only shrink; ${violation.path} (${violation.rule}) is new. Fix the name instead (see hint)`;
}

function sameViolation(listed: Violation, found: Violation): boolean {
  if (listed.rule !== found.rule || listed.path !== found.path) return false;
  if (listed.rule === 'state' && found.rule === 'state') return listed.word === found.word;
  return true;
}

export function ratchet(input: RatchetInput): RatchetResult {
  const foundByKey = new Map(input.found.map((violation) => [violationKey(violation), violation]));
  const unlisted: Violation[] = [];
  const stale: Violation[] = [];
  for (const violation of input.found) {
    const listed = input.list.get(violationKey(violation));
    if (listed === undefined || !sameViolation(listed, violation)) unlisted.push(violation);
  }
  for (const listed of input.list.values()) {
    const current = foundByKey.get(violationKey(listed));
    if (current === undefined || !sameViolation(listed, current)) stale.push(listed);
  }
  const added: Violation[] = [];
  let note: string | null = null;
  if (input.base === 'missing') note = MISSING_BASE_NOTE;
  else if (input.base) {
    for (const listed of input.list.values()) {
      if (!input.base.has(violationKey(listed))) added.push(listed);
    }
  }
  unlisted.sort(violationOrder);
  stale.sort(violationOrder);
  added.sort(violationOrder);
  return { unlisted, stale, added, note };
}

export function tallyLine(found: readonly Violation[], unlisted: readonly Violation[]): string {
  const names = new Set(found.filter((violation) => violation.rule !== 'dead').map((violation) => violation.path));
  const added = new Set(unlisted.filter((violation) => violation.rule !== 'dead').map((violation) => violation.path));
  const dead = found.filter((violation) => violation.rule === 'dead').length;
  const newDead = unlisted.filter((violation) => violation.rule === 'dead').length;
  return `names: ${names.size} grandfathered, ${added.size} new; dead: ${dead} grandfathered, ${newDead} new`;
}
