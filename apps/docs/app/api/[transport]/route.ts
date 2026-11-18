import type { McpServer, McpServerOptions } from '@modelcontextprotocol/sdk/server/mcp.js';
import { createMcpHandler } from 'mcp-handler';
import { z } from 'zod';
import { BUILD_TIMEOUT_MS, MAX_BYTES, MAX_FILES, baseContrast, buildTokenFiles, resumeBuild } from '../../../lib/docs-mcp/build';
import { VERSION_RE, getChanges } from '../../../lib/docs-mcp/changes';
import { GUIDE_TOPICS, getGuide } from '../../../lib/docs-mcp/guides';
import { getRecipe, listRecipes } from '../../../lib/docs-mcp/recipes';
import { presentScaffold, scaffoldDesignSystem } from '../../../lib/docs-mcp/scaffold';
import {
  BUILD_TOOL,
  BUILD_TOOL_INPUT_ELEMENTS,
  MAX_REQUEST_BYTES,
  MAX_REQUEST_DEPTH,
  MAX_REQUEST_ELEMENTS,
  MAX_REQUEST_KEY_LENGTH,
  MAX_REQUEST_TOOL_CALLS,
  TOOL_INPUT_ELEMENTS,
  countElements,
  hasMoreKeysThan,
  inspectBody,
  readBody,
  toolCalls,
} from '../../../lib/docs-mcp/limits';
import { LAYERS, getToken, listTokens } from '../../../lib/docs-mcp/tokens';
import { deliver } from '../../../lib/docs-mcp/budget';
import { readExample } from '../../../lib/docs-mcp/read';
import { presentSearch } from '../../../lib/docs-mcp/search';
import { getComponent, getDocsPage, listComponents, whenToUse } from '../../../lib/docs-mcp/tools';
import { RELEASE } from '../../../lib/version';

// Longer than build_tokens' own time limit, so a stopped build can still report it.
export const maxDuration = 30;

const name = z.string().trim().min(1).max(80);
/** The longest file name build_tokens takes. */
const MAX_FILE_NAME = 200;
const pageQuery = z.string().trim().min(1).max(300);
const locale = z.enum(['en', 'ko']).optional();
const sectionName = z.string().trim().min(1).max(160).optional();
const includeCode = z.boolean().optional();
const offset = z.number().int().min(0).optional();
const pageRead = { section: sectionName, locale, includeCode, offset };
const tokenPath = z.string().trim().min(1).max(120);
const contextName = z.string().regex(/^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/).max(40);
const oklch = z.tuple([z.number().min(0).max(1), z.number().min(0).max(0.5), z.number().min(0).max(360)]);
const colorMap = z.record(tokenPath, oklch);
const version = z.string().trim().regex(VERSION_RE, 'Use a version such as 0.2.0');

function ok(data: unknown) {
  // One budget for every tool. Size stays on nav, so a field named tokens (the catalog) is left alone.
  // A result that already names its next calls keeps them.
  if (data && typeof data === 'object' && !('nav' in data)) {
    Object.assign(data, {
      nav: {
        what: 'result',
        tokens: 0,
        chars: 0,
        next: [{ tool: 'search_docs', arguments: { query: 'todae' }, why: 'Search when the next call is not named on this result.' }],
      },
    });
  }
  return { content: [{ type: 'text' as const, text: deliver(data) }] };
}

function fail(error: unknown) {
  const message = error instanceof Error ? error.message : 'Tool failed';
  return { isError: true as const, content: [{ type: 'text' as const, text: message }] };
}

const buildTokensArguments = {
  // zod 3 checks every key of a record, so a call with far too many files is refused before that check.
  files: z.preprocess((value, context) => {
    if (!hasMoreKeysThan(value, MAX_FILES)) return value;
    context.addIssue({ code: z.ZodIssueCode.custom, message: `At most ${MAX_FILES} files` });
    return z.NEVER;
  }, z.record(z.string().max(MAX_FILE_NAME), z.unknown())),
  resolver: z.string().max(200).optional(),
  scope: z.string().max(200).optional(),
  offset: z.number().int().min(0).optional(),
  field: z.enum(['css', 'overrideTypes']).optional(),
};

