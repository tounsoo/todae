import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { withExampleCode } from '../../../lib/exampleCode';
import { DOCS_ORIGIN } from '../../../lib/origin';
import { buildTokenFiles } from '../../../lib/docs-mcp/build';
import { getChanges } from '../../../lib/docs-mcp/changes';
import { resetPagesForTests } from '../../../lib/docs-mcp/catalog';
import { absolutize } from '../../../lib/docs-mcp/mdx';
import { scaffoldDesignSystem, type Oklch, type ScaffoldOptions } from '../../../lib/docs-mcp/scaffold';
import { listComponents } from '../../../lib/docs-mcp/tools';
import { catalogTokens } from '../../../lib/docs-mcp/tokens';

const { POST } = await import('./route');

const ENDPOINT = 'https://todae.local/api/mcp';
const MAX_RESPONSE_CHARS = 40_000;

function send(body: unknown): Promise<Response> {
  return POST(
    new Request(ENDPOINT, {
      method: 'POST',
      headers: { accept: 'application/json, text/event-stream', 'content-type': 'application/json' },
      body: JSON.stringify(body),
      duplex: 'half',
    } as RequestInit),
  );
}

let nextId = 1;

async function tool(name: string, args: Record<string, unknown>): Promise<{ error: string | null; body: Record<string, unknown> | null; raw: string }> {
  const response = await send({ jsonrpc: '2.0', id: nextId, method: 'tools/call', params: { name, arguments: args } });
  nextId += 1;
  expect(response.status).toBe(200);
  const raw = await response.text();
  const payload = raw.match(/"text":"((?:\\.|[^"\\])*)"/)?.[1];
  expect(payload, raw.slice(0, 400)).toBeTruthy();
  const decoded = JSON.parse(`"${payload}"`) as string;
  if (raw.includes('"isError":true') || decoded.startsWith('MCP error')) return { error: decoded, body: null, raw };
  return { error: null, body: JSON.parse(decoded) as Record<string, unknown>, raw: decoded };
}

function cursorOffset(body: Record<string, unknown>): number | undefined {
  const cursor = body.cursor;
  if (!cursor || typeof cursor !== 'object' || !('offset' in cursor)) return undefined;
  return typeof cursor.offset === 'number' ? cursor.offset : undefined;
}

