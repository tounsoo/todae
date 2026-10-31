import { consumeCssVar, cssVarName } from '../build-tokens.ts';
import type { Layer } from './shared.ts';

const CSS_VAR_RE = /^--todae-[a-z0-9-]+$/;
const CONTEXT_ORDER = ['light', 'dark', 'compact', 'comfortable', 'spacious', 'primary', 'secondary', 'ghost'];

declare const cssVarBrand: unique symbol;

export type CssVar = `--todae-${string}` & { readonly [cssVarBrand]: typeof cssVarBrand };

export type Row = {
  path: string;
  type: string;
  cssVar: CssVar;
  cssValue: string;
  context: string | null;
  layer: Layer;
};

export type Snapshot = Map<`${string}@${string}`, Row>;

export type Change = {
  path: string;
  cssVar: CssVar;
  kind: 'added' | 'removed' | 'changed';
  contexts: string[];
};

export type Consumer = {
  component: string | null;
  file: string;
};

export type StillRead = {
  path: string;
  cssVar: CssVar;
  component: string | null;
  file: string;
};

export type Report = {
  changes: Change[];
  affected: Map<CssVar, { via: CssVar[]; sources: CssVar[] }>;
  consumers: Map<string, { component: string | null; file: string; vars: CssVar[] }>;
  paths: Map<CssVar, string>;
  stillRead: StillRead[];
};

export type ConsumerFile = {
  path: string;
  source: string;
  tree?: 'head' | 'base';
};

export function isCssVar(value: string): value is CssVar {
  return CSS_VAR_RE.test(value);
}