const serverInfo = { name: 'todae-docs', version: RELEASE.version };

function registerTools(server: McpServer) {
  server.tool(
    'search_docs',
    'Start here when you do not know a slug. Ranked hits across pages, sections, components, props, hooks, recipes, examples and tokens, in English and Korean. Each hit has title, kind, ref (a slug or slug#anchor), a short snippet and tokens, the chars/4 cost of fetching it. Then get_docs_page with that ref, get_component for a prop or component, get_token for a token path, or get_example for a file. locale limits pages to en or ko. limit defaults to 8.',
    { query: pageQuery, locale, limit: z.number().int().min(1).max(20).optional() },
    async ({ query, locale: lang, limit }) => {
      try {
        return ok(presentSearch(query, { ...(lang ? { locale: lang } : {}), ...(limit ? { limit } : {}) }));
      } catch (error) {
        return fail(error);
      }
    },
  );
  server.tool(
    'list_components',
    'List Todae components from the published docs schema. For a task in ordinary words, call search_docs first. A long list comes back with a cursor. Pass cursor.offset for the next page. Walking the pages returns the whole catalog.',
    { offset },
    async ({ offset: from }) => {
      try {
        return ok(listComponents({ offset: from ?? 0 }));
      } catch (error) {
        return fail(error);
      }
    },
  );
  server.tool(
    'get_component',
    'Props and parts for one component, part or hook. Cheap: usually a few hundred tokens. Call this for "what props does X take", not get_docs_page. An unknown name returns close search hits. For how the parts fit together, get_docs_page then get_example.',
    { name },
    async ({ name: componentName }) => {
      try {
        return ok(getComponent(componentName));
      } catch (error) {
        return fail(error);
      }
    },
  );
  server.tool(
    'when_to_use',
    'The When to use and When not to use copy as fields. Does not infer missing copy. locale "ko" reads the Korean page (언제 쓰나요). For the rest of the page, get_docs_page.',
    { name, locale },
    async ({ name: componentName, locale: lang }) => {
      try {
        return ok(whenToUse(componentName, lang ? { locale: lang } : {}));
      } catch (error) {
        return fail(error);
      }
    },
  );
  server.tool(
    'get_docs_page',
    'Read one docs page or one section. Pass a slug, a slug#anchor, a docs URL, or a component name such as useTooltip. section is an anchor or a heading. locale "ko", or a ko/ prefix, reads the Korean page. Names are matched ignoring case, spaces and dashes. A page over 4000 tokens (chars/4) returns an outline, the intro, and a token count per section instead of the whole page. Each example is a stub (file, what it shows, lines, tokens); call get_example for the source. includeCode inlines that source when you really want it, still under the 40000 character response budget. An unknown name returns search hits, not a bare error.',
    { name: pageQuery, ...pageRead },
    async ({ name: query, section, locale: lang, includeCode: code, offset: from }) => {
      try {
        return ok(getDocsPage(query, { ...(section ? { section } : {}), ...(lang ? { locale: lang } : {}), ...(code ? { includeCode: code } : {}), ...(from ? { offset: from } : {}) }));
      } catch (error) {
        return fail(error);
      }
    },
  );
  server.tool(
    'get_example',
    'The source of one example file a page stub names, with line numbers. page is the slug (or slug#anchor); file is the file name, such as SchedulerExample.tsx. startLine and endLine are 1-based and inclusive. A long file returns a window and cursor.startLine for the next call. Prefer this over includeCode.',
    {
      page: pageQuery,
      file: z.string().trim().min(1).max(200),
      startLine: z.number().int().min(1).optional(),
      endLine: z.number().int().min(1).optional(),
      locale,
    },
    async ({ page, file, startLine, endLine, locale: lang }) => {
      try {
        return ok(readExample(page, file, { ...(lang ? { locale: lang } : {}), ...(startLine ? { startLine } : {}), ...(endLine ? { endLine } : {}) }));
      } catch (error) {
        return fail(error);
      }
    },
  );
  server.tool(
    'list_recipes',
    "List Todae's recipes: copyable code on the docs site that puts Todae's exports together for a product flow, such as a data table, a wizard or a chat reply's reasoning. Recipes are not package exports. Each row has the recipe's summary and the exports its code uses.",
    async () => {
      try {
        return ok(listRecipes());
      } catch (error) {
        return fail(error);
      }
    },
  );
  server.tool(
    'get_recipe',
    'One recipe by name (data-table) or title (Data table). Same shape as get_docs_page: section, locale, example stubs, and an outline when the page is over 4000 tokens. includeCode inlines the example. Unknown names return search hits. Call list_recipes only to see every recipe.',
    { name, ...pageRead },
    async ({ name: recipe, section, locale: lang, includeCode: code, offset: from }) => {
      try {
        return ok(getRecipe(recipe, { ...(section ? { section } : {}), ...(lang ? { locale: lang } : {}), ...(code ? { includeCode: code } : {}), ...(from ? { offset: from } : {}) }));
      } catch (error) {
        return fail(error);
      }
    },
  );
  server.tool(
    'list_tokens',
    "List Todae's tokens from its token catalog: path, type, layer, context, the set or modifier that declares it (with the context for a button variant), CSS custom property, CSS value and description. Filter by a path prefix such as \"color.accent\" or by layer. limit is the most rows in one page (default 200, at most 500). A long list comes back with cursor.offset. Pass that offset to list_tokens for the next page. Walking the pages returns every matching row.",
    {
      prefix: tokenPath.optional(),
      layer: z.enum(LAYERS).optional(),
      limit: z.number().int().min(1).max(500).optional(),
      offset: z.number().int().min(0).optional(),
    },
    async (options) => {
      try {
        return ok(listTokens(options));
      } catch (error) {
        return fail(error);
      }
    },
  );
  server.tool(
    'get_token',
    'Get one token: what it is for, the set or modifier that declares it (where a company overrides it) with the context for a button variant, its value in each context (such as light and dark) and the tokens whose values read it.',
    { path: tokenPath },
    async ({ path }) => {
      try {
        return ok(getToken(path));
      } catch (error) {
        return fail(error);
      }
    },
  );
  server.tool(
    'get_contrast_pairs',
    "Todae's APCA contrast pairs, each with its minimum Lc and the Lc Todae's base theme measures in every appearance. A pair with `over` is measured over each surface its background can sit on, since that background may be translucent. A company token package inherits these pairs and may change a pair's minimum or add pairs.",
    async () => {
      try {
        return ok(await baseContrast());
      } catch (error) {
        return fail(error);
      }
    },
  );
  server.tool(
    'build_tokens',
    `Run todae-tokens build on a company token package layered on Todae's, with the same checks. \`files\` maps each .json file's path inside the token folder to its JSON, at most ${MAX_FILES} files and ${MAX_BYTES / 1024} KB. \`resolver\` is the resolver's path among them (default "resolver.json"); scaffold_design_system's tokenFiles fit as they are. \`scope\`, a CSS selector such as ".brand-acme", builds a theme that applies only inside the elements it matches, so several themes can share a page. Returns the theme CSS and the ThemeProvider override types, or the build error, which lists any contrast pairs that fail. A result over the 40000 character budget comes back with a cursor: pass cursor.field and cursor.offset to read the next slice. A build that runs longer than ${BUILD_TIMEOUT_MS / 1000} seconds is stopped, and a call that arrives while the server is busy with other builds is refused; try it again a few seconds later. Nothing is stored.`,
    buildTokensArguments,
    async ({ files, resolver, scope, offset: from, field }) => {
      try {
        const built = await buildTokenFiles(files, { ...(resolver ? { resolver } : {}), ...(scope === undefined ? {} : { scope }) });
        return ok(resumeBuild(built, from ? { offset: from, ...(field ? { field } : {}) } : undefined));
      } catch (error) {
        return fail(error);
      }
    },
  );
  server.tool(
    'scaffold_design_system',
    'Draft the starter files of a design system on Todae: a company resolver, token files for replaced appearance colors, new button variants (copies of secondary) and densities (copies of comfortable), and TypeScript declarations for them. When the draft fits, returns tokenFiles and otherFiles, the shape build_tokens takes, plus whether those files build. A draft over the 40000 character budget comes back one file at a time. The first next call is this tool again, with the original arguments plus cursor.offset, and cursor.char when a file continues. Pass that call as it is. Save the files yourself; nothing is written to your machine.',
    {
      name: contextName,
      colors: z.object({ light: colorMap, dark: colorMap }).optional(),
      buttonVariants: z.array(contextName).max(8).optional(),
      densities: z.array(contextName).max(8).optional(),
      offset,
      char: z.number().int().min(0).optional(),
    },
    async ({ offset: from, char, ...options }) => {
      try {
        return ok(presentScaffold(await scaffoldDesignSystem(options), from ?? 0, char ?? 0, options));
      } catch (error) {
        return fail(error);
      }
    },
  );
  server.tool(
    'get_guide',
    'A guide page: get-started, build-on-todae, tokens, css-layers, composition, platform or mcp. Same reads as get_docs_page (section, locale, stubs). Prefer search_docs when you do not know the topic.',
    { topic: z.enum(GUIDE_TOPICS), ...pageRead },
    async ({ topic, section, locale: lang, includeCode: code, offset: from }) => {
      try {
        return ok(getGuide(topic, { ...(section ? { section } : {}), ...(lang ? { locale: lang } : {}), ...(code ? { includeCode: code } : {}), ...(from ? { offset: from } : {}) }));
      } catch (error) {
        return fail(error);
      }
    },
  );
  server.tool(
    'get_changes',
    "What changed in @tounsoo/todae's released versions after `from` (the installed version, such as 0.2.0, not a range such as ^0.2.0), up to `to` (default: the latest release), from the package's changelog. Returns each release oldest first, with its breaking changes apart from the rest, so an agent upgrading a project can apply each break in order. A long range comes back with a cursor. Pass cursor.offset for the next releases. Walking them returns the whole range. Before 1.0 a minor release is the breaking one.",
    { from: version, to: version.optional(), offset },
    async ({ offset: from, ...options }) => {
      try {
        return ok(getChanges({ ...options, offset: from ?? 0 }));
      } catch (error) {
        return fail(error);
      }
    },
  );
}

