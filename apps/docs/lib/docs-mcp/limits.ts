import { MAX_BYTES, MAX_FILES } from './build';

/**
 * The largest request body the MCP endpoint reads. A client may escape each non-ASCII character of a file as
 * \uXXXX, which takes up to three times its UTF-8 bytes, so files within MAX_BYTES can take three times that
 * on the wire; the fourth share is for the JSON-RPC envelope and the file names.
 */
export const MAX_REQUEST_BYTES = 4 * MAX_BYTES;

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

/**
 * How deeply arrays and objects may nest in a request. mcp-handler re-serializes the body recursively, and a
 * body nested far deeper overflows its stack without an answer. Token files nest a few dozen levels at most.
 */
export const MAX_REQUEST_DEPTH = 256;

/** The one tool that takes files, and so the only one that gets BUILD_TOOL_INPUT_ELEMENTS, alone or in a batch of its own calls. */
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
  // TextDecoder drops a leading byte order mark, as the handler's own request.json() does.
  return new TextDecoder().decode(Buffer.concat(chunks));
}

/**
 * Tool calls one request may make. A JSON-RPC batch runs each call on its own, so without this a batch of 100
 * calls would get 100 times a call's element cap and return 100 times its answer.
 */
export const MAX_REQUEST_TOOL_CALLS = 4;

/** The name and arguments of each tools/call message in a parsed body, one message or a batch. */
export function toolCalls(body: unknown): { name: unknown; arguments: unknown }[] {
  const calls: { name: unknown; arguments: unknown }[] = [];
  for (const message of Array.isArray(body) ? body : [body]) {
    if (!message || typeof message !== 'object' || (message as { method?: unknown }).method !== 'tools/call') continue;
    const params = (message as { params?: unknown }).params;
    const { name, arguments: args } = params && typeof params === 'object' ? (params as { name?: unknown; arguments?: unknown }) : {};
    calls.push({ name, arguments: args });
  }
  return calls;
}

/**
 * Array elements and object members in `values` together, counted as the SDK counts one call's arguments
 * and stopping once the total passes `max`.
 */
export function countElements(values: readonly unknown[], max: number): number {
  let count = 0;
  const stack = [...values];
  while (stack.length > 0) {
    const node = stack.pop();
    if (node === null || typeof node !== 'object') continue;
    for (const child of Array.isArray(node) ? node : Object.values(node)) {
      if (++count > max) return count;
      if (child !== null && typeof child === 'object') stack.push(child);
    }
  }
  return count;
}

/** Whether `value` is an object with more than `max` own keys, counting no further than max + 1. */
export function hasMoreKeysThan(value: unknown, max: number): boolean {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  let count = 0;
  for (const key in value) {
    if (Object.prototype.hasOwnProperty.call(value, key) && ++count > max) return true;
  }
  return false;
}

/** Whether arrays and objects in `value` nest more than `max` levels deep, walked without recursion. */
export function nestsDeeperThan(value: unknown, max: number): boolean {
  const stack: [unknown, number][] = [[value, 0]];
  while (stack.length > 0) {
    const [node, depth] = stack.pop()!;
    if (node === null || typeof node !== 'object') continue;
    if (depth >= max) return true;
    for (const child of Array.isArray(node) ? node : Object.values(node)) {
      if (child !== null && typeof child === 'object') stack.push([child, depth + 1]);
    }
  }
  return false;
}
