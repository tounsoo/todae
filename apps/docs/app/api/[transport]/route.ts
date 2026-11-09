import type { McpServer, McpServerOptions } from '@modelcontextprotocol/sdk/server/mcp.js';
import { createMcpHandler } from 'mcp-handler';
import { z } from 'zod';
import { BUILD_TIMEOUT_MS, MAX_BYTES, MAX_FILES, baseContrast, buildTokenFiles } from '../../../lib/docs-mcp/build';
import { VERSION_RE, getChanges } from '../../../lib/docs-mcp/changes';
import { GUIDE_TOPICS, getGuide } from '../../../lib/docs-mcp/guides';
import { getRecipe, listRecipes } from '../../../lib/docs-mcp/recipes';
import { scaffoldDesignSystem } from '../../../lib/docs-mcp/scaffold';
import {
  BUILD_TOOL,
  BUILD_TOOL_INPUT_ELEMENTS,
  MAX_REQUEST_BYTES,
  MAX_REQUEST_DEPTH,
  MAX_REQUEST_TOOL_CALLS,
  TOOL_INPUT_ELEMENTS,
  countElements,
  hasMoreKeysThan,
  nestsDeeperThan,
  readBody,
  toolCalls,
} from '../../../lib/docs-mcp/limits';
import { LAYERS, getToken, listTokens } from '../../../lib/docs-mcp/tokens';
import { getComponent, getDocsPage, listComponents, whenToUse } from '../../../lib/docs-mcp/tools';
import { RELEASE } from '../../../lib/version';

// Longer than build_tokens' own time limit, so a stopped build can still report it.
export const maxDuration = 30;

const name = z.string().trim().min(1).max(80);
const pageQuery = z.string().trim().min(1).max(200);
const tokenPath = z.string().trim().min(1).max(120);
const contextName = z.string().regex(/^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/).max(40);
const oklch = z.tuple([z.number().min(0).max(1), z.number().min(0).max(0.5), z.number().min(0).max(360)]);
const colorMap = z.record(tokenPath, oklch);
const version = z.string().trim().regex(VERSION_RE, 'Use a version such as 0.2.0');

function ok(data: unknown) {
  return { content: [{ type: 'text' as const, text: JSON.stringify(data) }] };
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
  }, z.record(z.string().max(200), z.unknown())),
  resolver: z.string().max(200).optional(),
  scope: z.string().max(200).optional(),
};

const serverInfo = { name: 'todae-docs', version: RELEASE.version };

