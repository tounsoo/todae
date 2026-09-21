import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { getComponent, getPattern, INTENTS, listComponents, search, toCriteria } from '@tounsoo/todae/catalog';
import { describe, expect, it } from 'vitest';
import { createServer } from './server.js';

async function connect() {
  const server = createServer();
  const client = new Client({ name: 'server-test', version: '0.0.0' });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  await Promise.all([client.connect(clientTransport), server.connect(serverTransport)]);
  return { client, server };
}

function parseTool(result: unknown) {
  const value = result as { content?: Array<{ type: string; text?: string }>; isError?: boolean };
  const part = value.content?.[0];
  const text = part?.type === 'text' ? part.text : undefined;
  if (value.isError) return { isError: true, data: text };
  return { isError: false, data: text === undefined ? undefined : JSON.parse(text) };
}

function resourceText(contents: Array<{ text?: string } | { blob?: string }>) {
  const content = contents[0];
  return content && 'text' in content ? content.text : undefined;
}

describe('todae MCP server', () => {
  it('registers catalog tools', async () => {
    const { client, server } = await connect();
    const tools = await client.listTools();
    expect(tools.tools.map((tool) => tool.name).sort()).toEqual([
      'get_component',
      'get_pattern',
      'list_components',
      'list_for_intent',
      'list_intents',
      'list_patterns',
      'search',
      'to_candidate_recipe',
      'to_criteria',
      'to_render_catalog',
    ]);
    await client.close();
    await server.close();
  });

  it('tool calls match package helpers and missing ids error', async () => {
    const { client, server } = await connect();
    expect(parseTool(await client.callTool({ name: 'list_intents', arguments: {} })).data).toEqual([...INTENTS]);
    expect(parseTool(await client.callTool({ name: 'search', arguments: { query: 'modal' } })).data).toEqual(
      search('modal'),
    );
    expect(parseTool(await client.callTool({ name: 'get_component', arguments: { id: 'Button.Root' } })).data).toEqual(
      getComponent('Button.Root'),
    );
    expect(parseTool(await client.callTool({ name: 'to_criteria', arguments: { id: 'labelled-field' } })).data).toEqual(
      toCriteria(getPattern('labelled-field')!),
    );
    expect(parseTool(await client.callTool({ name: 'get_component', arguments: { id: 'NoSuch' } })).isError).toBe(true);
    expect(parseTool(await client.callTool({ name: 'get_pattern', arguments: { id: 'no-such' } })).isError).toBe(true);
    await client.close();
    await server.close();
  });

  it('optional component and pattern templates read catalog entries', async () => {
    const { client, server } = await connect();
    const listed = await client.listResources();
    expect(listed.resources.some((resource) => resource.uri === 'todae://catalog.json')).toBe(true);
    expect(listed.resources.some((resource) => resource.uri === 'todae://components/Button.Root')).toBe(true);
    const component = await client.readResource({ uri: 'todae://components/Button.Root' });
    expect(JSON.parse(resourceText(component.contents) ?? '')).toEqual(getComponent('Button.Root'));
    const pattern = await client.readResource({ uri: 'todae://patterns/labelled-field' });
    expect(JSON.parse(resourceText(pattern.contents) ?? '')).toEqual(getPattern('labelled-field'));
    expect(listComponents().length).toBeGreaterThan(0);
    await client.close();
    await server.close();
  });
});
