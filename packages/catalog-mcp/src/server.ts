import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { McpServer, ResourceTemplate } from '@modelcontextprotocol/sdk/server/mcp.js';
import {
  getComponent,
  getPattern,
  listComponents,
  listPatterns,
  type EntryKind,
  type Intent,
} from '@tounsoo/todae/catalog';
import { errorResult, jsonResult } from './result.js';
import * as schemas from './schemas.js';
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

const require = createRequire(import.meta.url);

export const CATALOG_JSON_URI = 'todae://catalog.json';

export function catalogJsonPath(): string {
  return require.resolve('@tounsoo/todae/catalog.json');
}

export function catalogJsonText(): string {
  return readFileSync(catalogJsonPath(), 'utf8');
}

export function createServer(): McpServer {
  const server = new McpServer({ name: 'todae-catalog', version: '0.0.0' });

  server.registerTool(
    'list_components',
    { description: 'List Todae catalog components.', inputSchema: schemas.listComponents },
    async (args) => jsonResult(list_components(schemas.read(schemas.listComponents, args))),
  );
  server.registerTool(
    'get_component',
    { description: 'Get one catalog component by name.', inputSchema: schemas.getComponent },
    async (args) => {
      const { id } = schemas.read(schemas.getComponent, args);
      const entry = get_component(id);
      return entry ? jsonResult(entry) : errorResult(`component not found: ${id}`);
    },
  );
  server.registerTool(
    'list_patterns',
    { description: 'List Todae catalog patterns.', inputSchema: schemas.listPatterns },
    async (args) => jsonResult(list_patterns(schemas.read(schemas.listPatterns, args))),
  );
  server.registerTool(
    'get_pattern',
    { description: 'Get one catalog pattern by id.', inputSchema: schemas.getPattern },
    async (args) => {
      const { id } = schemas.read(schemas.getPattern, args);
      const entry = get_pattern(id);
      return entry ? jsonResult(entry) : errorResult(`pattern not found: ${id}`);
    },
  );
  server.registerTool(
    'list_for_intent',
    { description: 'List catalog entries for an intent.', inputSchema: schemas.listForIntent },
    async (args) => {
      const parsed = schemas.read(schemas.listForIntent, args) as {
        intent: Intent;
        kinds?: EntryKind[];
        includePatterns?: boolean;
      };
      return jsonResult(list_for_intent(parsed.intent, { kinds: parsed.kinds, includePatterns: parsed.includePatterns }));
    },
  );
  server.registerTool(
    'search',
    { description: 'Lexical search over the Todae catalog.', inputSchema: schemas.search },
    async (args) => {
      const { query, ...opts } = schemas.read(schemas.search, args);
      return jsonResult(search_catalog(query, opts));
    },
  );
  server.registerTool(
    'list_intents',
    { description: 'List catalog intent tags.', inputSchema: schemas.listIntents },
    async () => jsonResult(list_intents()),
  );
  server.registerTool(
    'to_render_catalog',
    { description: 'Map catalog components to a render-catalog template.', inputSchema: schemas.toRenderCatalog },
    async (args) => {
      const mapped = to_render_catalog(schemas.read(schemas.toRenderCatalog, args).names);
      return mapped ? jsonResult(mapped) : errorResult('component not found');
    },
  );
  server.registerTool(
    'to_candidate_recipe',
    { description: 'Map a pattern to a candidate recipe template.', inputSchema: schemas.toCandidateRecipe },
    async (args) => {
      const { id } = schemas.read(schemas.toCandidateRecipe, args);
      const recipe = to_candidate_recipe(id);
      return recipe ? jsonResult(recipe) : errorResult(`pattern not found: ${id}`);
    },
  );
  server.registerTool(
    'to_criteria',
    { description: 'Map a component or pattern to prefer/avoid criteria.', inputSchema: schemas.toCriteria },
    async (args) => {
      const { id } = schemas.read(schemas.toCriteria, args);
      const criteria = to_criteria(id);
      return criteria ? jsonResult(criteria) : errorResult(`entry not found: ${id}`);
    },
  );

  server.registerResource(
    'catalog',
    CATALOG_JSON_URI,
    { mimeType: 'application/json', description: 'Raw @tounsoo/todae/catalog.json' },
    async (uri) => ({
      contents: [{ uri: uri.href, mimeType: 'application/json', text: catalogJsonText() }],
    }),
  );

  server.registerResource(
    'component',
    new ResourceTemplate('todae://components/{name}', {
      list: async () => ({
        resources: listComponents().map((entry) => ({
          uri: `todae://components/${entry.name}`,
          name: entry.name,
          mimeType: 'application/json',
        })),
      }),
    }),
    { mimeType: 'application/json', description: 'One catalog component' },
    async (uri, { name }) => {
      const entry = getComponent(String(name));
      if (!entry) throw new Error(`component not found: ${name}`);
      return { contents: [{ uri: uri.href, mimeType: 'application/json', text: JSON.stringify(entry) }] };
    },
  );

  server.registerResource(
    'pattern',
    new ResourceTemplate('todae://patterns/{id}', {
      list: async () => ({
        resources: listPatterns().map((entry) => ({
          uri: `todae://patterns/${entry.id}`,
          name: entry.id,
          mimeType: 'application/json',
        })),
      }),
    }),
    { mimeType: 'application/json', description: 'One catalog pattern' },
    async (uri, { id }) => {
      const entry = getPattern(String(id));
      if (!entry) throw new Error(`pattern not found: ${id}`);
      return { contents: [{ uri: uri.href, mimeType: 'application/json', text: JSON.stringify(entry) }] };
    },
  );

  return server;
}
