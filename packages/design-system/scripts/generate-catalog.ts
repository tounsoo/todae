import { mkdir, readdir, readFile, rename, unlink, writeFile } from 'node:fs/promises';
import { dirname, join, relative, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import {
  INTENTS,
  type Catalog,
  type ComponentMeta,
  type ComponentsDocument,
  type Intent,
  type PatternFill,
  type PatternMeta,
  type PatternNode,
  type PropMeta,
  type Relation,
  type SlotMeta,
} from '../src/catalog/types.ts';

const INTENT_SET = new Set<string>(INTENTS);
const RELATION_SET = new Set(['alternative', 'pairsWith', 'partOf', 'requires']);
const KIND_SET = new Set(['component', 'part', 'hook', 'provider']);

const defaultRoot = join(import.meta.dirname, '..');

export function fail(message: string): never {
  throw new Error(message);
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isStringArray(value: unknown, loc: string): string[] {
  if (!Array.isArray(value)) fail(`${loc} must be an array`);
  return value.map((item, i) => {
    if (typeof item !== 'string' || item.length === 0) fail(`${loc}[${i}] must be a non-empty string`);
    return item;
  });
}

function isProp(value: unknown, loc: string): PropMeta {
  if (!isRecord(value)) fail(`${loc} must be an object`);
  const extra = Object.keys(value).filter(
    (key) => !['name', 'type', 'required', 'default', 'description'].includes(key),
  );
  if (extra.length > 0) fail(`${loc} has unknown keys: ${extra.join(', ')}`);
  if (typeof value.name !== 'string' || value.name.length === 0) fail(`${loc}.name must be a non-empty string`);
  if (typeof value.type !== 'string' || value.type.length === 0) fail(`${loc}.type must be a non-empty string`);
  if (typeof value.required !== 'boolean') fail(`${loc}.required must be a boolean`);
  if (typeof value.description !== 'string') fail(`${loc}.description must be a string`);
  if (value.default !== undefined && typeof value.default !== 'string') {
    fail(`${loc}.default must be a string when set`);
  }
  const prop: PropMeta = {
    name: value.name,
    type: value.type,
    required: value.required,
    description: value.description,
  };
  if (value.default !== undefined) prop.default = value.default;
  return prop;
}

function isSlot(value: unknown, loc: string): SlotMeta {
  if (!isRecord(value)) fail(`${loc} must be an object`);
  const extra = Object.keys(value).filter((key) => !['name', 'accepts', 'required', 'description'].includes(key));
  if (extra.length > 0) fail(`${loc} has unknown keys: ${extra.join(', ')}`);
  if (typeof value.name !== 'string' || value.name.length === 0) fail(`${loc}.name must be a non-empty string`);
  if (!Array.isArray(value.accepts) || value.accepts.some((item) => typeof item !== 'string' || item.length === 0)) {
    fail(`${loc}.accepts must be an array of non-empty strings`);
  }
  if (typeof value.required !== 'boolean') fail(`${loc}.required must be a boolean`);
  if (typeof value.description !== 'string') fail(`${loc}.description must be a string`);
  return {
    name: value.name,
    accepts: value.accepts as string[],
    required: value.required,
    description: value.description,
  };
}

function isRelation(value: unknown, loc: string): Relation {
  if (!isRecord(value)) fail(`${loc} must be an object`);
  const extra = Object.keys(value).filter((key) => !['id', 'relation'].includes(key));
  if (extra.length > 0) fail(`${loc} has unknown keys: ${extra.join(', ')}`);
  if (typeof value.id !== 'string' || value.id.length === 0) fail(`${loc}.id must be a non-empty string`);
  if (typeof value.relation !== 'string' || !RELATION_SET.has(value.relation)) {
    fail(`${loc}.relation must be alternative | pairsWith | partOf | requires`);
  }
  return { id: value.id, relation: value.relation as Relation['relation'] };
}

function isIntents(value: unknown, loc: string): Intent[] {
  const intents = isStringArray(value, loc);
  for (const intent of intents) {
    if (!INTENT_SET.has(intent)) fail(`${loc} has unknown intent "${intent}"`);
  }
  return intents as Intent[];
}

function rejectTwoDots(id: string, loc: string): void {
  if (id.split('.').length > 2) fail(`${loc} has two-dot id "${id}"`);
}

function isFill(value: unknown): value is PatternFill {
  return isRecord(value) && Object.keys(value).length === 1 && typeof value.$fill === 'string' && value.$fill.length > 0;
}

function collectFills(node: PatternNode | PatternFill, found: Set<string>): void {
  if (isFill(node)) {
    found.add(node.$fill);
    return;
  }
  if (node.props) {
    for (const value of Object.values(node.props)) {
      if (isFill(value)) found.add(value.$fill);
    }
  }
  for (const child of node.children ?? []) collectFills(child, found);
}

function isPatternNode(value: unknown, loc: string): PatternNode {
  if (!isRecord(value)) fail(`${loc} must be an object`);
  if (isFill(value)) fail(`${loc} must be a component node`);
  const extra = Object.keys(value).filter((key) => !['component', 'props', 'spread', 'children'].includes(key));
  if (extra.length > 0) fail(`${loc} has unknown keys: ${extra.join(', ')}`);
  if (typeof value.component !== 'string' || value.component.length === 0) {
    fail(`${loc}.component must be a non-empty string`);
  }
  rejectTwoDots(value.component, `${loc}.component`);
  let props: PatternNode['props'];
  if (value.props !== undefined) {
    if (!isRecord(value.props)) fail(`${loc}.props must be an object`);
    props = {};
    for (const [key, raw] of Object.entries(value.props)) {
      if (typeof raw === 'string' || typeof raw === 'number' || typeof raw === 'boolean' || isFill(raw)) {
        props[key] = raw;
      } else {
        fail(`${loc}.props.${key} must be a string, number, boolean, or { $fill }`);
      }
    }
  }
  if (value.spread !== undefined && (typeof value.spread !== 'string' || value.spread.length === 0)) {
    fail(`${loc}.spread must be a non-empty string when set`);
  }
  const children = value.children === undefined
    ? undefined
    : (value.children as unknown[]).map((child, i) => {
        if (isFill(child)) return child;
        return isPatternNode(child, `${loc}.children[${i}]`);
      });
  if (value.children !== undefined && !Array.isArray(value.children)) fail(`${loc}.children must be an array`);
  const node: PatternNode = { component: value.component };
  if (props) node.props = props;
  if (typeof value.spread === 'string') node.spread = value.spread;
  if (children) node.children = children;
  return node;
}

export function isComponent(value: unknown, loc: string): ComponentMeta {
  if (!isRecord(value)) fail(`${loc} must be an object`);
  const extra = Object.keys(value).filter(
    (key) =>
      !['name', 'kind', 'description', 'whenToUse', 'whenNotToUse', 'intents', 'props', 'slots', 'related', 'docs'].includes(
        key,
      ),
  );
  if (extra.length > 0) fail(`${loc} has unknown keys: ${extra.join(', ')}`);
  if (typeof value.name !== 'string' || value.name.length === 0) fail(`${loc}.name must be a non-empty string`);
  rejectTwoDots(value.name, `${loc}.name`);
  if (typeof value.kind !== 'string' || !KIND_SET.has(value.kind)) {
    fail(`${loc}.kind must be component | part | hook | provider`);
  }
  if (value.kind === 'part' && !value.name.includes('.')) fail(`${loc} part id must contain exactly one dot`);
  if (typeof value.description !== 'string') fail(`${loc}.description must be a string`);
  const whenToUse = isStringArray(value.whenToUse, `${loc}.whenToUse`);
  if (value.kind !== 'part' && whenToUse.length < 1) {
    fail(`${loc}.whenToUse must have at least one bullet`);
  }
  const whenNotToUse = isStringArray(value.whenNotToUse, `${loc}.whenNotToUse`);
  const intents = isIntents(value.intents, `${loc}.intents`);
  if (!Array.isArray(value.props)) fail(`${loc}.props must be an array`);
  const names = new Set<string>();
  const props = value.props.map((prop, i) => {
    const parsed = isProp(prop, `${loc}.props[${i}]`);
    if (names.has(parsed.name)) fail(`${loc} repeats prop "${parsed.name}"`);
    names.add(parsed.name);
    return parsed;
  });
  const meta: ComponentMeta = {
    name: value.name,
    kind: value.kind as ComponentMeta['kind'],
    description: value.description,
    whenToUse,
    whenNotToUse,
    intents,
    props,
  };
  if (value.slots !== undefined) {
    if (!Array.isArray(value.slots)) fail(`${loc}.slots must be an array`);
    meta.slots = value.slots.map((slot, i) => isSlot(slot, `${loc}.slots[${i}]`));
  }
  if (value.related !== undefined) {
    if (!Array.isArray(value.related)) fail(`${loc}.related must be an array`);
    meta.related = value.related.map((rel, i) => isRelation(rel, `${loc}.related[${i}]`));
  }
  if (value.docs !== undefined) {
    if (typeof value.docs !== 'string' || value.docs.length === 0) fail(`${loc}.docs must be a non-empty string`);
    meta.docs = value.docs;
  }
  return meta;
}

export function isPattern(value: unknown, loc: string): PatternMeta {
  if (!isRecord(value)) fail(`${loc} must be an object`);
  const extra = Object.keys(value).filter(
    (key) =>
      !['id', 'name', 'description', 'whenToUse', 'whenNotToUse', 'intents', 'uses', 'hooks', 'tree', 'fills', 'docs'].includes(
        key,
      ),
  );
  if (extra.length > 0) fail(`${loc} has unknown keys: ${extra.join(', ')}`);
  if (typeof value.id !== 'string' || value.id.length === 0) fail(`${loc}.id must be a non-empty string`);
  rejectTwoDots(value.id, `${loc}.id`);
  if (typeof value.name !== 'string' || value.name.length === 0) fail(`${loc}.name must be a non-empty string`);
  if (typeof value.description !== 'string') fail(`${loc}.description must be a string`);
  const whenToUse = isStringArray(value.whenToUse, `${loc}.whenToUse`);
  if (whenToUse.length < 1) fail(`${loc}.whenToUse must have at least one bullet`);
  const whenNotToUse = isStringArray(value.whenNotToUse, `${loc}.whenNotToUse`);
  const intents = isIntents(value.intents, `${loc}.intents`);
  const uses = isStringArray(value.uses, `${loc}.uses`);
  let hooks: PatternMeta['hooks'];
  if (value.hooks !== undefined) {
    if (!Array.isArray(value.hooks)) fail(`${loc}.hooks must be an array`);
    hooks = value.hooks.map((hook, i) => {
      if (!isRecord(hook)) fail(`${loc}.hooks[${i}] must be an object`);
      if (typeof hook.id !== 'string' || hook.id.length === 0) fail(`${loc}.hooks[${i}].id must be a non-empty string`);
      if (typeof hook.as !== 'string' || hook.as.length === 0) fail(`${loc}.hooks[${i}].as must be a non-empty string`);
      return { id: hook.id, as: hook.as };
    });
  }
  if (!Array.isArray(value.tree)) fail(`${loc}.tree must be an array`);
  const tree = value.tree.map((node, i) => isPatternNode(node, `${loc}.tree[${i}]`));
  if (!Array.isArray(value.fills)) fail(`${loc}.fills must be an array`);
  const fills = value.fills.map((fill, i) => {
    if (!isRecord(fill)) fail(`${loc}.fills[${i}] must be an object`);
    if (typeof fill.name !== 'string' || fill.name.length === 0) {
      fail(`${loc}.fills[${i}].name must be a non-empty string`);
    }
    if (typeof fill.description !== 'string') fail(`${loc}.fills[${i}].description must be a string`);
    return { name: fill.name, description: fill.description };
  });
  const usedFills = new Set<string>();
  for (const node of tree) collectFills(node, usedFills);
  const documented = new Set(fills.map((fill) => fill.name));
  for (const name of usedFills) {
    if (!documented.has(name)) fail(`${loc} has undocumented $fill "${name}"`);
  }
  const pattern: PatternMeta = {
    id: value.id,
    name: value.name,
    description: value.description,
    whenToUse,
    whenNotToUse,
    intents,
    uses,
    tree,
    fills,
  };
  if (hooks) pattern.hooks = hooks;
  if (value.docs !== undefined) {
    if (typeof value.docs !== 'string' || value.docs.length === 0) fail(`${loc}.docs must be a non-empty string`);
    pattern.docs = value.docs;
  }
  return pattern;
}

async function walk(dir: string, suffix: string): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true }).catch((error: NodeJS.ErrnoException) => {
    if (error.code === 'ENOENT') return [];
    throw error;
  });
  const files: string[] = [];
  for (const entry of entries) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) files.push(...(await walk(path, suffix)));
    else if (entry.name.endsWith(suffix)) files.push(path);
  }
  return files;
}

