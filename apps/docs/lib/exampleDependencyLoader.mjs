import { readFileSync } from 'node:fs';
import { exampleImports, exampleLocalModules, exampleStylesheets } from './remarkExamples.mjs';

/**
 * A webpack loader for MDX pages that changes nothing but makes each example file the page
 * imports, and each stylesheet or sibling module that file imports from its folder, a dependency of the page, so
 * `remarkExamples` runs again when the example's code changes.
 */
export default function exampleDependencyLoader(text) {
  for (const file of exampleImports(this.resourcePath, text)) {
    this.addDependency(file);
    const source = readFileSync(file, 'utf8');
    for (const sheet of exampleStylesheets(file, source)) this.addDependency(sheet);
    for (const module of exampleLocalModules(file, source)) this.addDependency(module);
  }
  return text;
}
