// Fails a pull request that adds a docs page, a docs section or a check without changing both CLAUDE.md and
// the Claude verify skill (its SKILL.md or verify.mjs), unless its body has a line `Agent docs unchanged: <reason>`.
// Agents learn the repository from those files, so they have to grow with it.
// Usage: node .github/scripts/agent-docs.mjs [<base> [<head>]], from the repository root. The base defaults to
// origin/main and the head to HEAD; the diff starts at their merge base, as `git diff <base>...<head>` does.
// PR_BODY holds the pull request body. When GITHUB_STEP_SUMMARY is set, the result is written there too.
import { execFileSync } from 'node:child_process';
import { appendFileSync } from 'node:fs';
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

// The id of each group in SITE_GROUPS, the sidebar's sections: an `id` key of an object right inside the array,
// however the file is laid out. It walks the array's brackets, skipping strings and comments.
function sectionIds(text) {
  const declaration = text == null ? null : /export const SITE_GROUPS\b[^=]*=\s*\[/.exec(text);
  const ids = new Set();
  if (!declaration) return ids;
  let depth = 1;
  for (let at = declaration.index + declaration[0].length; at < text.length && depth > 0; at++) {
    const char = text[at];
    if (char === "'" || char === '"' || char === '`') {
      let end = at + 1;
      while (end < text.length && text[end] !== char) end += text[end] === '\\' ? 2 : 1;
      at = end;
    } else if (text.startsWith('//', at)) {
      at = text.indexOf('\n', at);
      if (at === -1) break;
    } else if (text.startsWith('/*', at)) {
      at = text.indexOf('*/', at);
      if (at === -1) break;
      at += 1;
    } else if ('[{('.includes(char)) {
      depth += 1;
    } else if (']})'.includes(char)) {
      depth -= 1;
    } else if (depth === 2 && /[{,]\s*$/.test(text.slice(Math.max(0, at - 200), at))) {
      const key = /^id\s*:\s*(['"])([^'"\n]+)\1/.exec(text.slice(at, at + 200));
      if (key) ids.add(key[2]);
    }
  }
  return ids;
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

// The docs routes, sections and checks at a commit, each as the line the report prints.
function inventory(ref) {
  const routes = git(['ls-tree', '-r', '-z', '--name-only', ref, '--', PAGES])
    .split('\0')
    .map(pageRoute)
    .filter((route) => route !== null);
  const workflows = git(['ls-tree', '-z', '--name-only', ref, WORKFLOWS])
    .split('\0')
    .filter((file) => /\.ya?ml$/.test(file));
  const sections = [...sectionIds(show(ref, SITE_GROUPS))].map((id) => `docs section ${id}`);
  return {
    pages: new Set(routes.map((route) => `docs page ${route}`)),
    sections: sections.length,
    others: new Set([
      ...sections,
      ...workflows.flatMap((file) => workflowChecks(file.slice(WORKFLOWS.length), show(ref, file))),
      ...checkScriptParts(show(ref, 'package.json')),
    ]),
  };
}

const minus = (a, b) => [...a].filter((item) => !b.has(item));

// What the diff adds, and whether it changes the files agents read. Pages count only when the diff adds more
// routes than it removes, so a page that moves, however much it changes on the way, isn't new. When the base has
// sections and the head shows none, the sidebar moved or changed its declaration, and the script has to learn it, or
// it would stop seeing new sections.
function review(base, head) {
  const mergeBase = git(['merge-base', base, head]).trim();
  const before = inventory(mergeBase);
  const after = inventory(head);
  const addedPages = minus(after.pages, before.pages);
  const pages = addedPages.length > minus(before.pages, after.pages).length ? addedPages : [];
  const changed = new Set(
    git(['-c', 'core.quotePath=false', 'diff', '-z', '--name-only', '--no-renames', '--diff-filter=AMT', mergeBase, head]).split('\0'),
  );
  const changes = (paths) => paths.some((path) => changed.has(path));
  return {
    added: [...pages, ...minus(after.others, before.others)],
    sectionsLost: before.sections > 0 && after.sections === 0,
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
    const reason = ESCAPE.exec(line.trim())?.[1];
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
  const { added, sectionsLost, claudeMd, verifySkill } = result;
  if (sectionsLost) {
    say(
      `agent-docs: ${SITE_GROUPS} shows no sections where this script looks for them, so it moved or SITE_GROUPS ` +
        'is no longer an exported array. Update sectionIds and SITE_GROUPS in .github/scripts/agent-docs.mjs to read ' +
        'it, so the check keeps seeing new sections.',
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
