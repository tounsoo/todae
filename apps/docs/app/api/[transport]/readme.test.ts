import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { Nav } from '../../../lib/docs-mcp/budget';

// The package README tells agents which docs MCP tools to call, in what order. This test reads that
// guide and walks it against the tools this route registers, so the README can't drift from them.
const { POST } = await import('./route');

const README_PATH = 'packages/design-system/README.md';
const README = readFileSync(new URL(`../../../../../${README_PATH}`, import.meta.url), 'utf8');
const ROUTE = 'apps/docs/app/api/[transport]/route.ts';
/** The MCP server bullet, with any lines it wraps onto, up to a blank line, the next item or a heading. */
const MCP_BULLET = /^- \*\*MCP server:\*\*.*(?:\n(?!\n|- |#).*)*/m;
const FENCE = /^```[\s\S]*?^```/gm;
const SNAKE_CASE = /`([a-z][a-z0-9]*(?:_[a-z0-9]+)+)`/g;
/** A backticked `name: value` argument, such as `includeCode: true` or `start_line: 1`. */
const ARGUMENT = /`([a-zA-Z_][a-zA-Z0-9_]*): [^`]+`/g;

/** The first call for a guide that starts at this tool. */
const SEEDS: Record<string, Record<string, unknown>> = {
  search_docs: { query: 'tooltip' },
  get_docs_page: { name: 'Tooltip' },
  get_component: { name: 'Tooltip' },
};

type Body = Record<string, unknown> & { nav?: Nav };
type Tool = { name: string; inputSchema: { properties?: Record<string, unknown> } };
type RpcResult = { result?: { tools?: Tool[]; isError?: boolean; content?: { type: string; text: string }[] }; error?: { message: string } };

let nextId = 1;

async function rpc(method: string, params: unknown): Promise<NonNullable<RpcResult['result']>> {
  const response = await POST(
    new Request('https://todae.local/api/mcp', {
      method: 'POST',
      headers: { accept: 'application/json, text/event-stream', 'content-type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: nextId++, method, params }),
      duplex: 'half',
    } as RequestInit),
  );
  // The streamable HTTP transport answers with one server-sent event; its data line is the JSON-RPC reply.
  const text = await response.text();
  const data = text.split('\n').find((line) => line.startsWith('data: '))?.slice('data: '.length) ?? text;
  const body = JSON.parse(data) as RpcResult;
  if (!body.result) throw new Error(`${method} failed: ${body.error?.message ?? response.status}`);
  return body.result;
}

async function registeredTools(): Promise<Map<string, Tool>> {
  const { tools = [] } = await rpc('tools/list', {});
  return new Map(tools.map((tool) => [tool.name, tool]));
}

async function call(name: string, args: Record<string, unknown>): Promise<Body> {
  const result = await rpc('tools/call', { name, arguments: args });
  const text = result.content?.find((part) => part.type === 'text')?.text ?? '';
  if (result.isError) throw new Error(`${name}(${JSON.stringify(args)}) failed: ${text}`);
  return JSON.parse(text) as Body;
}

/** True when a result is example source (get_example's shape), not a page with example stubs. */
function hasExampleCode(body: Body): boolean {
  return body.kind === 'example' && typeof body.code === 'string';
}

/** The arguments the previous result gives for a call to `tool`, the way the README says to pass them. */
function argumentsFor(previousTool: string, previous: Body, tool: string): Record<string, unknown> | undefined {
  const named = previous.nav?.next.find((next) => next.tool === tool);
  if (named) return named.arguments;
  // The README passes a hit's ref to get_docs_page; nav.next names only the top hit's call.
  if (previousTool === 'search_docs' && tool === 'get_docs_page' && Array.isArray(previous.hits)) {
    const hit = (previous.hits as { kind?: string; ref?: string }[]).find((row) => row.kind === 'page' || row.kind === 'section');
    if (hit?.ref) return { name: hit.ref };
  }
  return undefined;
}

/**
 * Problems with a README's agent guide: tool names the route does not register, arguments a tool does
 * not take, and a reading flow (the tools in the MCP server bullet, in order) that does not reach example code.
 */
async function readmeProblems(readme: string): Promise<string[]> {
  const tools = await registeredTools();
  const problems: string[] = [];
  // Outside code blocks, every backticked snake_case name in the README is a tool name.
  for (const [, name = ''] of readme.replace(FENCE, '').matchAll(SNAKE_CASE)) {
    if (!tools.has(name)) problems.push(`${README_PATH} names \`${name}\`, which ${ROUTE} does not register.`);
  }
  const bullet = readme.match(MCP_BULLET)?.[0];
  if (!bullet) return [...problems, `${README_PATH} has no "- **MCP server:**" bullet to guide agents.`];

  // Each backticked `name: value` is an argument of the last tool named before it.
  const mentions = [...bullet.matchAll(new RegExp(`${SNAKE_CASE.source}|${ARGUMENT.source}`, 'g'))];
  let current: string | undefined;
  for (const [, toolName, argument] of mentions) {
    if (toolName) current = tools.has(toolName) ? toolName : undefined;
    if (!argument) continue;
    const inputs = current ? Object.keys(tools.get(current)?.inputSchema.properties ?? {}) : [];
    if (!current || !inputs.includes(argument)) {
      problems.push(`The MCP server bullet passes \`${argument}\` to \`${current ?? 'no tool'}\`, which takes only: ${inputs.join(', ') || 'nothing'}.`);
    }
  }

  const flow = [...new Set(mentions.map(([, toolName]) => toolName ?? '').filter((name) => tools.has(name)))];
  const [first] = flow;
  if (!first) return [...problems, `The MCP server bullet in ${README_PATH} names no tool from ${ROUTE}.`];
  const seed = SEEDS[first];
  if (!seed) return [...problems, `The MCP server bullet starts at \`${first}\`; add a seed for it to SEEDS in readme.test.ts.`];

  let tool = first;
  let body = await call(tool, seed);
  for (const nextTool of flow.slice(1)) {
    const args = argumentsFor(tool, body, nextTool);
    if (!args) {
      problems.push(`The MCP server bullet says to call \`${nextTool}\` after \`${tool}\`, but \`${tool}\`'s result gives no arguments for it.`);
      return problems;
    }
    tool = nextTool;
    body = await call(tool, args);
  }
  if (!hasExampleCode(body)) {
    const nextTools = [...new Set((body.nav?.next ?? []).map((next) => next.tool))].join(', ') || 'none';
    problems.push(
      `The MCP server bullet in ${README_PATH} ends its reading flow at \`${tool}\`, whose result has no example code ` +
        `(by default ${tool} returns example stubs). Name the tool that returns the code after it; its nav.next names: ${nextTools}.`,
    );
  }
  return problems;
}