async function writeAtomic(outFile: string, json: string, root: string): Promise<void> {
  await mkdir(dirname(outFile), { recursive: true });
  const tmp = `${outFile}.tmp`;
  try {
    await writeFile(tmp, json);
    await rename(tmp, outFile);
  } catch (error) {
    await unlink(tmp).catch(() => undefined);
    const detail = error instanceof Error ? error.message : String(error);
    fail(`Refused to replace ${relative(root, outFile)}: ${detail}`);
  }
  const written = await readFile(outFile, 'utf8');
  if (written !== json) fail(`Wrote ${relative(root, outFile)} but the file did not match`);
}

export async function generateCatalog(options?: {
  root?: string;
  srcDir?: string;
  catalogOut?: string;
  schemaOut?: string;
}): Promise<{ catalog: Catalog; schema: ComponentsDocument }> {
  const root = options?.root ?? defaultRoot;
  const srcDir = options?.srcDir ?? join(root, 'src');
  const catalogOut = options?.catalogOut ?? join(root, 'catalog', 'catalog.json');
  const schemaOut = options?.schemaOut ?? join(root, 'schema', 'components.json');

  const metaFiles = (await walk(srcDir, '.meta.ts')).sort();
  const patternFiles = (await walk(join(srcDir, 'catalog', 'patterns'), '.pattern.ts')).sort();
  const components: ComponentMeta[] = [];
  const patterns: PatternMeta[] = [];
  const ids = new Set<string>();

  for (const file of metaFiles) {
    const loc = relative(root, file);
    let mod: Record<string, unknown>;
    try {
      mod = (await import(pathToFileURL(file).href)) as Record<string, unknown>;
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      fail(`Failed to load ${loc}: ${detail}`);
    }
    const meta = isComponent(mod.meta, `${loc} export meta`);
    if (ids.has(meta.name)) fail(`Duplicate id "${meta.name}" in ${loc}`);
    ids.add(meta.name);
    components.push(meta);
  }

  for (const file of patternFiles) {
    const loc = relative(root, file);
    let mod: Record<string, unknown>;
    try {
      mod = (await import(pathToFileURL(file).href)) as Record<string, unknown>;
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      fail(`Failed to load ${loc}: ${detail}`);
    }
    const pattern = isPattern(mod.pattern, `${loc} export pattern`);
    if (ids.has(pattern.id)) fail(`Duplicate id "${pattern.id}" in ${loc}`);
    ids.add(pattern.id);
    patterns.push(pattern);
  }

  const componentIds = new Set(components.map((item) => item.name));

  for (const component of components) {
    for (const rel of component.related ?? []) {
      if (!componentIds.has(rel.id)) fail(`Dangling related "${rel.id}" on ${component.name}`);
    }
    if (component.kind === 'part') {
      const parent = component.name.split('.')[0];
      const familyExists = componentIds.has(parent!) || [...componentIds].some((id) => id.startsWith(`${parent}.`));
      if (!familyExists) fail(`Part "${component.name}" is missing parent "${parent}"`);
    }
  }

  for (const pattern of patterns) {
    for (const id of pattern.uses) {
      if (!componentIds.has(id)) fail(`Dangling uses "${id}" on ${pattern.id}`);
    }
    for (const hook of pattern.hooks ?? []) {
      if (!componentIds.has(hook.id)) fail(`Dangling uses "${hook.id}" on ${pattern.id}`);
    }
    const visit = (node: PatternNode): void => {
      if (!componentIds.has(node.component)) fail(`Dangling tree.component "${node.component}" on ${pattern.id}`);
      for (const child of node.children ?? []) {
        if (!isFill(child)) visit(child);
      }
    };
    for (const node of pattern.tree) visit(node);
  }

  components.sort((a, b) => a.name.localeCompare(b.name));
  patterns.sort((a, b) => a.id.localeCompare(b.id));

  const catalog: Catalog = {
    version: 1,
    package: '@tounsoo/todae',
    intents: INTENTS,
    components,
    patterns,
  };
  const schema: ComponentsDocument = {
    version: 1,
    components: components.map((component) => ({
      name: component.name,
      description: component.description,
      props: component.props,
    })),
  };

  await writeAtomic(catalogOut, `${JSON.stringify(catalog, null, 2)}\n`, root);
  await writeAtomic(schemaOut, `${JSON.stringify(schema, null, 2)}\n`, root);
  process.stdout.write(
    `Wrote ${relative(root, catalogOut)} (${components.length} components, ${patterns.length} patterns)\n`,
  );
  process.stdout.write(`Wrote ${relative(root, schemaOut)} (${schema.components.length} components)\n`);
  return { catalog, schema };
}

const invoked = process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url;
if (invoked) {
  const rootFlag = process.argv.indexOf('--root');
  const root = rootFlag >= 0 ? process.argv[rootFlag + 1] : undefined;
  await generateCatalog(root ? { root } : undefined);
}
