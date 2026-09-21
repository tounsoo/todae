import { spawnSync } from 'node:child_process';
import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const validMeta = `export const meta = {
  name: 'Dialog',
  kind: 'component',
  description: 'Centered modal.',
  whenToUse: ['Ask for a confirm.'],
  whenNotToUse: ['Not a sheet.'],
  intents: ['confirm'],
  props: [{ name: 'open', type: 'boolean', required: true, description: 'Open.' }],
};
`;

const validPattern = `export const pattern = {
  id: 'confirm-dialog',
  name: 'Confirm dialog',
  description: 'Dialog plus actions.',
  whenToUse: ['Confirm a commit.'],
  whenNotToUse: [],
  intents: ['confirm'],
  uses: ['Dialog'],
  tree: [{ component: 'Dialog', children: [{ $fill: 'body' }] }],
  fills: [{ name: 'body', description: 'Body copy.' }],
};
`;

async function fixture(files: Record<string, string>) {
  const root = await mkdtemp(join(tmpdir(), 'todae-catalog-'));
  for (const [rel, body] of Object.entries(files)) {
    const path = join(root, rel);
    await mkdir(join(path, '..'), { recursive: true });
    await writeFile(path, body);
  }
  return {
    root,
    run() {
      const result = spawnSync(
        process.execPath,
        [
          '--experimental-strip-types',
          '--no-warnings=ExperimentalWarning',
          join(import.meta.dirname, 'generate-catalog.ts'),
          '--root',
          root,
        ],
        { encoding: 'utf8' },
      );
      if (result.status !== 0) {
        throw new Error((result.stderr || result.stdout || 'generate-catalog failed').trim());
      }
      return result.stdout;
    },
  };
}

describe('generate-catalog', () => {
  it('rejects an unknown key', async () => {
    const { run } = await fixture({
      'src/components/Dialog.meta.ts': validMeta.replace('props:', 'extra: 1,\n  props:'),
    });
    expect(run).toThrow(/unknown keys: extra/);
  });

  it('rejects a bad intent', async () => {
    const { run } = await fixture({
      'src/components/Dialog.meta.ts': validMeta.replace("'confirm'", "'nope'"),
    });
    expect(run).toThrow(/unknown intent "nope"/);
  });

  it('rejects dangling related', async () => {
    const { run } = await fixture({
      'src/components/Dialog.meta.ts': validMeta.replace(
        'props:',
        "related: [{ id: 'Missing', relation: 'pairsWith' }],\n  props:",
      ),
    });
    expect(run).toThrow(/Dangling related "Missing"/);
  });

  it('rejects dangling uses', async () => {
    const { run } = await fixture({
      'src/components/Dialog.meta.ts': validMeta,
      'src/catalog/patterns/bad.pattern.ts': validPattern.replace("uses: ['Dialog']", "uses: ['Missing']"),
    });
    expect(run).toThrow(/Dangling uses "Missing"/);
  });

  it('rejects dangling tree.component', async () => {
    const { run } = await fixture({
      'src/components/Dialog.meta.ts': validMeta,
      'src/catalog/patterns/bad.pattern.ts': validPattern.replace("component: 'Dialog'", "component: 'Missing'"),
    });
    expect(run).toThrow(/Dangling tree.component "Missing"/);
  });

  it('rejects an undocumented $fill', async () => {
    const { run } = await fixture({
      'src/components/Dialog.meta.ts': validMeta,
      'src/catalog/patterns/bad.pattern.ts': validPattern.replace(
        "fills: [{ name: 'body', description: 'Body copy.' }]",
        'fills: []',
      ),
    });
    expect(run).toThrow(/undocumented \$fill "body"/);
  });

  it('rejects a two-dot id', async () => {
    const { run } = await fixture({
      'src/components/Dialog.meta.ts': validMeta.replace("name: 'Dialog'", "name: 'Field.Button.Root'"),
    });
    expect(run).toThrow(/two-dot id "Field.Button.Root"/);
  });

  it('rejects empty whenToUse', async () => {
    const { run } = await fixture({
      'src/components/Dialog.meta.ts': validMeta.replace("whenToUse: ['Ask for a confirm.']", 'whenToUse: []'),
    });
    expect(run).toThrow(/whenToUse must have at least one bullet/);
  });

  it('rejects a duplicate id', async () => {
    const { run } = await fixture({
      'src/components/Dialog.meta.ts': validMeta,
      'src/components/Other.meta.ts': validMeta,
    });
    expect(run).toThrow(/Duplicate id "Dialog"/);
  });

  it('emits catalog.json and a name/description/props schema projection', async () => {
    const { root, run } = await fixture({
      'src/components/Dialog.meta.ts': validMeta,
      'src/catalog/patterns/confirm-dialog.pattern.ts': validPattern,
    });
    run();
    const catalog = JSON.parse(await readFile(join(root, 'catalog', 'catalog.json'), 'utf8')) as {
      components: unknown[];
      patterns: unknown[];
    };
    const schema = JSON.parse(await readFile(join(root, 'schema', 'components.json'), 'utf8')) as {
      components: Array<{ name: string; description: string; props: unknown[] }>;
    };
    expect(catalog.components).toHaveLength(1);
    expect(catalog.patterns).toHaveLength(1);
    expect(schema.components[0]).toEqual({
      name: 'Dialog',
      description: 'Centered modal.',
      props: [{ name: 'open', type: 'boolean', required: true, description: 'Open.' }],
    });
    expect(Object.keys(schema.components[0]!)).toEqual(['name', 'description', 'props']);
  });
});
