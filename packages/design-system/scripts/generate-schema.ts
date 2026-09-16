import { mkdir, readdir, readFile, rename, unlink, writeFile } from 'node:fs/promises';
import { dirname, join, relative } from 'node:path';
import { pathToFileURL } from 'node:url';
import type { ComponentMeta, ComponentsDocument, PropMeta } from '../src/meta.ts';

const root = join(import.meta.dirname, '..');
const srcDir = join(root, 'src');
const outFile = join(root, 'schema', 'components.json');

function fail(message: string): never {
  throw new Error(message);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isProp(value: unknown, loc: string): PropMeta {
  if (!isRecord(value)) fail(`${loc} must be an object`);
  const extra = Object.keys(value).filter(
    (key) => !['name', 'type', 'required', 'default', 'description'].includes(key),
  );
  if (extra.length > 0) fail(`${loc} has unknown keys: ${extra.join(', ')}`);
  if (typeof value.name !== 'string' || value.name.length === 0) {
    fail(`${loc}.name must be a non-empty string`);
  }
  if (typeof value.type !== 'string' || value.type.length === 0) {
    fail(`${loc}.type must be a non-empty string`);
  }
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

function isComponent(value: unknown, loc: string): ComponentMeta {
  if (!isRecord(value)) fail(`${loc} must be an object`);
  const extra = Object.keys(value).filter(
    (key) => !['name', 'description', 'props'].includes(key),
  );
  if (extra.length > 0) fail(`${loc} has unknown keys: ${extra.join(', ')}`);
  if (typeof value.name !== 'string' || value.name.length === 0) {
    fail(`${loc}.name must be a non-empty string`);
  }
  if (typeof value.description !== 'string') fail(`${loc}.description must be a string`);
  if (!Array.isArray(value.props)) fail(`${loc}.props must be an array`);
  const names = new Set<string>();
  const props = value.props.map((prop, i) => {
    const parsed = isProp(prop, `${loc}.props[${i}]`);
    if (names.has(parsed.name)) fail(`${loc} repeats prop "${parsed.name}"`);
    names.add(parsed.name);
    return parsed;
  });
  return { name: value.name, description: value.description, props };
}

async function walk(dir: string): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) files.push(...(await walk(path)));
    else if (entry.name.endsWith('.meta.ts')) files.push(path);
  }
  return files;
}

const files = (await walk(srcDir)).sort();
const components: ComponentMeta[] = [];
const names = new Set<string>();

for (const file of files) {
  const loc = relative(root, file);
  let mod: Record<string, unknown>;
  try {
    mod = (await import(pathToFileURL(file).href)) as Record<string, unknown>;
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    fail(`Failed to load ${loc}: ${detail}`);
  }
  const meta = isComponent(mod.meta, `${loc} export meta`);
  if (names.has(meta.name)) fail(`Duplicate component name "${meta.name}" in ${loc}`);
  names.add(meta.name);
  components.push(meta);
}

components.sort((a, b) => a.name.localeCompare(b.name));

const document: ComponentsDocument = { version: 1, components };
const json = `${JSON.stringify(document, null, 2)}\n`;

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

process.stdout.write(`Wrote ${relative(root, outFile)} (${components.length} components)\n`);
