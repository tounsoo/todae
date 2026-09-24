import { createMcpHandler } from 'mcp-handler';
import { z } from 'zod';
import { getComponent, listComponents, whenToUse } from '../../../lib/docs-mcp/tools';

const name = z.string().trim().min(1).max(80);

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
  },
  { serverInfo: { name: 'todae-docs', version: '0.0.0' } },
  { basePath: '/api', disableSse: true },
);

export { handler as GET, handler as POST, handler as DELETE };
