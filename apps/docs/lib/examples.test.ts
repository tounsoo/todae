import { readdirSync, readFileSync } from 'node:fs';
import { join, matchesGlob, relative } from 'node:path';
import type { Root } from 'mdast';
import { describe, expect, it } from 'vitest';
import { exampleOf, withExampleCode } from './exampleCode';
import exampleDependencyLoader from './exampleDependencyLoader.mjs';
import { exampleSource } from './exampleSource.mjs';
import { parseMdx } from './mdxAst';
import remarkExamples, { defaultImports, exampleFile, exampleStylesheets, pageLocale } from './remarkExamples.mjs';
import { remarkPlugins } from './remarkPlugins.mjs';

const APP = join(process.cwd(), 'app');
const EXAMPLES = join(process.cwd(), 'examples');
const EN_PAGE = join(APP, '(en)', 'text', 'page.mdx');
const KO_PAGE = join(APP, 'ko', 'text', 'page.mdx');
const TONES = join(EXAMPLES, 'text', 'TextTones.tsx');
const SIZES_CSS = join(EXAMPLES, 'avatar', 'AvatarSizes.module.css');

function render(mdx: string, path = EN_PAGE): Root {
  const tree = parseMdx(mdx);
  remarkExamples()(tree, { path });
  return tree;
}

function pages(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return pages(path);
    return entry.name === 'page.mdx' ? [path] : [];
  });
}

