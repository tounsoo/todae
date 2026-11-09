import { afterAll, describe, expect, it, vi } from 'vitest';
import { MAX_BYTES } from '../../../lib/docs-mcp/build';
import { BUILD_TOOL_INPUT_ELEMENTS, MAX_REQUEST_BYTES, TOOL_INPUT_ELEMENTS } from '../../../lib/docs-mcp/limits';
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
    const mixed = await post([call(6, 'build_tokens', big), call(7, 'list_components', {})]);
    expect(mixed).toContain(`maximum of ${TOOL_INPUT_ELEMENTS} elements`);
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
});
