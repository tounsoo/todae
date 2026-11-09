import { afterAll, describe, expect, it, vi } from 'vitest';
import { MAX_BYTES } from '../../../lib/docs-mcp/build';
import { BUILD_TOOL_INPUT_ELEMENTS, MAX_REQUEST_BYTES, MAX_REQUEST_DEPTH, MAX_REQUEST_TOOL_CALLS, TOOL_INPUT_ELEMENTS } from '../../../lib/docs-mcp/limits';
import { catalogTokens } from '../../../lib/docs-mcp/tokens';

vi.useFakeTimers();
const { POST } = await import('./route');

afterAll(() => {
  vi.useRealTimers();
});

const ENDPOINT = 'https://todae.local/api/mcp';
const ELEMENT_CAP = BUILD_TOOL_INPUT_ELEMENTS;

function send(body: BodyInit, headers: Record<string, string> = {}): Promise<Response> {
  return POST(
    new Request(ENDPOINT, {
      method: 'POST',
      headers: {
        accept: 'application/json, text/event-stream',
        'content-type': 'application/json',
        ...headers,
      },
      body,
      duplex: 'half',
    } as RequestInit),
  );
}

async function post(body: unknown): Promise<string> {
  const response = await send(JSON.stringify(body));
  expect(response.status).toBe(200);
  return response.text();
}

function call(id: number, name: string, args: unknown) {
  return { jsonrpc: '2.0', id, method: 'tools/call', params: { name, arguments: args } };
}

