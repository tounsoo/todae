import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

// The package README tells agents which docs MCP tools to call, in what order. This test reads that
// guide and walks it against the tools this route registers, so the README can't drift from them.
const { POST } = await import('./route');

const README_PATH = 'packages/design-system/README.md';
const README = readFileSync(new URL('../../../../../packages/design-system/README.md', import.meta.url), 'utf8');
const ROUTE = 'apps/docs/app/api/[transport]/route.ts';
const MCP_BULLET = /^- \*\*MCP server:\*\*.*$/m;
const TOOL_NAME = /`([a-z]+(?:_[a-z]+)+)`/g;

/** The first call for a guide that starts at this tool. */
const SEEDS: Record<string, Record<string, unknown>> = {
  search_docs: { query: 'tooltip' },
  get_docs_page: { name: 'Tooltip' },
  get_component: { name: 'Tooltip' },
};

type Body = Record<string, unknown> & { nav?: { next?: { tool: string; arguments: Record<string, unknown> }[] } };

let nextId = 1;

async function rpc(method: string, params: unknown): Promise<string> {
  const response = await POST(
    new Request('https://todae.local/api/mcp', {
      method: 'POST',
      headers: { accept: 'application/json, text/event-stream', 'content-type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: nextId++, method, params }),
      duplex: 'half',
    } as RequestInit),
  );
  return response.text();
}

async function registeredTools(): Promise<Set<string>> {
  const text = await rpc('tools/list', {});
  return new Set([...text.matchAll(/"name":"([a-z_]+)"/g)].map((match) => match[1] ?? ''));
}

async function call(name: string, args: Record<string, unknown>): Promise<Body> {
  const raw = await rpc('tools/call', { name, arguments: args });
  const payload = raw.match(/"text":"((?:\\.|[^"\\])*)"/)?.[1];
  if (!payload) throw new Error(`${name} returned no text: ${raw.slice(0, 200)}`);
  const decoded = JSON.parse(`"${payload}"`) as string;
  if (raw.includes('"isError":true')) throw new Error(`${name}(${JSON.stringify(args)}) failed: ${decoded}`);
  return JSON.parse(decoded) as Body;
}

/** True when a result carries example source, not only example stubs. */
function hasExampleCode(body: Body): boolean {
  if (body.kind === 'example' && typeof body.code === 'string') return true;
  const examples = body.examples;
  return Array.isArray(examples) && examples.some((example) => typeof (example as { code?: unknown }).code === 'string');
}

/** The arguments the previous result gives for a call to `tool`, the way the README says to pass them. */
function argumentsFor(previousTool: string, previous: Body, tool: string): Record<string, unknown> | undefined {
  const named = previous.nav?.next?.find((next) => next.tool === tool);
  if (named) return named.arguments;
  // The README passes a hit's ref to get_docs_page; nav.next names only the top hit's call.
  if (previousTool === 'search_docs' && tool === 'get_docs_page' && Array.isArray(previous.hits)) {
    const hit = (previous.hits as { kind?: string; ref?: string }[]).find((row) => row.kind === 'page' || row.kind === 'section');
    if (hit?.ref) return { name: hit.ref };
  }
  return undefined;
}

/**
 * Problems with a README's agent guide: tools it names that the route does not register, and a reading
 * flow (the tools in the MCP server bullet, in order) that does not reach example code.
 */
async function readmeProblems(readme: string): Promise<string[]> {
  const tools = await registeredTools();
  const problems: string[] = [];
  for (const [, name] of readme.matchAll(TOOL_NAME)) {
    if (name && !tools.has(name)) problems.push(`${README_PATH} names \`${name}\`, which ${ROUTE} does not register.`);
  }
  const bullet = readme.match(MCP_BULLET)?.[0];
  if (!bullet) return [...problems, `${README_PATH} has no "- **MCP server:**" bullet to guide agents.`];
  const flow = [...new Set([...bullet.matchAll(TOOL_NAME)].map((match) => match[1] ?? ''))].filter((name) => tools.has(name));
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
    const codeTools = [...new Set((body.nav?.next ?? []).map((next) => next.tool))].join(', ') || 'none';
    problems.push(
      `The MCP server bullet in ${README_PATH} ends its reading flow at \`${tool}\`, whose result has no example code ` +
        `(by default ${tool} returns example stubs). Name the tool that returns the code after it; its nav.next names: ${codeTools}.`,
    );
  }
  return problems;
}

describe('package README agent guide', () => {
  it('names only registered tools, and its MCP flow reaches example code', async () => {
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
    const renamed = README.replace('`get_example`', '`get_examples`');
    const problems = await readmeProblems(renamed);
    expect(problems.some((problem) => problem.includes('`get_examples`, which'))).toBe(true);
  });

  it('rejects a flow whose steps the server does not chain', async () => {
    const swapped = README.replace(MCP_BULLET, '- **MCP server:** Call `get_example`, then `search_docs`.');
    const problems = await readmeProblems(swapped);
    expect(problems.join('\n')).toMatch(/SEEDS|gives no arguments/);
  });
});
