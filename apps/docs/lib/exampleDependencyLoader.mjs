import { exampleImports } from './remarkExamples.mjs';

/**
 * A webpack loader for MDX pages that changes nothing but makes each example file the page
 * imports a dependency of the page, so `remarkExamples` runs again when the example's code changes.
 */
export default function exampleDependencyLoader(text) {
  for (const file of exampleImports(this.resourcePath, text)) this.addDependency(file);
  return text;
}
