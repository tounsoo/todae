import { afterAll, describe, expect, it, vi } from 'vitest';
import { MAX_BYTES, MAX_FILES } from '../../../lib/docs-mcp/build';

vi.useFakeTimers();
const { POST } = await import('./route');

afterAll(() => {
  vi.useRealTimers();
});

const ENDPOINT = 'https://todae.local/api/mcp';
const ELEMENT_CAP = MAX_BYTES / 2 + MAX_FILES + 3;

async function post(body: unknown): Promise<string> {
  const response = await POST(
    new Request(ENDPOINT, {
      method: 'POST',
      headers: {
        accept: 'application/json, text/event-stream',
        'content-type': 'application/json',
      },
      body: JSON.stringify(body),
    }),
  );
  expect(response.status).toBe(200);
  return response.text();
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
});