describe('docs examples', () => {
  it('shows an example file’s code above the example, which gets the page’s locale', () => {
    const tree = render("import TextTones from '../../../examples/text/TextTones';\n\n<Example of={TextTones} block />\n");
    const [, code, example] = tree.children;
    expect(code).toEqual({ type: 'code', lang: 'tsx', meta: null, value: exampleSource(readFileSync(TONES, 'utf8')) });
    expect(example).toMatchObject({
      type: 'mdxJsxFlowElement',
      name: 'Example',
      attributes: [{ name: 'block' }],
      children: [{ type: 'mdxJsxFlowElement', name: 'TextTones', attributes: [{ type: 'mdxJsxAttribute', name: 'locale', value: 'en' }] }],
    });
    const korean = render("import TextTones from '../../../examples/text/TextTones';\n\n<Example of={TextTones} />\n", KO_PAGE);
    expect(korean.children[2]).toMatchObject({ children: [{ attributes: [{ value: 'ko' }] }] });
  });

  it('refuses an Example without of, since its demo would show no code', () => {
    for (const mdx of ['<Example>\n  <Demo />\n</Example>\n', '<Example block>\n  <Demo />\n</Example>\n', '<Example />\n', '- <Example>\n    <Demo />\n  </Example>\n', 'See <Example><Demo /></Example> here.\n']) {
      expect(() => render(mdx), mdx).toThrow(/<Example> needs of=\{Name\}/);
    }
  });

  it('shows the code without the client directive', () => {
    expect(exampleSource("'use client';\n\nimport { useId } from 'react';\n\nexport default function A() {}\n")).toBe(
      "import { useId } from 'react';\n\nexport default function A() {}",
    );
  });

  it('refuses an example it cannot find or that has children', () => {
    expect(() => render('<Example of={TextTones} />\n')).toThrow(/needs `import TextTones/);
    expect(() => render("import Demo from '../../../components/demos/FieldDemo';\n\n<Example of={Demo} />\n")).toThrow(/not in apps\/docs\/examples/);
    expect(() => render("import Gone from '../../../examples/text/Gone';\n\n<Example of={Gone} />\n")).toThrow(/has no \.tsx file/);
    expect(() => render("import TextTones from '../../../examples/text/TextTones';\n\n<Example of={TextTones}>\n  <p>x</p>\n</Example>\n")).toThrow(/takes no children/);
    expect(() => render('<Example of={tones[0]} />\n')).toThrow(/takes the name of an imported example/);
  });

  it('refuses an example inside other elements, lists or a line of text', () => {
    const imported = "import TextTones from '../../../examples/text/TextTones';\n\n";
    for (const body of ['- <Example of={TextTones} />\n', '> <Example of={TextTones} />\n', '<Columns>\n  <Example of={TextTones} />\n</Columns>\n', 'See <Example of={TextTones} /> here.\n']) {
      expect(() => render(imported + body), body).toThrow(/on a line of its own at the top level/);
    }
  });

  it('names the locale of a page by its folder', () => {
    expect(pageLocale(EN_PAGE)).toBe('en');
    expect(pageLocale(KO_PAGE)).toBe('ko');
    expect(pageLocale(join(APP, '(en)', 'recipes', 'app', 'page.mdx'))).toBe('en');
    expect(() => pageLocale(join(process.cwd(), 'content', 'page.mdx'))).toThrow(/not a page under apps\/docs\/app/);
  });

  it('rebuilds a page when an example file it imports changes', () => {
    const added: string[] = [];
    const text = "import TextTones from '../../../examples/text/TextTones';\nimport { Text } from '@tounsoo/todae/text';\n";
    expect(exampleDependencyLoader.call({ resourcePath: EN_PAGE, addDependency: (file: string) => added.push(file) }, text)).toBe(text);
    expect(added).toEqual([TONES]);
    for (const line of [
      'import TextTones from "../../../examples/text/TextTones";',
      "import TextTones from '../../../examples/text/TextTones'",
      "import TextTones, { x } from '../../../examples/text/TextTones';",
    ]) {
      const found: string[] = [];
      exampleDependencyLoader.call({ resourcePath: EN_PAGE, addDependency: (file: string) => found.push(file) }, line);
      expect(found, line).toEqual([TONES]);
    }
  });

  it('shows a stylesheet the example imports from its folder after its code', () => {
    const tree = render("import AvatarSizes from '../../../examples/avatar/AvatarSizes';\n\n<Example of={AvatarSizes} />\n", join(APP, '(en)', 'avatar', 'page.mdx'));
    expect(tree.children.slice(1).map((node) => [node.type, 'lang' in node ? node.lang : undefined])).toEqual([
      ['code', 'tsx'],
      ['code', 'css'],
      ['mdxJsxFlowElement', undefined],
    ]);
    expect(tree.children[2]).toMatchObject({ value: readFileSync(SIZES_CSS, 'utf8').trimEnd() });
    const mdx = "import AvatarSizes from '../../../examples/avatar/AvatarSizes';\n\n<Example of={AvatarSizes} />\n";
    expect(withExampleCode(join(APP, '(en)', 'avatar', 'page.mdx'), mdx)).toContain(`\`\`\`css\n${readFileSync(SIZES_CSS, 'utf8').trimEnd()}\n\`\`\`\n\n<Example of={AvatarSizes} />`);
  });

  it('refuses a stylesheet import that is not in the example’s folder', () => {
    expect(() => exampleStylesheets(join(EXAMPLES, 'avatar', 'Gone.tsx'), "import styles from './Gone.module.css';\n")).toThrow(/not in its folder/);
    expect(exampleStylesheets(join(EXAMPLES, 'avatar', 'X.tsx'), "import styles from '../avatar/AvatarSizes.module.css';\n")).toEqual([]);
  });

  it('rebuilds a page when a stylesheet its example imports changes', () => {
    const added: string[] = [];
    const page = join(APP, '(en)', 'avatar', 'page.mdx');
    exampleDependencyLoader.call({ resourcePath: page, addDependency: (file: string) => added.push(file) }, "import AvatarSizes from '../../../examples/avatar/AvatarSizes';\n");
    expect(added).toEqual([join(EXAMPLES, 'avatar', 'AvatarSizes.tsx'), SIZES_CSS]);
  });

  it('gives tools that read the MDX the code a reader sees', () => {
    const mdx = "import TextTones from '../../../examples/text/TextTones';\n\n# Text\n\n<Example of={TextTones} />\n";
    expect(withExampleCode(EN_PAGE, mdx)).toBe(
      `import TextTones from '../../../examples/text/TextTones';\n\n# Text\n\n\`\`\`tsx\n${exampleSource(readFileSync(TONES, 'utf8'))}\n\`\`\`\n\n<Example of={TextTones} />\n`,
    );
  });

  it('shows every example file on an English page and on each translation of it', () => {
    const shown = new Map<string, Set<string>>();
    for (const page of pages(APP)) {
      const imports = [...readFileSync(page, 'utf8').matchAll(/^import (\w+) from '([^']*\/examples\/[^']*)';$/gm)];
      for (const [, , from] of imports) {
        const file = relative(EXAMPLES, join(page, '..', `${from}.tsx`));
        shown.set(file, (shown.get(file) ?? new Set()).add(relative(APP, page).split('/')[0]!));
      }
    }
    const files = readdirSync(EXAMPLES, { recursive: true, encoding: 'utf8' }).filter((file) => file.endsWith('.tsx'));
    expect(files.length).toBeGreaterThan(100);
    expect(files.filter((file) => !shown.get(file)?.has('(en)') || !shown.get(file)?.has('ko'))).toEqual([]);
  });

  it('turns every example on every page into its code and demo, with the plugins in the build’s order', () => {
    let shown = 0;
    for (const page of pages(APP)) {
      const tree = parseMdx(readFileSync(page, 'utf8'));
      for (const plugin of remarkPlugins) (plugin as () => (tree: Root, file: { path: string }) => void)()(tree, { path: page });
      const left: string[] = [];
      const visit = (node: Root | Root['children'][number]) => {
        if ('name' in node && node.name === 'Example' && node.attributes.some((attribute) => 'name' in attribute && attribute.name === 'of')) left.push(relative(APP, page));
        if (node.type === 'code' && node.lang === 'tsx') shown++;
        if ('children' in node) for (const child of node.children) visit(child as Root['children'][number]);
      };
      visit(tree);
      expect(left).toEqual([]);
    }
    expect(shown).toBeGreaterThan(200);
  });

  it('ships every example file and stylesheet an English page shows with the MCP route', async () => {
    const { default: config } = await import('../next.config.mjs');
    const globs = (config.outputFileTracingIncludes?.['/api/[transport]'] ?? []).map((glob) => join(process.cwd(), glob));
    const read = pages(join(APP, '(en)')).flatMap((page) => {
      const tree = parseMdx(readFileSync(page, 'utf8'));
      const imports = defaultImports(tree);
      return tree.children.flatMap((node) => {
        const name = exampleOf(node);
        if (!name) return [];
        const file = exampleFile(page, imports, name);
        return [file, ...exampleStylesheets(file, readFileSync(file, 'utf8'))];
      });
    });
    expect(read.some((file) => file.endsWith('.css'))).toBe(true);
    expect(read.filter((file) => !globs.some((glob) => matchesGlob(file, glob))).map((file) => relative(EXAMPLES, file))).toEqual([]);
  });

  it('uses no class name that only the docs stylesheet defines', () => {
    const docsCss = readFileSync(join(APP, 'globals.css'), 'utf8');
    const files = readdirSync(EXAMPLES, { recursive: true, encoding: 'utf8' }).filter((file) => file.endsWith('.tsx'));
    const docsOnly = files.flatMap((file) =>
      [...readFileSync(join(EXAMPLES, file), 'utf8').matchAll(/className=["']([^"']+)["']/g)]
        .flatMap((match) => match[1]!.split(/\s+/))
        .filter((name) => new RegExp(`\\.${name}\\b`).test(docsCss))
        .map((name) => `${file}: ${name}`),
    );
    expect(docsOnly).toEqual([]);
  });

  it('imports only what a product has: the package, React, icon libraries and a stylesheet of its own', () => {
    const allowed = /^(@tounsoo\/todae(\/[a-z-]+)?|react|lucide-react|@phosphor-icons\/react|@tabler\/icons-react|\.\/[\w-]+\.module\.css)$/;
    const files = readdirSync(EXAMPLES, { recursive: true, encoding: 'utf8' }).filter((file) => file.endsWith('.tsx'));
    const outside = files.flatMap((file) =>
      [...readFileSync(join(EXAMPLES, file), 'utf8').matchAll(/from '([^']+)'/g)]
        .map((match) => match[1]!)
        .filter((from) => !allowed.test(from))
        .map((from) => `${file}: ${from}`),
    );
    expect(outside).toEqual([]);
  });
});