describe('docs MCP route', () => {
  it('names the server todae-docs', async () => {
    const text = await post({
      jsonrpc: '2.0',
      id: 1,
      method: 'initialize',
      params: {
        protocolVersion: '2025-03-26',
        capabilities: {},
        clientInfo: { name: 'route-test', version: '0' },
      },
    });
    expect(text).toContain('"name":"todae-docs"');
  });

  it('rejects a tools/call whose arguments exceed the element cap', async () => {
    const text = await post({
      jsonrpc: '2.0',
      id: 2,
      method: 'tools/call',
      params: {
        name: 'build_tokens',
        arguments: { files: { 'x.json': Array(ELEMENT_CAP).fill(0) } },
      },
    });
    expect(text).toContain(`maximum of ${ELEMENT_CAP} elements`);
  });

  it('accepts a file that fills the byte budget', async () => {
    const zeros = Array<number>(Math.floor((MAX_BYTES - 1) / 2)).fill(0);
    expect(Buffer.byteLength(JSON.stringify(zeros))).toBeLessThanOrEqual(MAX_BYTES);
    const text = await post({
      jsonrpc: '2.0',
      id: 3,
      method: 'tools/call',
      params: { name: 'build_tokens', arguments: { files: { 'x.json': zeros } } },
    });
    expect(text).not.toContain('maximum of');
    expect(text).toContain('files must include the resolver');
  });

  it('caps every tool but build_tokens at the small element limit', async () => {
    const text = await post(call(4, 'scaffold_design_system', { name: 'acme', buttonVariants: Array(TOOL_INPUT_ELEMENTS + 1).fill('x') }));
    expect(text).toContain(`maximum of ${TOOL_INPUT_ELEMENTS} elements`);
  });

  it('lets scaffold_design_system replace every appearance color in light and dark', async () => {
    const paths = catalogTokens()
      .filter((row) => row.layer === 'appearance' && row.type === 'color')
      .map((row) => row.path);
    const colors = Object.fromEntries(paths.map((path) => [path, [0.5, 0.1, 200]]));
    const text = await post(
      call(5, 'scaffold_design_system', { name: 'acme', colors: { light: colors, dark: colors }, buttonVariants: Array(8).fill('x'), densities: Array(8).fill('y') }),
    );
    expect(text).not.toContain('maximum of');
  });

  it('gives a batch the small cap unless every call in it is build_tokens', async () => {
    const big = { files: { 'x.json': Array(TOOL_INPUT_ELEMENTS).fill(0) } };
    const mixed = await send(JSON.stringify([call(6, 'build_tokens', big), call(7, 'list_components', {})]));
    expect(mixed.status).toBe(400);
    expect(await mixed.json()).toMatchObject({ error: { message: `The tool calls in this request hold more than ${TOOL_INPUT_ELEMENTS} elements in all` } });
    const builds = await post([call(8, 'build_tokens', big)]);
    expect(builds).not.toContain('maximum of');
    expect(builds).toContain('files must include the resolver');
  });

  it('refuses a body over the size limit before reading the rest', async () => {
    let pulled = 0;
    const chunk = new Uint8Array(64 * 1024).fill(0x20);
    const stream = new ReadableStream<Uint8Array>({
      pull(controller) {
        pulled += chunk.byteLength;
        controller.enqueue(chunk);
      },
    });
    const response = await send(stream);
    expect(response.status).toBe(413);
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(await response.json()).toMatchObject({ error: { message: `Request body is larger than ${MAX_REQUEST_BYTES / 1024} KB` } });
    expect(pulled).toBeLessThan(MAX_REQUEST_BYTES + 3 * chunk.byteLength);
  });

  it('refuses a declared Content-Length over the size limit', async () => {
    const response = await send('{}', { 'content-length': String(MAX_REQUEST_BYTES + 1) });
    expect(response.status).toBe(413);
  });

  it('tells caches not to store its answers', async () => {
    const response = await send(JSON.stringify(call(9, 'list_components', {})));
    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe('no-store');
  });

  it('accepts files within the byte budget sent with every non-ASCII character escaped', async () => {
    const text = 'é'.repeat(Math.floor((MAX_BYTES - 2) / 2));
    const body = JSON.stringify(call(10, 'build_tokens', { files: { 'x.json': text } })).replace(/é/g, '\\u00e9');
    expect(body.length).toBeGreaterThan(2 * MAX_BYTES);
    const response = await send(body);
    expect(response.status).toBe(200);
    expect(await response.text()).toContain('files must include the resolver');
  });

  it('routes a body that starts with a byte order mark as it would without one', async () => {
    const response = await send(`\uFEFF${JSON.stringify(call(11, 'build_tokens', { files: { 'x.json': Array(TOOL_INPUT_ELEMENTS + 1).fill(0) } }))}`);
    const text = await response.text();
    expect(text).not.toContain('maximum of');
    expect(text).toContain('files must include the resolver');
  });

  it('refuses a build_tokens call with too many files in one short error', async () => {
    const files = Object.fromEntries(Array.from({ length: 5000 }, (_, i) => [`${'k'.repeat(201)}${i}.json`, 0]));
    const text = await post(call(12, 'build_tokens', { files }));
    expect(text).toContain('At most 64 files');
    expect(text.length).toBeLessThan(2000);
  });

  it('answers a body that is not JSON with a parse error instead of hanging', async () => {
    for (const body of ['not json', '']) {
      const response = await send(body);
      expect(response.status).toBe(400);
      expect(await response.json()).toMatchObject({ error: { code: -32700 } });
    }
  });

  it('answers a body nested too deeply instead of hanging', async () => {
    const deep = `${'['.repeat(100_000)}${']'.repeat(100_000)}`;
    const response = await send(deep);
    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ error: { message: `Request nests deeper than ${MAX_REQUEST_DEPTH} levels` } });
  });

  it('still takes a token file nested as deep as the limit allows', async () => {
    let nested: unknown = {};
    for (let level = 0; level < MAX_REQUEST_DEPTH - 6; level += 1) nested = { a: nested };
    const text = await post(call(13, 'build_tokens', { files: { 'x.json': nested } }));
    expect(text).toContain('files must include the resolver');
  });

  it('shares one element cap among the calls of a batch', async () => {
    const half = { name: 'acme', buttonVariants: Array(TOOL_INPUT_ELEMENTS / 2).fill('x') };
    const response = await send(JSON.stringify([call(14, 'scaffold_design_system', half), call(15, 'scaffold_design_system', half), call(16, 'list_components', {})]));
    expect(response.status).toBe(400);
  });

  it('refuses a batch of more tool calls than a request may make', async () => {
    const calls = Array.from({ length: MAX_REQUEST_TOOL_CALLS + 1 }, (_, i) => call(20 + i, 'list_components', {}));
    const response = await send(JSON.stringify(calls));
    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ error: { message: `A request may make at most ${MAX_REQUEST_TOOL_CALLS} tool calls` } });
    const allowed = await post(calls.slice(0, MAX_REQUEST_TOOL_CALLS));
    expect(allowed).toContain('"id":20');
  });
});
