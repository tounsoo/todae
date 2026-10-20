import { createMcpHandler } from 'mcp-handler';
import { z } from 'zod';
import { BUILD_TIMEOUT_MS, MAX_BYTES, MAX_FILES, baseContrast, buildTokenFiles } from '../../../lib/docs-mcp/build';
import { VERSION_RE, getChanges } from '../../../lib/docs-mcp/changes';
import { GUIDE_TOPICS, getGuide } from '../../../lib/docs-mcp/guides';
import { scaffoldDesignSystem } from '../../../lib/docs-mcp/scaffold';
import { LAYERS, getToken, listTokens } from '../../../lib/docs-mcp/tokens';
import { getComponent, listComponents, whenToUse } from '../../../lib/docs-mcp/tools';

// Longer than build_tokens' own time limit, so a stopped build can still report it.
export const maxDuration = 30;

const name = z.string().trim().min(1).max(80);
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

const handler = createMcpHandler(
  (server) => {
    server.tool('list_components', 'List Todae components from the published docs schema.', async () => {
      try {
        return ok(listComponents());
      } catch (error) {
        return fail(error);
      }
    });
    server.tool(
      'get_component',
      'Get one component or namespace (props and parts) from the docs schema.',
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
      'list_tokens',
      "List Todae's tokens from its token catalog: path, type, layer, context, CSS custom property, CSS value and description. Filter by a path prefix such as \"color.accent\" or by layer. Returns 200 rows from offset 0 unless limit and offset say otherwise; hasMore says whether more match.",
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
      'Get one token: what it is for, its value in each context (such as light and dark) and the tokens whose values read it.',
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
      `Run todae-tokens build on a company token package layered on Todae's, with the same checks. \`files\` maps each .json file's path inside the token folder to its JSON, at most ${MAX_FILES} files and ${MAX_BYTES / 1024} KB. \`resolver\` is the resolver's path among them (default "resolver.json"); scaffold_design_system's tokenFiles fit as they are. Returns the theme CSS and the ThemeProvider override types, or the build error, which lists any contrast pairs that fail. A build that runs longer than ${BUILD_TIMEOUT_MS / 1000} seconds is stopped, and a call that arrives while the server is busy with other builds is refused; try it again a few seconds later. Nothing is stored.`,
      { files: z.record(z.string().max(200), z.unknown()), resolver: z.string().max(200).optional() },
      async ({ files, resolver }) => {
        try {
          return ok(await buildTokenFiles(files, resolver ? { resolver } : {}));
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
      "What changed in @tounsoo/todae's released versions after `from` (the version a project uses), up to `to` (default: the latest release), from the package's changelog. Returns each release oldest first, with its breaking changes apart from the rest, so an agent upgrading a project can apply each break in order. Before 1.0 a minor release is the breaking one.",
      { from: version, to: version.optional() },
      async (options) => {
        try {
          return ok(getChanges(options));
        } catch (error) {
          return fail(error);
        }
      },
    );
  },
  { serverInfo: { name: 'todae-docs', version: '0.0.0' } },
  { basePath: '/api', disableSse: true },
);

export { handler as GET, handler as POST, handler as DELETE };
