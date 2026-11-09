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

/**
 * Array elements and object members a request may hold outside build_tokens files: the tool calls' shared
 * TOOL_INPUT_ELEMENTS and as much again for the JSON-RPC messages around them. The SDK checks every message
 * before any tool's own limit runs, and each element it walks costs CPU, so a body may carry no more than this
 * where no tool reads it.
 */
export const MAX_REQUEST_ELEMENTS = 2 * TOOL_INPUT_ELEMENTS;

/** Why a parsed body is refused before the server sees it. */
export type BodyProblem = 'deep' | 'elements' | 'file-elements';

/**
 * Walks a parsed body once, without recursion, and stops at the first problem: nesting past MAX_REQUEST_DEPTH,
 * more than MAX_REQUEST_ELEMENTS elements outside `files`, or more than BUILD_TOOL_INPUT_ELEMENTS inside them.
 * `files` holds the files objects of the request's build_tokens calls. Returns null when the body may go on.
 */
export function inspectBody(body: unknown, files: ReadonlySet<object>): BodyProblem | null {
  let outside = 0;
  let inside = 0;
  const stack: [unknown, number, boolean][] = [[body, 0, false]];
  while (stack.length > 0) {
    const [node, depth, inFiles] = stack.pop()!;
    if (node === null || typeof node !== 'object') continue;
    if (depth >= MAX_REQUEST_DEPTH) return 'deep';
    const childInFiles = inFiles || files.has(node);
    // Children are visited one at a time rather than copied out first, so a huge object stops at the cap.
    const visit = (child: unknown): BodyProblem | null => {
      if (childInFiles) {
        if (++inside > BUILD_TOOL_INPUT_ELEMENTS) return 'file-elements';
      } else if (++outside > MAX_REQUEST_ELEMENTS) return 'elements';
      if (child !== null && typeof child === 'object') stack.push([child, depth + 1, childInFiles]);
      return null;
    };
    if (Array.isArray(node)) {
      for (const child of node) {
        const problem = visit(child);
        if (problem) return problem;
      }
    } else {
      for (const key in node) {
        if (!Object.prototype.hasOwnProperty.call(node, key)) continue;
        const problem = visit((node as Record<string, unknown>)[key]);
        if (problem) return problem;
      }
    }
  }
  return null;
}
