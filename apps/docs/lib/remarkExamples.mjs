import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve, sep } from 'node:path';
import { exampleSource } from './exampleSource.mjs';

// Plain JavaScript: next.config.mjs loads it before TypeScript is compiled.

// The docs app's folder, as the other page tools take it, since the MCP route runs bundled.
export const EXAMPLES_DIR = resolve(process.cwd(), 'examples') + sep;
const APP_DIR = resolve(process.cwd(), 'app') + sep;

/** The locale of a page file under `app/`: `(en)` is English, any other first folder names its locale. */
export function pageLocale(path) {
  const file = resolve(path);
  const folder = file.startsWith(APP_DIR) ? file.slice(APP_DIR.length).split(sep)[0] : '';
  if (!folder || folder === 'page.mdx') throw new Error(`${path} is not a page under apps/docs/app, so it has no locale`);
  return folder === '(en)' ? 'en' : folder;
}

/** Each default import in the page's ESM, by local name, as the path it imports. */
export function defaultImports(tree) {
  const found = new Map();
  for (const node of tree.children) {
    if (node.type !== 'mdxjsEsm') continue;
    for (const statement of node.data?.estree?.body ?? []) {
      if (statement.type !== 'ImportDeclaration') continue;
      for (const specifier of statement.specifiers) {
        if (specifier.type === 'ImportDefaultSpecifier') found.set(specifier.local.name, statement.source.value);
      }
    }
  }
  return found;
}

/** The example file that `<Example of={name}>` names, through the page's default import of `name`. */
export function exampleFile(pagePath, imports, name) {
  const from = imports.get(name);
  if (!from) throw new Error(`<Example of={${name}}> needs \`import ${name} from '…/examples/…'\` on the page`);
  const file = resolve(dirname(pagePath), from.endsWith('.tsx') ? from : `${from}.tsx`);
  if (!file.startsWith(EXAMPLES_DIR)) throw new Error(`<Example of={${name}}> imports ${from}, which is not in apps/docs/examples`);
  if (!existsSync(file)) throw new Error(`<Example of={${name}}> imports ${from}, which has no .tsx file`);
  return file;
}

/**
 * The stylesheets an example file imports from its own folder, as `import styles from './Name.module.css';`,
 * which a page shows after the example's code. For a recipe or component page whose CSS is part of what
 * a product copies. Any other CSS import is refused, since the page could not show it.
 */
export function exampleStylesheets(file, text) {
  return [...text.matchAll(/^[ \t]*import\b[^;]*?['"]([^'"]+\.(?:css|scss|sass|less)(?:\?[^'"]*)?)['"][^\n]*$/gm)].map((match) => {
    const own = /^import\s+\w+\s+from\s+'\.\/([\w-]+\.module\.css)';$/.exec(match[0]);
    if (!own) throw new Error(`${file} imports ${match[1]}; an example imports CSS only as \`import styles from './Name.module.css';\` from its own folder`);
    const path = resolve(dirname(file), own[1]);
    if (!existsSync(path)) throw new Error(`${file} imports ./${own[1]}, but no such file exists in its folder`);
    return path;
  });
}

/**
 * The code blocks a page shows for an example file: its code, then each stylesheet it imports from its
 * folder that the page has not shown yet. `shown` holds the stylesheets already shown on the page.
 */
export function exampleBlocks(file, shown = new Set()) {
  const text = readFileSync(file, 'utf8');
  const sheets = exampleStylesheets(file, text).filter((path) => !shown.has(path));
  for (const path of sheets) shown.add(path);
  return [
    { lang: 'tsx', value: exampleSource(text) },
    ...sheets.map((path) => ({ lang: 'css', value: readFileSync(path, 'utf8').trimEnd() })),
  ];
}

/** The example files a page's import lines name, for the loader that rebuilds the page when one changes. */
export function exampleImports(pagePath, text) {
  return [...text.matchAll(/^import\s[^'"]*?\sfrom\s*(['"])([^'"]+)\1/gm)]
    .map((match) => resolve(dirname(pagePath), match[2].endsWith('.tsx') ? match[2] : `${match[2]}.tsx`))
    .filter((file) => file.startsWith(EXAMPLES_DIR) && existsSync(file));
}

/**
 * Renders `<Example of={Name} />` as the code of the example `Name`, and any stylesheet it imports
 * from its folder that the page has not shown yet, followed by the example itself,
 * and refuses an `<Example>` without `of`, whose demo would show with no code.
 * `Name` is a page's default import from a file in `apps/docs/examples`. The element becomes a code
 * block of that file's code and `<Example><Name locale="…" /></Example>`, with the page's locale.
 * Pages also go through `exampleDependencyLoader.mjs`, so a change to the file rebuilds the page.
 */
export default function remarkExamples() {
  return (tree, file) => {
    if (!file.path) return;
    const imports = defaultImports(tree);
    const shown = new Set();
    const visit = (parent) => {
      parent.children = (parent.children ?? []).flatMap((node) => {
        const isExample = (node.type === 'mdxJsxFlowElement' || node.type === 'mdxJsxTextElement') && node.name === 'Example';
        if (!isExample) {
          visit(node);
          return [node];
        }
        const of = node.attributes.find((attribute) => attribute.type === 'mdxJsxAttribute' && attribute.name === 'of');
        // Without `of` the demo would show with no code, on the page and in the docs MCP.
        if (!of) throw new Error('<Example> needs of={Name}, an example file in apps/docs/examples that the page imports, so its code shows with it');
        const name = typeof of.value === 'object' ? of.value?.value.trim() : undefined;
        if (!name || !/^[A-Z]\w*$/.test(name)) throw new Error('<Example of={…}> takes the name of an imported example, such as of={FieldDatePicked}');
        // Tools that read the MDX put the code above the element, which only works at the top level.
        if (node.type !== 'mdxJsxFlowElement' || parent.type !== 'root') throw new Error(`<Example of={${name}}> goes on a line of its own at the top level of the page, outside other elements and lists`);
        if (node.children.length > 0) throw new Error(`<Example of={${name}}> renders its example itself, so it takes no children`);
        const locale = pageLocale(file.path);
        const blocks = exampleBlocks(exampleFile(file.path, imports, name), shown);
        const example = {
          ...node,
          attributes: node.attributes.filter((attribute) => attribute !== of),
          children: [{ type: 'mdxJsxFlowElement', name, attributes: [{ type: 'mdxJsxAttribute', name: 'locale', value: locale }], children: [] }],
        };
        return [...blocks.map(({ lang, value }) => ({ type: 'code', lang, meta: null, value })), example];
      });
    };
    visit(tree);
  };
}