export function cssVarOf(value: string): CssVar {
  if (!isCssVar(value)) throw new Error(`Not a Todae CSS variable: ${value}`);
  return value;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function snapshotKey(path: string, context: string | null): `${string}@${string}` {
  return `${path}@${context ?? ''}`;
}

function requireString(row: Record<string, unknown>, field: 'path' | 'type' | 'cssValue'): string {
  const value = row[field];
  if (typeof value !== 'string' || value.length === 0) {
    throw new Error(`tokens.generated.json row is missing ${field}`);
  }
  return value;
}

export function parseSnapshot(json: unknown): Snapshot {
  if (!isRecord(json) || json.version !== 1 || !Array.isArray(json.tokens)) {
    throw new Error('tokens.generated.json version must be 1');
  }
  const snapshot: Snapshot = new Map();
  for (const entry of json.tokens) {
    if (!isRecord(entry)) throw new Error('tokens.generated.json row is not an object');
    if (!('cssVar' in entry)) throw new Error('tokens.generated.json row is missing cssVar');
    if (typeof entry.cssVar !== 'string') throw new Error('tokens.generated.json row is missing cssVar');
    const path = requireString(entry, 'path');
    const context = entry.context === null ? null : entry.context;
    if (typeof context !== 'string' && context !== null) {
      throw new Error(`tokens.generated.json row ${path} is missing context`);
    }
    const layer = entry.layer;
    if (layer !== 'core' && layer !== 'appearance' && layer !== 'density' && layer !== 'contract') {
      throw new Error(`tokens.generated.json row ${path} is missing layer`);
    }
    const row: Row = {
      path,
      type: requireString(entry, 'type'),
      cssVar: cssVarOf(entry.cssVar),
      cssValue: requireString(entry, 'cssValue'),
      context,
      layer,
    };
    const key = snapshotKey(row.path, row.context);
    if (snapshot.has(key)) throw new Error(`tokens.generated.json repeats ${row.path} in context ${row.context ?? 'default'}`);
    snapshot.set(key, row);
  }
  return snapshot;
}

function sortContexts(contexts: Iterable<string>): string[] {
  return [...contexts].sort((a, b) => {
    const ai = CONTEXT_ORDER.indexOf(a);
    const bi = CONTEXT_ORDER.indexOf(b);
    if (ai === -1 && bi === -1) return a < b ? -1 : a > b ? 1 : 0;
    if (ai === -1) return 1;
    if (bi === -1) return -1;
    return ai - bi;
  });
}

function rowsByPath(snapshot: Snapshot): Map<string, Row[]> {
  const grouped = new Map<string, Row[]>();
  for (const row of snapshot.values()) {
    const list = grouped.get(row.path);
    if (list) list.push(row);
    else grouped.set(row.path, [row]);
  }
  return grouped;
}

function rowIn(rows: Row[], context: string): Row | undefined {
  return rows.find((row) => (row.context ?? '') === context);
}

export function diffSnapshots(base: Snapshot, head: Snapshot): Change[] {
  const basePaths = rowsByPath(base);
  const headPaths = rowsByPath(head);
  const paths = [...new Set([...basePaths.keys(), ...headPaths.keys()])].sort((a, b) => a.localeCompare(b));
  const changes: Change[] = [];
  for (const path of paths) {
    const before = basePaths.get(path) ?? [];
    const after = headPaths.get(path) ?? [];
    const contextKeys = new Set<string>([...before, ...after].map((row) => row.context ?? ''));
    const differed: string[] = [];
    let changed = false;
    for (const context of contextKeys) {
      const left = rowIn(before, context);
      const right = rowIn(after, context);
      if (left && right && left.cssValue === right.cssValue && left.type === right.type) continue;
      changed = true;
      if (context) differed.push(context);
    }
    if (!changed) continue;
    const sample = after[0] ?? before[0];
    if (!sample) continue;
    const kind: Change['kind'] = before.length === 0 ? 'added' : after.length === 0 ? 'removed' : 'changed';
    changes.push({ path, cssVar: sample.cssVar, kind, contexts: sortContexts(differed) });
  }
  return changes;
}

function varsInValue(cssValue: string): CssVar[] {
  const found: CssVar[] = [];
  for (const match of cssValue.matchAll(/var\(\s*(--todae-[a-z0-9-]+)/g)) {
    const value = match[1];
    if (value && isCssVar(value)) found.push(value);
  }
  return found;
}

function packConsumeVar(path: string): { cssVar: CssVar; path: string } | null {
  const consume = consumeCssVar(path);
  if (!consume || consume === cssVarName(path) || !isCssVar(consume)) return null;
  const parts = path.split('.');
  const root = parts[0];
  if (!root) return null;
  for (let index = 1; index < parts.length; index += 1) {
    const candidate = [root, ...parts.slice(index)].join('.');
    if (cssVarName(candidate) === consume) return { cssVar: consume, path: candidate };
  }
  return { cssVar: consume, path: consume };
}

export function dependents(head: Snapshot, base: Snapshot): Map<CssVar, CssVar[]> {
  const reverse = new Map<CssVar, Set<CssVar>>();
  const add = (from: CssVar, to: CssVar) => {
    if (from === to) return;
    const list = reverse.get(from);
    if (list) list.add(to);
    else reverse.set(from, new Set([to]));
  };
  for (const row of [...base.values(), ...head.values()]) {
    for (const ref of varsInValue(row.cssValue)) add(ref, row.cssVar);
    const alias = packConsumeVar(row.path);
    if (alias) add(row.cssVar, alias.cssVar);
  }
  return new Map([...reverse].map(([cssVar, next]) => [cssVar, [...next]]));
}

export function affectedVars(changes: Change[], reverse: Map<CssVar, CssVar[]>): Map<CssVar, { via: CssVar[]; sources: CssVar[] }> {
  const nodes = new Map<CssVar, { via: CssVar[]; sources: Set<CssVar> }>();
  const queue: CssVar[] = [];
  for (const change of changes) {
    const existing = nodes.get(change.cssVar);
    if (existing) existing.sources.add(change.cssVar);
    else nodes.set(change.cssVar, { via: [change.cssVar], sources: new Set([change.cssVar]) });
    queue.push(change.cssVar);
  }
  let index = 0;
  while (index < queue.length) {
    const current = queue[index];
    index += 1;
    if (current === undefined) continue;
    const from = nodes.get(current);
    if (!from) continue;
    for (const next of reverse.get(current) ?? []) {
      let node = nodes.get(next);
      if (!node) {
        node = { via: [...from.via, next], sources: new Set() };
        nodes.set(next, node);
      }
      let grew = false;
      for (const source of from.sources) {
        if (node.sources.has(source)) continue;
        node.sources.add(source);
        grew = true;
      }
      if (grew) queue.push(next);
    }
  }
  return new Map([...nodes].map(([cssVar, node]) => [cssVar, { via: node.via, sources: [...node.sources].sort() }]));
}

function componentName(file: string): string | null {
  const normalized = file.replaceAll('\\', '/');
  const marker = '/src/components/';
  const at = normalized.indexOf(marker);
  const rest = at >= 0 ? normalized.slice(at + marker.length) : normalized.startsWith('src/components/') ? normalized.slice('src/components/'.length) : null;
  if (rest === null || rest.includes('/')) return null;
  const sheet = rest.endsWith('.module.css');
  const view = rest.endsWith('.tsx') && !rest.endsWith('.test.tsx');
  if (!sheet && !view) return null;
  const stem = rest.split('.')[0];
  return stem || null;
}

function displayPath(file: string): string {
  const normalized = file.replaceAll('\\', '/');
  const prefix = 'packages/design-system/';
  return normalized.startsWith(prefix) ? normalized.slice(prefix.length) : normalized;
}

export function readsOf(file: string, source: string): CssVar[] {
  const normalized = file.replaceAll('\\', '/');
  const base = normalized.slice(normalized.lastIndexOf('/') + 1);
  if (base.endsWith('.test.tsx') || base.endsWith('.test.ts')) return [];
  const found = new Set<CssVar>();
  if (base.endsWith('.css')) {
    for (const cssVar of varsInValue(source)) found.add(cssVar);
  } else if (base.endsWith('.tsx') || base.endsWith('.ts')) {
    for (const match of source.matchAll(/(['"])(--todae-[a-z0-9-]+)\1/g)) {
      const value = match[2];
      if (value && isCssVar(value)) found.add(value);
    }
  }
  return [...found].sort();
}

function indexPaths(base: Snapshot, head: Snapshot): Map<CssVar, string> {
  const paths = new Map<CssVar, string>();
  for (const row of [...base.values(), ...head.values()]) {
    if (!paths.has(row.cssVar)) paths.set(row.cssVar, row.path);
    const alias = packConsumeVar(row.path);
    if (alias && !paths.has(alias.cssVar)) paths.set(alias.cssVar, alias.path);
  }
  return paths;
}

type Hit = { component: string | null; file: string; vars: Set<CssVar> };

function collectHits(files: ConsumerFile[], affected: Report['affected'], include: (cssVar: CssVar) => boolean): Map<string, Hit> {
  const hits = new Map<string, Hit>();
  for (const file of files) {
    const component = componentName(file.path);
    const shown = displayPath(file.path);
    const key = component ?? shown;
    for (const cssVar of readsOf(file.path, file.source)) {
      if (!affected.has(cssVar) || !include(cssVar)) continue;
      const hit = hits.get(key);
      if (hit) hit.vars.add(cssVar);
      else hits.set(key, { component, file: shown, vars: new Set([cssVar]) });
    }
  }
  return hits;
}

function toConsumers(hits: Map<string, Hit>): Report['consumers'] {
  const consumers: Report['consumers'] = new Map();
  for (const [key, hit] of hits) {
    consumers.set(key, { component: hit.component, file: hit.file, vars: [...hit.vars].sort() });
  }
  return consumers;
}

export function buildReport(input: { base: Snapshot; head: Snapshot; files: ConsumerFile[] }): Report {
  const changes = diffSnapshots(input.base, input.head);
  const affected = affectedVars(changes, dependents(input.head, input.base));
  const paths = indexPaths(input.base, input.head);
  const removed = new Set(changes.filter((change) => change.kind === 'removed').map((change) => change.cssVar));
  const headFiles = input.files.filter((file) => file.tree !== 'base');
  const baseFiles = input.files.filter((file) => file.tree === 'base');
  const hits = collectHits(headFiles, affected, () => true);
  if (removed.size > 0) {
    for (const [key, hit] of collectHits(baseFiles, affected, (cssVar) => removed.has(cssVar))) {
      const existing = hits.get(key);
      if (!existing) hits.set(key, hit);
      else for (const cssVar of hit.vars) existing.vars.add(cssVar);
    }
  }
  const stillRead: StillRead[] = [];
  for (const [key, hit] of collectHits(headFiles, affected, (cssVar) => removed.has(cssVar))) {
    for (const cssVar of [...hit.vars].sort()) {
      stillRead.push({
        path: paths.get(cssVar) ?? key,
        cssVar,
        component: hit.component,
        file: hit.file,
      });
    }
  }
  stillRead.sort((a, b) => a.path.localeCompare(b.path) || (a.component ?? a.file).localeCompare(b.component ?? b.file));
  return { changes, affected, consumers: toConsumers(hits), paths, stillRead };
}

function shortRef(ref: string): string {
  return /^[0-9a-f]{7,40}$/i.test(ref) ? ref.slice(0, 7) : ref;
}

function countLabel(count: number, singular: string, plural: string): string {
  return `${count} ${count === 1 ? singular : plural}`;
}

function chainFor(cssVar: CssVar, report: Report): string {
  const via = report.affected.get(cssVar)?.via ?? [cssVar];
  return via.map((step) => `\`${report.paths.get(step) ?? step}\``).join(' → ');
}

function formatReads(vars: CssVar[]): string {
  const shown = vars.slice(0, 5).map((cssVar) => `\`${cssVar}\``).join(', ');
  if (vars.length <= 5) return shown;
  return `${shown} +${vars.length - 5} more`;
}

function reachableFrom(change: Change, report: Report): Set<CssVar> {
  const reached = new Set<CssVar>();
  for (const [cssVar, entry] of report.affected) {
    if (entry.sources.includes(change.cssVar)) reached.add(cssVar);
  }
  reached.add(change.cssVar);
  return reached;
}

function componentReads(change: Change, report: Report): boolean {
  const reached = reachableFrom(change, report);
  for (const entry of report.consumers.values()) {
    if (entry.component === null) continue;
    if (entry.vars.some((cssVar) => reached.has(cssVar))) return true;
  }
  return false;
}

export function renderMarkdown(report: Report, ends: { base: string; head: string; baseMissing?: boolean }): string {
  if (report.changes.length === 0) return 'No token values changed.';
  const components = [...report.consumers.values()]
    .filter((entry) => entry.component !== null)
    .sort((a, b) => (a.component ?? '').localeCompare(b.component ?? ''));
  const others = [...report.consumers.values()]
    .filter((entry) => entry.component === null)
    .sort((a, b) => a.file.localeCompare(b.file));
  const componentCount = components.length;
  const summary = [
    `Base \`${shortRef(ends.base)}\` → head \`${shortRef(ends.head)}\`.`,
    `${countLabel(report.changes.length, 'token', 'tokens')} changed,`,
    `${countLabel(report.affected.size, 'var', 'vars')} affected,`,
    componentCount === 1 ? '1 component reads them.' : `${componentCount} components read them.`,
  ].join(' ');
  const lines = ['## Token consumers', ''];
  if (ends.baseMissing) {
    lines.push('Base has no `tokens.generated.json`. Every head token is treated as added.', '');
  }
  lines.push(summary, '');
  lines.push('| Changed token | Kind | Contexts |', '| --- | --- | --- |');
  for (const change of report.changes) {
    lines.push(`| \`${change.path}\` | ${change.kind} | ${change.contexts.join(', ')} |`);
  }
  lines.push('');
  if (components.length > 0) {
    lines.push('| Component | Reads | Via |', '| --- | --- | --- |');
    for (const entry of components) {
      const first = entry.vars[0];
      const via = first ? chainFor(first, report) : '';
      lines.push(`| ${entry.component} | ${formatReads(entry.vars)} | ${via} |`);
    }
    lines.push('');
  }
  for (const change of report.changes) {
    if (componentReads(change, report)) continue;
    if (report.stillRead.some((hit) => hit.cssVar === change.cssVar)) continue;
    lines.push(`\`${change.path}\` (no component reads this).`, '');
  }
  if (others.length > 0) {
    const listed = others.map((entry) => `\`${entry.file}\` (${formatReads(entry.vars)})`).join(', ');
    lines.push(`Other files: ${listed}.`, '');
  }
  for (const entry of [...components, ...others]) {
    if (entry.vars.length <= 5) continue;
    const name = entry.component ?? entry.file;
    lines.push('<details>', `<summary>${name}</summary>`, '', entry.vars.map((cssVar) => `\`${cssVar}\``).join(', '), '', '</details>', '');
  }
  if (report.stillRead.length > 0) {
    lines.push('⚠ Removed but still read', '', '| Token | Reader | Variable |', '| --- | --- | --- |');
    for (const hit of report.stillRead) {
      lines.push(`| \`${hit.path}\` | ${hit.component ?? `\`${hit.file}\``} | \`${hit.cssVar}\` |`);
    }
    lines.push('');
  }
  return lines.join('\n').replace(/\n{3,}/g, '\n\n').trimEnd();
}
