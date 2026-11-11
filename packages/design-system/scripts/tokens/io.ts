import { mkdir, readFile, rename, unlink, writeFile } from 'node:fs/promises';
import { dirname, relative, resolve, sep } from 'node:path';
import { fail } from './shared.ts';

export function insideRoot(root: string, candidate: string): boolean {
  const rel = relative(root, candidate);
  return rel !== '' && rel !== '..' && !rel.startsWith(`..${sep}`);
}

export async function readJson(file: string, tokensRoot: string): Promise<unknown> {
  const abs = resolve(file);
  if (!insideRoot(tokensRoot, abs) && abs !== tokensRoot) {
    fail(`Refused to read ${abs}: outside tokens/`);
  }
  let raw: string;
  try {
    raw = await readFile(abs, 'utf8');
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    fail(`Failed to read ${relative(tokensRoot, abs)}: ${detail}`);
  }
  try {
    return JSON.parse(raw) as unknown;
  } catch {
    fail(`Invalid JSON: ${relative(tokensRoot, abs)}`);
  }
}

export async function atomicWrite(file: string, contents: string): Promise<void> {
  await mkdir(dirname(file), { recursive: true });
  const tmp = `${file}.tmp`;
  try {
    await writeFile(tmp, contents);
    await rename(tmp, file);
  } catch (error) {
    await unlink(tmp).catch(() => undefined);
    const detail = error instanceof Error ? error.message : String(error);
    fail(`Refused to replace ${file}: ${detail}`);
  }
  const written = await readFile(file, 'utf8');
  if (written !== contents) fail(`Wrote ${file} but the file did not match`);
}

export async function writeOrCheck(outputs: [file: string, contents: string][], check: boolean, label: string): Promise<void> {
  if (!check) {
    for (const [file, contents] of outputs) await atomicWrite(file, contents);
    return;
  }
  for (const [file, contents] of outputs) {
    let current: string;
    try {
      current = await readFile(file, 'utf8');
    } catch {
      fail(`${label} failed: ${file} is missing`);
    }
    if (current !== contents) fail(`${label} failed: ${file} drifted`);
  }
}