describe('route regressions', () => {
  it('returns token rows from list_tokens, not a character count', async () => {
    const { error, body } = await tool('list_tokens', { prefix: 'color.accent' });
    expect(error).toBeNull();
    const tokens = body?.tokens;
    expect(Array.isArray(tokens)).toBe(true);
    if (!Array.isArray(tokens)) return;
    expect(tokens.length).toBeGreaterThan(0);
    expect(tokens.every((row) => typeof row === 'object' && row && 'path' in row && String(row.path).startsWith('color.accent'))).toBe(true);
  });

  it('walks list_components, get_changes and scaffold_design_system back to the full payload', async () => {
    const components: unknown[] = [];
    let componentOffset = 0;
    for (let step = 0; step < 20; step += 1) {
      const { error, body, raw } = await tool('list_components', { offset: componentOffset });
      expect(error).toBeNull();
      expect(raw.length).toBeLessThanOrEqual(MAX_RESPONSE_CHARS);
      if (!body || !Array.isArray(body.components)) throw new Error('expected components');
      components.push(...body.components);
      const next = cursorOffset(body);
      if (next === undefined) break;
      expect(next).toBeGreaterThan(componentOffset);
      componentOffset = next;
    }
    expect(components).toEqual(listComponents().components);

    for (const from of ['0.1.0', '0.2.0']) {
      const releases: unknown[] = [];
      let offset = 0;
      for (let step = 0; step < 30; step += 1) {
        const { error, body, raw } = await tool('get_changes', { from, offset });
        expect(error).toBeNull();
        expect(raw.length).toBeLessThanOrEqual(MAX_RESPONSE_CHARS);
        if (!body || !Array.isArray(body.releases)) throw new Error('expected releases');
        releases.push(...body.releases);
        const next = cursorOffset(body);
        if (next === undefined) break;
        expect(next).toBeGreaterThan(offset);
        offset = next;
      }
      expect(releases).toEqual(getChanges({ from }).releases);
    }

    const paths = catalogTokens()
      .filter((row) => row.layer === 'appearance' && row.type === 'color')
      .map((row) => row.path);
    const channel: Oklch = [0.5, 0.1, 200];
    const colors = Object.fromEntries(paths.map((path) => [path, channel]));
    const options: ScaffoldOptions = {
      name: 'acme',
      colors: { light: colors, dark: colors },
      buttonVariants: ['v1', 'v2', 'v3', 'v4', 'v5', 'v6', 'v7', 'v8'],
      densities: ['d1', 'd2', 'd3', 'd4', 'd5', 'd6', 'd7', 'd8'],
    };
    const drafted = await scaffoldDesignSystem(options);
    const tokenFiles: Record<string, string> = {};
    const otherFiles: { path: string; contents: string }[] = [];
    let buildError = '';
    let continuedInFile = false;
    let fileOffset = 0;
    let char = 0;
    let args: Record<string, unknown> = { ...options };
    for (let step = 0; step < 80; step += 1) {
      const { error, body, raw } = await tool('scaffold_design_system', args);
      expect(error).toBeNull();
      expect(raw.length).toBeLessThanOrEqual(MAX_RESPONSE_CHARS);
      const file = body?.file as { group?: string; path?: string; contents?: string } | undefined;
      if (file?.group === 'tokenFiles' && file.path && typeof file.contents === 'string') tokenFiles[file.path] = (tokenFiles[file.path] ?? '') + file.contents;
      if (file?.group === 'otherFiles' && file.path && typeof file.contents === 'string') {
        const existing = otherFiles.find((item) => item.path === file.path);
        if (existing) existing.contents += file.contents;
        else otherFiles.push({ path: file.path, contents: file.contents });
      }
      if (file?.group === 'build' && file.path === 'build-error' && typeof file.contents === 'string') buildError += file.contents;
      const cursor = body?.cursor as { offset?: number; char?: number } | undefined;
      if (cursor && typeof cursor.char === 'number' && cursor.offset === fileOffset) continuedInFile = true;
      const suggestion = (body?.nav as { next?: { tool?: string; arguments?: Record<string, unknown> }[] } | undefined)?.next?.[0];
      if (!cursor) break;
      expect(suggestion?.tool).toBe('scaffold_design_system');
      const next = cursor.offset ?? fileOffset;
      const nextChar = cursor.char ?? 0;
      expect(suggestion?.arguments).toMatchObject({ name: 'acme', offset: next, char: nextChar });
      expect(next > fileOffset || nextChar > char).toBe(true);
      fileOffset = next;
      char = nextChar;
      args = suggestion?.arguments ?? {};
    }
    expect(tokenFiles).toEqual(drafted.tokenFiles);
    expect(otherFiles).toEqual(drafted.otherFiles);
    expect(drafted.build.ok).toBe(false);
    if (!drafted.build.ok) {
      expect(continuedInFile).toBe(true);
      expect(buildError).toBe(drafted.build.error);
    }
  }, 120_000);

  it('returns a small scaffold in the library shape', async () => {
    const drafted = await scaffoldDesignSystem({ name: 'acme' });
    const { error, body } = await tool('scaffold_design_system', { name: 'acme' });
    expect(error).toBeNull();
    if (!body) throw new Error('expected a scaffold');
    const { nav, ...rest } = body;
    expect(nav).toBeTruthy();
    expect(rest).toEqual(drafted);
  }, 60_000);

  it('pages list_tokens with no arguments and walks every catalog row', async () => {
    const capped = await tool('list_tokens', { limit: 500 });
    expect(capped.error).toBeNull();
    expect(Array.isArray(capped.body?.tokens)).toBe(true);
    expect((capped.body?.tokens as unknown[] | undefined)?.length).toBeGreaterThan(0);
    expect(capped.raw.length).toBeLessThanOrEqual(MAX_RESPONSE_CHARS);

    const rows: unknown[] = [];
    let offset = 0;
    for (let step = 0; step < 40; step += 1) {
      const { error, body, raw } = await tool('list_tokens', offset === 0 ? {} : { offset });
      expect(error).toBeNull();
      expect(raw.length).toBeLessThanOrEqual(MAX_RESPONSE_CHARS);
      if (!body || !Array.isArray(body.tokens)) throw new Error('expected tokens');
      expect(body.tokens.length).toBeGreaterThan(0);
      rows.push(...body.tokens);
      const next = body.cursor as { offset?: number } | undefined;
      const navNext = (body.nav as { next?: { tool?: string; arguments?: { offset?: number } }[] } | undefined)?.next?.[0];
      if (next?.offset === undefined) {
        expect(navNext?.tool).toBe('get_token');
        break;
      }
      expect(navNext?.tool).toBe('list_tokens');
      expect(navNext?.arguments?.offset).toBe(next.offset);
      expect(next.offset).toBeGreaterThan(offset);
      offset = next.offset;
    }
    expect(rows).toEqual([...catalogTokens()]);
  });

  it('walks a build of 4,000 short CSS lines back to the original, and refuses to skip the budget', async () => {
    const outline = JSON.parse(readFileSync(join(process.cwd(), '..', '..', 'packages', 'design-system', 'scripts', '__fixtures__', 'acme', 'button.outline.json'), 'utf8')) as {
      button: { outline: unknown };
    };
    const files: Record<string, unknown> = {};
    const contexts: Record<string, { $ref: string }[]> = {};
    for (let i = 0; i < 22; i += 1) {
      const name = `v${i}`;
      const body = JSON.parse(JSON.stringify(outline).replaceAll('"outline"', `"${name}"`)) as unknown;
      files[`button.${name}.json`] = body;
      contexts[name] = [{ $ref: `./button.${name}.json` }];
    }
    files['resolver.json'] = {
      $schema: 'https://www.designtokens.org/schemas/2025.10/resolver.json',
      name: 'wide',
      version: '2025.10',
      sets: {},
      modifiers: {
        buttonVariant: {
          contexts,
          $extensions: { 'dev.todae': { layer: 'contract', attribute: 'data-button-variant', alias: true } },
        },
      },
      resolutionOrder: [{ $ref: '#/modifiers/buttonVariant' }],
    };
    const full = await buildTokenFiles(files, { scope: '.wide' });
    expect(full.ok).toBe(true);
    if (!full.ok) return;
    const lines = full.css.split('\n');
    expect(lines.length).toBeGreaterThanOrEqual(4_000);
    expect(Math.max(...lines.map((line) => line.length))).toBeLessThan(200);

    let cursor: { field?: 'css' | 'overrideTypes'; offset?: number } | undefined;
    let css = '';
    let types = '';
    for (let step = 0; step < 40; step += 1) {
      const args: Record<string, unknown> = { files, scope: '.wide' };
      if (cursor?.offset) {
        args.offset = cursor.offset;
        if (cursor.field) args.field = cursor.field;
      }
      const { error, body, raw } = await tool('build_tokens', args);
      expect(error).toBeNull();
      expect(raw.length).toBeLessThanOrEqual(MAX_RESPONSE_CHARS);
      if (!body) throw new Error('expected a build');
      expect(body.kind).not.toBe('over-budget');
      css += typeof body.css === 'string' ? body.css : '';
      types += typeof body.overrideTypes === 'string' ? body.overrideTypes : '';
      const next = body.cursor as { field?: 'css' | 'overrideTypes'; offset?: number } | undefined;
      if (!next) {
        cursor = undefined;
        break;
      }
      expect(next.offset).toBeGreaterThan(cursor?.offset ?? 0);
      cursor = next;
    }
    expect(cursor).toBeUndefined();
    expect(css).toBe(full.css);
    expect(types).toBe(full.overrideTypes);
  }, 120_000);

  it('walks an inlined scheduler page to the whole page', async () => {
    const file = join(process.cwd(), 'app', '(en)', 'recipes', 'scheduler', 'page.mdx');
    const whole = absolutize(withExampleCode(file, readFileSync(file, 'utf8')));
    let offset = 0;
    let markdown = '';
    for (let step = 0; step < 12; step += 1) {
      const { error, body, raw } = await tool('get_docs_page', { name: 'recipes/scheduler', includeCode: true, offset });
      expect(error).toBeNull();
      expect(raw.length).toBeLessThanOrEqual(MAX_RESPONSE_CHARS);
      if (!body || typeof body.markdown !== 'string') throw new Error('expected markdown');
      markdown += body.markdown;
      const next = cursorOffset(body);
      if (next === undefined) break;
      expect(next).toBeGreaterThan(offset);
      offset = next;
    }
    expect(markdown).toBe(whole);
  });

  it('suggests calendar for the typo calender on the page, the component and when to use', async () => {
    for (const name of ['get_docs_page', 'get_component', 'when_to_use'] as const) {
      const args = name === 'get_docs_page' ? { name: 'calender' } : { name: 'calender' };
      const { error, body } = await tool(name, args);
      expect(body).toBeNull();
      expect(error).toMatch(/calendar/i);
    }
  });

  it('returns no Korean page for a Hangul query', async () => {
    let empty = 0;
    for (const query of ['끌기', '버튼', '세션을 다른 무대로 끌기', '캘린더에서 공휴일 비활성화']) {
      const { error, body } = await tool('search_docs', { query });
      expect(error, query).toBeNull();
      const hits = (body?.hits ?? []) as { ref?: string; title?: string; snippet?: string }[];
      for (const hit of hits) {
        expect(`${hit.ref ?? ''} ${hit.title ?? ''} ${hit.snippet ?? ''}`, query).not.toMatch(/\p{Script=Hangul}/u);
      }
      if (hits.length === 0) {
        empty += 1;
        const next = (body?.nav as { next?: { tool?: string }[] } | undefined)?.next ?? [];
        expect(next.some((call) => call.tool === 'list_components'), query).toBe(false);
        expect(JSON.stringify(body), query).toContain('Search in English');
      }
    }
    expect(empty).toBeGreaterThan(0);
  });

  it('reads the English section for a Korean anchor on a ko path', async () => {
    const cases = [
      { name: `${DOCS_ORIGIN}/ko/calendar#범위와-로캘`, slug: 'calendar', anchor: 'range-and-locale' },
      { name: 'ko/recipes/scheduler#끌기', slug: 'recipes/scheduler', anchor: 'dragging' },
    ];
    for (const item of cases) {
      const { error, body } = await tool('get_docs_page', { name: item.name });
      expect(error, item.name).toBeNull();
      expect(body?.slug, item.name).toBe(item.slug);
      expect(body?.anchor, item.name).toBe(item.anchor);
      expect(JSON.stringify(body), item.name).not.toMatch(/\p{Script=Hangul}/u);
    }
  });

  it('returns the English page when a Korean anchor does not line up', async () => {
    const { error, body } = await tool('get_docs_page', { name: 'ko/calendar#없는-섹션' });
    expect(error).toBeNull();
    expect(body?.slug).toBe('calendar');
    expect(['page', 'outline']).toContain(body?.kind);
    expect(JSON.stringify(body)).not.toMatch(/\p{Script=Hangul}/u);
  });

  it('suggests get_example for an example file name', async () => {
    const { error, body } = await tool('search_docs', { query: 'SchedulerExample.tsx' });
    expect(error).toBeNull();
    const next = (body?.nav as { next?: { tool?: string; arguments?: Record<string, unknown> }[] } | undefined)?.next?.[0];
    expect(next?.tool).toBe('get_example');
    expect(next?.arguments).toMatchObject({ page: 'recipes/scheduler', file: 'SchedulerExample.tsx' });
  });

  it('keeps the MCP manual out of the top 3 when the question is about reading a section', async () => {
    const { error, body } = await tool('search_docs', { query: 'read one section of a page' });
    expect(error).toBeNull();
    const hits = (body?.hits ?? []) as { ref?: string }[];
    expect(hits.slice(0, 3).some((hit) => (hit.ref ?? '') === 'mcp' || (hit.ref ?? '').startsWith('mcp#'))).toBe(false);
  });

  it('keeps the MCP manual off a product question and opens it when the question names it', async () => {
    const product = await tool('search_docs', { query: 'drag a talk to another stage on the scheduler' });
    expect(product.error).toBeNull();
    const hits = (product.body?.hits ?? []) as { ref?: string }[];
    expect(hits.some((hit) => (hit.ref ?? '') === 'mcp' || (hit.ref ?? '').startsWith('mcp#'))).toBe(false);
    expect(hits[0]?.ref ?? '').toContain('scheduler');
    const manual = await tool('search_docs', { query: 'mcp' });
    expect(manual.error).toBeNull();
    expect(((manual.body?.hits ?? []) as { ref?: string }[])[0]?.ref).toBe('mcp');
  });

  it('ranks the date predicate ahead of the disabled flag for a holiday and weekend question', async () => {
    const { error, body } = await tool('search_docs', { query: 'disable weekends and holidays in the calendar' });
    expect(error).toBeNull();
    const first = (body?.hits as { title?: string }[] | undefined)?.[0];
    expect(first?.title ?? '').toContain('isDateDisabled');
  });

  it('lands the first call on the scheduler, the wizard and held-out queries', async () => {
    const tasks = [
      { query: 'multi-step wizard', want: 'recipes/wizard' },
      { query: 'holiday the calendar refuses to pick', want: 'Calendar' },
      { query: 'carry a session from one stage to another', want: 'recipes/scheduler' },
      { query: 'wizard recipe for a multi page flow', want: 'recipes/wizard' },
    ];
    for (const task of tasks) {
      const { error, body } = await tool('search_docs', { query: task.query });
      expect(error).toBeNull();
      const nav = body?.nav as { next?: { arguments?: Record<string, unknown> }[] } | undefined;
      const landed = JSON.stringify(nav?.next?.[0]?.arguments ?? {});
      expect(landed, task.query).toContain(task.want);
    }
  });

  it('reads the !important section, a preview URL, and a page without its import lines', async () => {
    for (const name of ['guides/css-layers', 'ko/guides/css-layers', 'https://preview.example/ko/guides/css-layers']) {
      const { error, body } = await tool('get_docs_page', { name, section: 'important' });
      expect(error, name).toBeNull();
      expect(body?.kind).toBe('section');
      expect(body?.locale).toBe('en');
      expect(body?.slug).toBe('guides/css-layers');
      const markdown = String(body?.markdown ?? '');
      expect(markdown).toContain('reverses the layer order');
      expect(markdown).not.toContain('레이어 순서를 뒤집습니다');
    }
    const preview = await tool('get_docs_page', { name: 'https://preview.example/tooltip' });
    expect(preview.error).toBeNull();
    expect(preview.body?.slug).toBe('tooltip');
    const page = await tool('get_docs_page', { name: 'recipes/scheduler' });
    expect(page.error).toBeNull();
    expect(String(page.body?.markdown ?? '')).not.toMatch(/^(import|export)\b/m);
  });

  it('returns the stylesheet and the sibling module from the same example', async () => {
    process.env.TODAE_DOCS_MCP_FIXTURE = '1';
    resetPagesForTests();
    try {
      const sheet = await tool('get_example', { page: 'paired', file: 'EventCalendar.module.css' });
      expect(sheet.error).toBeNull();
      expect(sheet.body?.code).toContain('canvastext');
      expect(String(sheet.body?.code ?? '')).not.toContain('lanegrid');
      expect(String(sheet.body?.code ?? '')).not.toContain('every week');
      const lane = await tool('get_example', { page: 'paired', file: 'Lane.module.css' });
      expect(lane.error).toBeNull();
      expect(lane.body?.code).toContain('lanegrid');
      expect(String(lane.body?.code ?? '')).not.toContain('every week');
      const script = await tool('get_example', { page: 'paired', file: 'recurrence.ts' });
      expect(script.error).toBeNull();
      expect(script.body?.code).toContain('every week');
    } finally {
      delete process.env.TODAE_DOCS_MCP_FIXTURE;
      resetPagesForTests();
    }
  });
});
