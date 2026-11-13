// Fails a pull request that adds a docs page, a docs section or a check without changing both CLAUDE.md and
// the Claude verify skill (its SKILL.md or verify.mjs), unless its body has a line `Agent docs unchanged: <reason>`.
// Agents learn the repository from those files, so they have to grow with it.
// Usage: node .github/scripts/agent-docs.mjs [<base> [<head>]], from the repository root. The base defaults to
// origin/main and the head to HEAD; the diff starts at their merge base, as `git diff <base>...<head>` does.
// PR_BODY holds the pull request body. When GITHUB_STEP_SUMMARY is set, the result is written there too.
import { execFileSync } from 'node:child_process';
import { appendFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { fromMarkdown } from 'mdast-util-from-markdown';
import { parse } from 'yaml';

const PAGES = 'apps/docs/app/(en)';
const PAGE = /^apps\/docs\/app\/\(en\)\/(?:(.+)\/)?page\.(?:mdx?|[jt]sx?)$/;
const SITE_GROUPS = 'apps/docs/components/siteGroups.ts';
const WORKFLOWS = '.github/workflows/';
const AGENT_DOCS = { claude: ['CLAUDE.md'], verify: ['.claude/skills/verify/SKILL.md', '.claude/skills/verify/verify.mjs'] };
const ESCAPE = /^Agent docs unchanged:[ \t]*(\S.*?)$/;

const git = (args, stderr = 'inherit') =>
  execFileSync('git', args, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, stdio: ['ignore', 'pipe', stderr] });

// The file at a commit, or null when it isn't there.
function show(ref, path) {
  try {
    return git(['show', `${ref}:${path}`], 'ignore');
  } catch {
    return null;
  }
}

// The route a page file under app/(en) serves, with route groups such as (marketing) left out.
function pageRoute(path) {
  const match = PAGE.exec(path);
  if (!match) return null;
  const segments = (match[1] ?? '').split('/').filter((segment) => segment && !/^\(.*\)$/.test(segment));
  return `/${segments.join('/')}`;
}

// What the parser gives for an expression, with `as` and `satisfies` taken off.
function bare(node) {
  const wrappers = ['TSAsExpression', 'TSSatisfiesExpression', 'TSTypeAssertion', 'TSNonNullExpression'];
  return wrappers.includes(node?.type) ? bare(node.expression) : node;
}

// The id of each group in the exported SITE_GROUPS array, the sidebar's sections, read with the TypeScript parser.
// A group that isn't an object with an id written as a plain string, such as a spread, a constant or a call, is
// counted as unread, since it could hide a new section. `found` says whether the array is there at all. The parser
// takes about a second to load, so it loads only for a pull request that changes the file.
function sectionIds(text) {
  const ids = new Set();
  let unread = 0;
  if (text == null) return { ids, unread, found: false };
  let program;
  try {
    program = createRequire(import.meta.url)('typescript-eslint').parser.parseForESLint(text).ast;
  } catch (error) {
    throw new Error(`${SITE_GROUPS} is not valid TypeScript: ${error.message}`, { cause: error });
  }
  const array = bare(
    program.body
      .filter((node) => node.type === 'ExportNamedDeclaration' && node.declaration?.type === 'VariableDeclaration')
      .flatMap((node) => node.declaration.declarations)
      .find((declarator) => declarator.id.type === 'Identifier' && declarator.id.name === 'SITE_GROUPS')?.init,
  );
  if (array?.type !== 'ArrayExpression') return { ids, unread, found: false };
  for (const element of array.elements) {
    const group = bare(element);
    const property =
      group?.type === 'ObjectExpression'
        ? group.properties.find(
            (item) => item.type === 'Property' && !item.computed && (item.key.name ?? item.key.value) === 'id',
          )
        : null;
    const value = bare(property?.value);
    const id =
      value?.type === 'Literal' && typeof value.value === 'string'
        ? value.value
        : value?.type === 'TemplateLiteral' && value.expressions.length === 0
          ? value.quasis[0].value.cooked
          : null;
    if (id === null) unread += 1;
    else ids.add(id);
  }
  return { ids, unread, found: true };
}