function registerTools(server: McpServer) {
  server.tool('list_components', 'List Todae components from the published docs schema.', async () => {
    try {
      return ok(listComponents());
    } catch (error) {
      return fail(error);
    }
  });
  server.tool(
    'get_component',
    'Get one component or namespace (props and parts) from the docs schema. For the docs page, with the example code that shows how its parts and hooks fit together, call get_docs_page.',
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
    'Read the When to use / When not to use sections from the docs page. Does not infer missing copy.',
    { name },
    async ({ name: componentName }) => {
      try {
        return ok(whenToUse(componentName));
      } catch (error) {
        return fail(error);
      }
    },
  );
  server.tool(
    'get_docs_page',
    'Read the English docs page for a component, part, hook or helper (such as "Tooltip" or "useTooltip"), or any page by slug (such as "utilities/use-tooltip") or docsUrl, as MDX source with absolute links. Each live example\'s code is inlined in a tsx fence above it, so the page shows how Todae composes the parts and hooks, which props alone do not. propsTables lists the names on the page whose props get_component returns.',
    { name: pageQuery },
    async ({ name: query }) => {
      try {
        return ok(getDocsPage(query));
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
    'Read one recipe by name (such as "data-table") or title, as MDX source with absolute links: its code, how it behaves, its accessible composition, and its When to use and When not to use copy.',
    { name },
    async ({ name: recipe }) => {
      try {
        return ok(getRecipe(recipe));
      } catch (error) {
        return fail(error);
      }
    },
  );
  server.tool(
    'list_tokens',
    "List Todae's tokens from its token catalog: path, type, layer, context, the set or modifier that declares it (with the context for a button variant), CSS custom property, CSS value and description. Filter by a path prefix such as \"color.accent\" or by layer. Returns 200 rows from offset 0 unless limit and offset say otherwise; hasMore says whether more match.",
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
    `Run todae-tokens build on a company token package layered on Todae's, with the same checks. \`files\` maps each .json file's path inside the token folder to its JSON, at most ${MAX_FILES} files and ${MAX_BYTES / 1024} KB. \`resolver\` is the resolver's path among them (default "resolver.json"); scaffold_design_system's tokenFiles fit as they are. \`scope\`, a CSS selector such as ".brand-acme", builds a theme that applies only inside the elements it matches, so several themes can share a page. Returns the theme CSS and the ThemeProvider override types, or the build error, which lists any contrast pairs that fail. A build that runs longer than ${BUILD_TIMEOUT_MS / 1000} seconds is stopped, and a call that arrives while the server is busy with other builds is refused; try it again a few seconds later. Nothing is stored.`,
    buildTokensArguments,
    async ({ files, resolver, scope }) => {
      try {
        return ok(await buildTokenFiles(files, { ...(resolver ? { resolver } : {}), ...(scope === undefined ? {} : { scope }) }));
      } catch (error) {
        return fail(error);
      }
    },
  );
  server.tool(
    'scaffold_design_system',
    'Draft the starter files of a design system on Todae: a company resolver, token files for replaced appearance colors, new button variants (copies of secondary) and densities (copies of comfortable), and TypeScript declarations for them. Returns tokenFiles by path inside tokensFolder ("tokens"), in the shape build_tokens takes, and otherFiles by path from the project root, with the result of building tokenFiles. Save the files yourself; nothing is written to your machine.',
    {
      name: contextName,
      colors: z.object({ light: colorMap, dark: colorMap }).optional(),
      buttonVariants: z.array(contextName).max(8).optional(),
      densities: z.array(contextName).max(8).optional(),
    },
    async (options) => {
      try {
        return ok(await scaffoldDesignSystem(options));
      } catch (error) {
        return fail(error);
      }
    },
  );
  server.tool(
    'get_guide',
    'Read a docs page about building on Todae, as MDX source with absolute links.',
    { topic: z.enum(GUIDE_TOPICS) },
    async ({ topic }) => {
      try {
        return ok(getGuide(topic));
      } catch (error) {
        return fail(error);
      }
    },
  );
  server.tool(
    'get_changes',
    "What changed in @tounsoo/todae's released versions after `from` (the installed version, such as 0.2.0, not a range such as ^0.2.0), up to `to` (default: the latest release), from the package's changelog. Returns each release oldest first, with its breaking changes apart from the rest, so an agent upgrading a project can apply each break in order. Before 1.0 a minor release is the breaking one.",
    { from: version, to: version.optional() },
    async (options) => {
      try {
        return ok(getChanges(options));
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
function noStore(response: Response): Response {
  const headers = new Headers(response.headers);
  headers.set('cache-control', 'no-store');
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}

function jsonRpcError(status: number, code: number, message: string): Response {
  return Response.json({ jsonrpc: '2.0', error: { code, message }, id: null }, { status, headers: { 'cache-control': 'no-store' } });
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
  if (nestsDeeperThan(body, MAX_REQUEST_DEPTH)) {
    return jsonRpcError(400, -32600, `Request nests deeper than ${MAX_REQUEST_DEPTH} levels`);
  }
  const calls = toolCalls(body);
  if (calls.length > MAX_REQUEST_TOOL_CALLS) {
    return jsonRpcError(400, -32600, `A request may make at most ${MAX_REQUEST_TOOL_CALLS} tool calls`);
  }
  const building = calls.length > 0 && calls.every((call) => call.name === BUILD_TOOL);
  const elements = building ? BUILD_TOOL_INPUT_ELEMENTS : TOOL_INPUT_ELEMENTS;
  // The server checks each call on its own, so a batch's calls share one cap here.
  if (calls.length > 1 && countElements(calls.map((call) => call.arguments), elements) > elements) {
    return jsonRpcError(400, -32602, `The tool calls in this request hold more than ${elements} elements in all`);
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
