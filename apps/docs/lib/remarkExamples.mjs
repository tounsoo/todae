import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve, sep } from 'node:path';
import { exampleSource } from './exampleSource.mjs';

// Plain JavaScript: next.config.mjs loads it before TypeScript is compiled.

// The docs app's folder, as the other page tools take it, since the MCP route runs bundled.
export const EXAMPLES_DIR = resolve(process.cwd(), 'examples') + sep;

/** The locale of a page file under `app/`: `(en)` is English, any other first folder names its locale. */
export function pageLocale(path) {
  const parts = path.split(sep);
  const folder = parts[parts.lastIndexOf('app') + 1];
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

/** The example files a page's import lines name, for the loader that rebuilds the page when one changes. */
export function exampleImports(pagePath, text) {
  return [...text.matchAll(/^import\s+\w+\s+from\s+'([^']+)';/gm)]
    .map((match) => resolve(dirname(pagePath), match[1].endsWith('.tsx') ? match[1] : `${match[1]}.tsx`))
    .filter((file) => file.startsWith(EXAMPLES_DIR) && existsSync(file));
}

/**
 * Renders `<Example of={Name} />` as the code of the example `Name` followed by the example itself.
 * `Name` is a page's default import from a file in `apps/docs/examples`. The element becomes a code
 * block of that file's code and `<Example><Name locale="…" /></Example>`, with the page's locale.
 * Pages also go through `exampleDependencyLoader.mjs`, so a change to the file rebuilds the page.
 */
export default function remarkExamples() {
  return (tree, file) => {
    if (!file.path) return;
    const imports = defaultImports(tree);
    const locale = pageLocale(file.path);
    const visit = (parent) => {
      parent.children = (parent.children ?? []).flatMap((node) => {
        const of =
          node.type === 'mdxJsxFlowElement' && node.name === 'Example'
            ? node.attributes.find((attribute) => attribute.type === 'mdxJsxAttribute' && attribute.name === 'of')
            : undefined;
        if (!of) {
          visit(node);
          return [node];
        }
        const name = typeof of.value === 'object' ? of.value?.value.trim() : undefined;
        if (!name || !/^[A-Z]\w*$/.test(name)) throw new Error('<Example of={…}> takes the name of an imported example, such as of={FieldDatePicked}');
        if (node.children.length > 0) throw new Error(`<Example of={${name}}> renders its example itself, so it takes no children`);
        const code = exampleSource(readFileSync(exampleFile(file.path, imports, name), 'utf8'));
        const example = {
          ...node,
          attributes: node.attributes.filter((attribute) => attribute !== of),
          children: [{ type: 'mdxJsxFlowElement', name, attributes: [{ type: 'mdxJsxAttribute', name: 'locale', value: locale }], children: [] }],
        };
        return [{ type: 'code', lang: 'tsx', meta: null, value: code }, example];
      });
    };
    visit(tree);
  };
}