describe('package README agent guide', () => {
  it('names only registered tools and their arguments, and its MCP flow reaches example code', async () => {
    expect(await readmeProblems(README)).toEqual([]);
  });

  it('rejects the pre-#520 guide that said get_docs_page returns example code', async () => {
    // packages/design-system/README.md at 069705de, before #520.
    const before520 =
      "- **MCP server:** `https://todae.omsoo.design/api/mcp` looks up Todae's components, recipes, tokens and the changes between releases, with no sign-in. In Claude Code, run `claude mcp add --transport http todae https://todae.omsoo.design/api/mcp`. Before writing code with a component, call the server's `get_docs_page` tool with the component's or hook's name, such as `Tooltip` or `useTooltip`: it returns the docs page with each example's code, which shows how the parts and hooks fit together. [MCP server](https://todae.omsoo.design/mcp) covers other clients and lists every tool.";
    const problems = await readmeProblems(before520);
    expect(problems).toHaveLength(1);
    expect(problems[0]).toContain('ends its reading flow at `get_docs_page`');
    expect(problems[0]).toContain('get_example');
  });

  it('rejects a tool name the route does not register', async () => {
    const problems = await readmeProblems(README.replace('`get_example`', '`get_examples`'));
    expect(problems.some((problem) => problem.includes('`get_examples`, which'))).toBe(true);
  });

  it('rejects an argument the tool does not take', async () => {
    const problems = await readmeProblems(README.replace('`includeCode: true`', '`withCode: true`'));
    expect(problems.some((problem) => problem.includes('passes `withCode` to `get_docs_page`'))).toBe(true);
  });

  it('rejects a flow whose steps the server does not chain', async () => {
    const problems = await readmeProblems(README.replace(MCP_BULLET, '- **MCP server:** Call `search_docs`, then `get_changes`.'));
    expect(problems).toEqual([expect.stringContaining('call `get_changes` after `search_docs`, but `search_docs`\'s result gives no arguments')]);
  });

  it('rejects a renamed first step, even with a verb no registered tool uses', async () => {
    const problems = await readmeProblems(README.replace('`search_docs`', '`find_docs`'));
    expect(problems.some((problem) => problem.includes('`find_docs`, which'))).toBe(true);
  });

  it('rejects a snake_case argument the tool does not take', async () => {
    const problems = await readmeProblems(README.replace('`includeCode: true`', '`include_code: true`'));
    expect(problems.some((problem) => problem.includes('passes `include_code` to `get_docs_page`'))).toBe(true);
  });

  it('reads the bullet across wrapped lines', async () => {
    const wrapped = README.replace(MCP_BULLET, (bullet) => bullet.replace(' Then call `get_example`', '\n  Then call `get_examples`'));
    expect(wrapped).not.toBe(README);
    const problems = await readmeProblems(wrapped);
    expect(problems.some((problem) => problem.includes('`get_examples`, which'))).toBe(true);
    expect(problems.some((problem) => problem.includes('ends its reading flow at `get_docs_page`'))).toBe(true);
  });
});
