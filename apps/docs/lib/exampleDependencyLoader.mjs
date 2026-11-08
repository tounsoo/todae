import { readFileSync } from 'node:fs';
import { exampleImports, exampleStylesheets } from './remarkExamples.mjs';

/**
 * A webpack loader for MDX pages that changes nothing but makes each example file the page
 * imports, and each stylesheet that file imports from its folder, a dependency of the page, so
 * `remarkExamples` runs again when the example's code changes.
 */
export default function exampleDependencyLoader(text) {
  for (const file of exampleImports(this.resourcePath, text)) {
    this.addDependency(file);
    for (const sheet of exampleStylesheets(file, readFileSync(file, 'utf8'))) this.addDependency(sheet);
  }
  return text;
}