function createHandler(maxToolInputElements: number) {
  // createMcpHandler's parameter type omits maxToolInputElements and still forwards it to McpServer.
  const options = { serverInfo, maxToolInputElements } satisfies McpServerOptions & {
    serverInfo: typeof serverInfo;
    maxToolInputElements: number;
  };
  return createMcpHandler(registerTools, options, { basePath: '/api', disableSse: true });
}

// One cap for every server would let any tool take as many elements as build_tokens' files can hold, and zod 3
// checks every element of an oversized array after its .max() fails, so a small tool gets the small cap.
const toolHandler = createHandler(TOOL_INPUT_ELEMENTS);
const buildHandler = createHandler(BUILD_TOOL_INPUT_ELEMENTS);

// The endpoint's answers are for one caller and one call, so no cache keeps them.
// no-transform keeps proxies from buffering or rewriting a streamed answer, as the SDK's own header asked.
const NO_STORE = 'no-store, no-transform';

function noStore(response: Response): Response {
  const headers = new Headers(response.headers);
  headers.set('cache-control', NO_STORE);
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}

function jsonRpcError(status: number, code: number, message: string, id: string | number | null = null): Response {
  return Response.json({ jsonrpc: '2.0', error: { code, message }, id }, { status, headers: { 'cache-control': NO_STORE } });
}

