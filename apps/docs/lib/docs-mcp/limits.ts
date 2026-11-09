import { MAX_BYTES, MAX_FILES } from './build';

/**
 * The largest request body the MCP endpoint reads. Twice build_tokens' file budget leaves room for the
 * JSON-RPC envelope, file names and the escaping a file sent as a JSON string adds.
 */
export const MAX_REQUEST_BYTES = 2 * MAX_BYTES;

/**
 * Array elements and object members a build_tokens call may carry. Every element of JSON takes at least
 * 2 bytes, so this is the most that files within MAX_BYTES can hold, plus the files' names and the
 * tool's three arguments.
 */
export const BUILD_TOOL_INPUT_ELEMENTS = MAX_BYTES / 2 + MAX_FILES + 3;

/**
 * Array elements and object members any other tool call may carry. The largest real call is
 * scaffold_design_system replacing every appearance color in light and dark, at 4 elements a color.
 */
export const TOOL_INPUT_ELEMENTS = 1024;

/** The one tool that takes files, and so the only one that gets BUILD_TOOL_INPUT_ELEMENTS. */
export const BUILD_TOOL = 'build_tokens';

/**
 * Reads a request body as text, or returns null once it passes `limit` bytes, without reading the rest.
 * A Content-Length over the limit is refused before any read.
 */
export async function readBody(request: Request, limit = MAX_REQUEST_BYTES): Promise<string | null> {
  const declared = Number(request.headers.get('content-length'));
  if (Number.isFinite(declared) && declared > limit) return null;
  if (!request.body) return '';
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let bytes = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    bytes += value.byteLength;
    if (bytes > limit) {
      await reader.cancel();
      return null;
    }
    chunks.push(value);
  }
  return Buffer.concat(chunks).toString('utf8');
}

/**
 * Whether a parsed body calls build_tokens and no other tool, so the larger element cap may apply.
 * A JSON-RPC batch qualifies only when every tools/call in it is build_tokens.
 */
export function callsOnlyBuildTool(body: unknown): boolean {
  const messages = Array.isArray(body) ? body : [body];
  let found = false;
  for (const message of messages) {
    if (!message || typeof message !== 'object' || (message as { method?: unknown }).method !== 'tools/call') continue;
    const params = (message as { params?: unknown }).params;
    if (!params || typeof params !== 'object' || (params as { name?: unknown }).name !== BUILD_TOOL) return false;
    found = true;
  }
  return found;
}
