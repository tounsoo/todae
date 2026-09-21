import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import {
  catalog,
  getComponent,
  getPattern,
  INTENTS,
  listComponents,
  listForIntent,
  listPatterns,
  search,
  toCandidateRecipe,
  toCriteria,
  toRenderCatalog,
} from '@tounsoo/todae/catalog';
import { describe, expect, it } from 'vitest';
import { CATALOG_JSON_URI, catalogJsonPath, catalogJsonText, createServer } from './server.js';
import {
  get_component,
  get_pattern,
  list_components,
  list_for_intent,
  list_intents,
  list_patterns,
  search_catalog,
  to_candidate_recipe,
  to_criteria,
  to_render_catalog,
} from './tools.js';

const workspaceCatalog = join(import.meta.dirname, '../../design-system/catalog/catalog.json');

async function connect() {
  const server = createServer();
  const client = new Client({ name: 'parity', version: '0.0.0' });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  await Promise.all([client.connect(clientTransport), server.connect(serverTransport)]);
  return { client, server };
}

describe('MCP catalog parity', () => {
  it('resource text === readFileSync catalog.json', async () => {
    const file = readFileSync(catalogJsonPath(), 'utf8');
    expect(file).toBe(readFileSync(workspaceCatalog, 'utf8'));
    expect(catalogJsonText()).toBe(file);
    const { client, server } = await connect();
    const resource = await client.readResource({ uri: CATALOG_JSON_URI });
    const content = resource.contents[0];
    expect(content && 'text' in content ? content.text : undefined).toBe(file);
    await client.close();
    await server.close();
  });

  it('bundled catalog === file', async () => {
    const file = JSON.parse(readFileSync(catalogJsonPath(), 'utf8'));
    expect(catalog).toEqual(file);
    const catalogJs = join(dirname(catalogJsonPath()), '../dist/catalog.js');
    const bundled = await import(pathToFileURL(catalogJs).href);
    expect(bundled.catalog).toEqual(file);
  });

  it('get/list equals package helpers', () => {
    expect(list_components()).toEqual(listComponents());
    expect(list_components({ kind: 'hook', intent: 'search-select' })).toEqual(
      listComponents({ kind: 'hook', intent: 'search-select' }),
    );
    expect(get_component('Button.Root')).toEqual(getComponent('Button.Root'));
    expect(list_patterns()).toEqual(listPatterns());
    expect(list_patterns({ intent: 'text-entry' })).toEqual(listPatterns({ intent: 'text-entry' }));
    expect(get_pattern('labelled-field')).toEqual(getPattern('labelled-field'));
    expect(list_for_intent('choose-one')).toEqual(listForIntent('choose-one'));
    expect(list_for_intent('choose-one', { kinds: ['component'], includePatterns: false })).toEqual(
      listForIntent('choose-one', { kinds: ['component'], includePatterns: false }),
    );
  });

  it('wrapper outputs equal direct helper calls', () => {
    expect(search_catalog('modal')).toEqual(search('modal'));
    expect(search_catalog('field', { limit: 3, kinds: ['component'] })).toEqual(
      search('field', { limit: 3, kinds: ['component'] }),
    );
    expect(list_intents()).toEqual(INTENTS);
    expect(to_render_catalog()).toEqual(toRenderCatalog(catalog.components));
    expect(to_render_catalog(['Button.Root'])).toEqual(
      toRenderCatalog([getComponent('Button.Root')!]),
    );
    expect(to_candidate_recipe('labelled-field')).toEqual(toCandidateRecipe(getPattern('labelled-field')!));
    expect(to_criteria('Button.Root')).toEqual(toCriteria(getComponent('Button.Root')!));
    expect(to_criteria('labelled-field')).toEqual(toCriteria(getPattern('labelled-field')!));
  });

  it('server source has no Jev, $state, or graft', () => {
    const files = readdirSync(import.meta.dirname).filter(
      (name) => name.endsWith('.ts') && !name.endsWith('.test.ts'),
    );
    expect(files.length).toBeGreaterThan(0);
    for (const name of files) {
      const source = readFileSync(join(import.meta.dirname, name), 'utf8');
      expect(source, name).not.toMatch(/Jev|toJev|\$state|graft/i);
    }
  });
});