/** The id of a body that is one JSON-RPC request, so an error about it can name it; a batch gets null. */
function requestId(body: unknown): string | number | null {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return null;
  const { id } = body as { id?: unknown };
  return typeof id === 'string' || typeof id === 'number' ? id : null;
}

async function POST(request: Request): Promise<Response> {
  const text = await readBody(request);
  if (text === null) return jsonRpcError(413, -32600, `Request body is larger than ${MAX_REQUEST_BYTES / 1024} KB`);
  // mcp-handler never answers a body that isn't JSON or that nests too deeply, so the call would hang until
  // maxDuration; answer it here as the transport answers a parse error.
  let body: unknown;
  try {
    body = JSON.parse(text);
  } catch {
    return jsonRpcError(400, -32700, 'Parse error: the request body is not JSON');
  }
  const id = requestId(body);
  const calls = toolCalls(body);
  if (calls.length > MAX_REQUEST_TOOL_CALLS) {
    return jsonRpcError(400, -32600, `A request may make at most ${MAX_REQUEST_TOOL_CALLS} tool calls`, id);
  }
  const building = calls.length > 0 && calls.every((call) => call.name === BUILD_TOOL);
  const buildFiles = new Set<object>();
  for (const call of calls) {
    const value = call.name === BUILD_TOOL ? (call.arguments as { files?: unknown } | null | undefined)?.files : undefined;
    if (!value || typeof value !== 'object') continue;
    // The SDK walks every file name before build_tokens' own schema counts them, so the count comes first.
    if (building && hasMoreKeysThan(value, MAX_FILES)) {
      return jsonRpcError(400, -32602, `build_tokens takes at most ${MAX_FILES} files`, id);
    }
    buildFiles.add(value);
  }
  const files = building ? buildFiles : new Set<object>();
  // In a request that mixes build_tokens with other tools, its files count like any other arguments. Say so
  // when that is what a limit caught, so a caller knows sending the build alone would pass.
  const mixed = (filesAreTheCause: () => boolean) =>
    !building && buildFiles.size > 0 && filesAreTheCause()
      ? '; build_tokens files only get their own limits when every tool call in the request is build_tokens'
      : '';
  const filesFitAsFiles = () =>
    [...buildFiles].every((value) => !hasMoreKeysThan(value, MAX_FILES) && Object.keys(value).every((key) => key.length <= MAX_FILE_NAME)) &&
    inspectBody(body, buildFiles) === null;
  // The SDK checks every message before a tool's own limit runs, so the body is measured whole here, once.
  switch (inspectBody(body, files)) {
    case 'deep':
      return jsonRpcError(400, -32600, `Request nests deeper than ${MAX_REQUEST_DEPTH} levels`, id);
    case 'elements':
      return jsonRpcError(400, -32600, `Request holds more than ${MAX_REQUEST_ELEMENTS} elements outside build_tokens files${mixed(filesFitAsFiles)}`, id);
    case 'key':
      return jsonRpcError(400, -32600, `Request holds an object key longer than ${MAX_REQUEST_KEY_LENGTH} characters outside build_tokens files${mixed(filesFitAsFiles)}`, id);
    case 'file-bytes':
      return jsonRpcError(400, -32602, `The files in this request total more than ${MAX_BYTES / 1024} KB`, id);
    case 'file-elements':
      return jsonRpcError(400, -32602, `The files in this request hold more than ${BUILD_TOOL_INPUT_ELEMENTS} elements in all`, id);
  }
  const elements = building ? BUILD_TOOL_INPUT_ELEMENTS : TOOL_INPUT_ELEMENTS;
  // The server checks each call on its own, so a batch's calls share one cap here.
  if (calls.length > 1 && countElements(calls.map((call) => call.arguments), elements) > elements) {
    // Everything but the build calls' files, which would get their own limits in a request of their own.
    const withoutFiles = calls.map(({ name, arguments: args }) => {
      if (name !== BUILD_TOOL || !args || typeof args !== 'object' || Array.isArray(args)) return args;
      const { files: _files, ...rest } = args as Record<string, unknown>;
      return rest;
    });
    const othersFit = () => countElements(withoutFiles, elements) <= elements && filesFitAsFiles();
    return jsonRpcError(400, -32602, `The tool calls in this request hold more than ${elements} elements in all${mixed(othersFit)}`, id);
  }
  const headers = new Headers(request.headers);
  headers.delete('content-length');
  const handler = building ? buildHandler : toolHandler;
  return noStore(await handler(new Request(request.url, { method: 'POST', headers, body: text, signal: request.signal })));
}

async function GET(request: Request): Promise<Response> {
  return noStore(await toolHandler(request));
}

export { GET, POST, GET as DELETE };
