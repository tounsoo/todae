import { createMcpHandler } from 'mcp-handler';
import { z } from 'zod';
import { MAX_FILES, baseContrast, buildTokenFiles } from '../../../lib/docs-mcp/build';
import { GUIDE_TOPICS, getGuide } from '../../../lib/docs-mcp/guides';
import { scaffoldDesignSystem } from '../../../lib/docs-mcp/scaffold';
import { LAYERS, getToken, listTokens } from '../../../lib/docs-mcp/tokens';
import { getComponent, listComponents, whenToUse } from '../../../lib/docs-mcp/tools';

const name = z.string().trim().min(1).max(80);
const tokenPath = z.string().trim().min(1).max(120);
const contextName = z.string().regex(/^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/).max(40);
const oklch = z.tuple([z.number().min(0).max(1), z.number().min(0).max(0.5), z.number().min(0).max(360)]);
const colorMap = z.record(tokenPath, oklch);

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
      "List Todae's tokens from its token catalog: path, $type, layer, context, CSS custom property and CSS value. Filter by a path prefix such as \"color.accent\" or by layer.",
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
      'Get one token: its value in each context (such as light and dark) and the tokens whose values read it.',
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
      "Todae's APCA contrast pairs, each with its minimum Lc and the Lc Todae's base theme measures in every appearance. A company's tokens must meet the same pairs.",
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
      `Run todae-tokens build on a company token package layered on Todae's, with the same checks. \`files\` maps paths relative to the resolver (it must include "resolver.json") to each file's JSON, at most ${MAX_FILES} files. Returns the theme CSS, the ThemeProvider override types and contrast results, or the build error. Nothing is stored.`,
      { files: z.record(z.string().max(200), z.unknown()) },
      async ({ files }) => {
        try {
          return ok(await buildTokenFiles(files));
        } catch (error) {
          return fail(error);
        }
      },
    );
    server.tool(
      'scaffold_design_system',
      'Draft the starter files of a design system on Todae: a company resolver, token files for replaced appearance colors, new button variants and densities, and TypeScript declarations for them. The files are checked with todae-tokens build and returned for you to save; nothing is written.',
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
  },
  { serverInfo: { name: 'todae-docs', version: '0.0.0' } },
  { basePath: '/api', disableSse: true },
);

export { handler as GET, handler as POST, handler as DELETE };