function triggersOnPullRequests(on) {
  const events = typeof on === 'string' ? [on] : Array.isArray(on) ? on : Object.keys(on ?? {});
  return events.some((event) => event === 'pull_request' || event === 'pull_request_target');
}

// Each job, and each step that runs a command, in a workflow that pull requests start. A step is known by its name,
// or by its command when it has none, across every such workflow, so a step copied into another job or workflow
// isn't new. Steps that only use an action, such as checkout or a cache, aren't checks.
function workflowChecks(file, text) {
  if (text == null) return [];
  let workflow;
  try {
    workflow = parse(text);
  } catch (error) {
    throw new Error(`${WORKFLOWS}${file} is not valid YAML: ${error.message}`, { cause: error });
  }
  if (!workflow || !triggersOnPullRequests(workflow.on)) return [];
  const checks = [];
  for (const [id, job] of Object.entries(workflow.jobs ?? {})) {
    checks.push(`check ${file}: job ${id}`);
    for (const step of job?.steps ?? []) {
      if (typeof step?.run !== 'string') continue;
      checks.push(`check step ${step.name ? `"${step.name}"` : `\`${step.run.trim()}\``}`);
    }
  }
  return checks;
}

// Each command that the root `pnpm check` chains.
function checkScriptParts(text) {
  if (text == null) return [];
  let manifest;
  try {
    manifest = JSON.parse(text);
  } catch (error) {
    throw new Error(`package.json is not valid JSON: ${error.message}`, { cause: error });
  }
  const script = manifest.scripts?.check;
  if (typeof script !== 'string') return [];
  return script
    .split('&&')
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => `check \`pnpm check\` runs \`${part}\``);
}

// The docs routes, sections and checks at a commit, each as the line the report prints. Sections are read only when
// asked, since an unchanged sidebar can't add, hide or lose one.
function inventory(ref, withSections) {
  const routes = git(['ls-tree', '-r', '-z', '--name-only', ref, '--', PAGES])
    .split('\0')
    .map(pageRoute)
    .filter((route) => route !== null);
  const workflows = git(['ls-tree', '-z', '--name-only', ref, WORKFLOWS])
    .split('\0')
    .filter((file) => /\.ya?ml$/.test(file));
  const sidebar = withSections ? sectionIds(show(ref, SITE_GROUPS)) : { ids: new Set(), unread: 0, found: true };
  const sections = [...sidebar.ids].map((id) => `docs section ${id}`);
  return {
    pages: new Set(routes.map((route) => `docs page ${route}`)),
    sidebar,
    others: new Set([
      ...sections,
      ...workflows.flatMap((file) => workflowChecks(file.slice(WORKFLOWS.length), show(ref, file))),
      ...checkScriptParts(show(ref, 'package.json')),
    ]),
  };
}

const minus = (a, b) => [...a].filter((item) => !b.has(item));

// What the diff adds, and whether it changes the files agents read. Pages count only when the diff adds more
// routes than it removes, so a page that moves, however much it changes on the way, isn't new. The sidebar is
// unreadable when a group at the head has no id the script can read, or when the base has sections and the head has
// no exported SITE_GROUPS array, because it moved or changed its declaration. Either would hide a new section.
function review(base, head) {
  const mergeBase = git(['merge-base', base, head]).trim();
  const blob = (ref) => {
    try {
      return git(['rev-parse', `${ref}:${SITE_GROUPS}`], 'ignore').trim();
    } catch {
      return null;
    }
  };
  const sidebarChanged = blob(mergeBase) !== blob(head);
  const before = inventory(mergeBase, sidebarChanged);
  const after = inventory(head, sidebarChanged);
  const addedPages = minus(after.pages, before.pages);
  const pages = addedPages.length > minus(before.pages, after.pages).length ? addedPages : [];
  const changed = new Set(
    git(['-c', 'core.quotePath=false', 'diff', '-z', '--name-only', '--no-renames', '--diff-filter=AMT', mergeBase, head]).split('\0'),
  );
  const changes = (paths) => paths.some((path) => changed.has(path));
  return {
    added: [...pages, ...minus(after.others, before.others)],
    unreadGroups: after.sidebar.unread,
    sidebarLost: before.sidebar.ids.size > 0 && !after.sidebar.found,
    claudeMd: changes(AGENT_DOCS.claude),
    verifySkill: changes(AGENT_DOCS.verify),
  };
}

// The reason a body gives for leaving the agent docs as they are, or null. The body is read as Markdown, so only text
// that shows on the pull request counts: a line in a code block or an HTML comment doesn't. The first line of shown
// text that starts with the label and gives a reason counts, as in a paragraph, a list item, a quote or a heading,
// and a placeholder such as <reason>, or a reason with no word in it, doesn't.
function escapeReason(body) {
  const shown = (node) => {
    if (node.type === 'code') return '';
    if (node.type === 'html') return node.value.replace(/<!--[\s\S]*?(?:-->|$)/g, '').replace(/<[^>]*>/g, '');
    if (node.type === 'inlineCode') return `\`${node.value}\``;
    if (node.type === 'break') return '\n';
    if ('value' in node) return node.value;
    const blocks = ['root', 'blockquote', 'list', 'listItem'].includes(node.type);
    return (node.children ?? []).map(shown).join(blocks ? '\n' : '');
  };
  for (const line of shown(fromMarkdown(body ?? '')).split('\n')) {
    // GitHub shows a task-list item's box, which the parser reads as text.
    const reason = ESCAPE.exec(line.trim().replace(/^\[[ xX]\][ \t]+/, ''))?.[1];
    if (reason && /[\p{L}\p{N}]/u.test(reason) && !/^\W*<[^>]*>\W*$/.test(reason)) return reason;
  }
  return null;
}

function main() {
  const [base = 'origin/main', head = 'HEAD'] = process.argv.slice(2);
  const lines = [];
  const say = (line) => {
    lines.push(line);
    console.log(line);
  };
  let status = 0;
  let result;
  try {
    result = review(base, head);
  } catch (error) {
    say(`agent-docs: ${error.message}`);
    if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, `${lines.join('\n')}\n`);
    return 1;
  }
  const { added, unreadGroups, sidebarLost, claudeMd, verifySkill } = result;
  if (unreadGroups > 0) {
    say(
      `agent-docs: ${unreadGroups === 1 ? '1 entry' : `${unreadGroups} entries`} in SITE_GROUPS in ${SITE_GROUPS} ` +
        `${unreadGroups === 1 ? 'is' : 'are'} not an object with an id ` +
        "written as a plain string, such as { id: 'recipes', ... }. Write each group that way, so the check keeps " +
        'seeing new sections.',
    );
    status = 1;
  } else if (sidebarLost) {
    say(
      `agent-docs: ${SITE_GROUPS} has no exported SITE_GROUPS array, so it moved or changed its declaration. Update ` +
        'sectionIds and SITE_GROUPS in .github/scripts/agent-docs.mjs to read it, so the check keeps seeing new ' +
        'sections.',
    );
    status = 1;
  } else if (added.length === 0) {
    say('agent-docs: this pull request adds no docs page, docs section or check.');
  } else {
    say('agent-docs: this pull request adds:');
    // An unnamed step whose command has more than one line shows its first line.
    for (const item of added) say(`  - ${item.replace(/\n[\s\S]*`$/, ' …`')}`);
    const reason = escapeReason(process.env.PR_BODY);
    if (claudeMd && verifySkill) {
      say('agent-docs: it changes CLAUDE.md and the verify skill too.');
    } else if (reason) {
      say(`agent-docs: its body says why the agent docs stay as they are: ${reason}`);
    } else {
      const missing = [!claudeMd && 'CLAUDE.md', !verifySkill && 'the verify skill (.claude/skills/verify/SKILL.md or verify.mjs)'];
      say(
        `agent-docs: change ${missing.filter(Boolean).join(' and ')} in this pull request too, so agents know what it ` +
          'adds. Where one or both need no change, add a line "Agent docs unchanged: <reason>" ' +
          'to the pull request body, with the reason in place of <reason>, outside any HTML comment or code block, ' +
          'then re-run this job.' +
          (process.env.PR_BODY === undefined ? ' For a run outside CI, set PR_BODY to that body.' : ''),
      );
      status = 1;
    }
  }
  if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, `${lines.join('\n')}\n`);
  return status;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) process.exitCode = main();
