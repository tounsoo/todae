// Fails a pull request that adds a docs page, a docs section or a check without changing both CLAUDE.md and
// the Claude verify skill (its SKILL.md or verify.mjs), unless its body has a line `Agent docs unchanged: <reason>`.
// Agents learn the repository from those files, so they have to grow with it.
// Usage: node .github/scripts/agent-docs.mjs [<base> [<head>]], from the repository root. The base defaults to
// origin/main and the head to HEAD; the diff starts at their merge base, as `git diff <base>...<head>` does.
// PR_BODY holds the pull request body. When GITHUB_STEP_SUMMARY is set, the result is written there too.
import { execFileSync } from 'node:child_process';
import { appendFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { parse } from 'yaml';

const PAGES = 'apps/docs/app/(en)';
const PAGE = /^apps\/docs\/app\/\(en\)\/(?:(.+)\/)?page\.(?:mdx?|[jt]sx?)$/;
const SITE_GROUPS = 'apps/docs/components/siteGroups.ts';
const WORKFLOWS = '.github/workflows/';
const AGENT_DOCS = { claude: ['CLAUDE.md'], verify: ['.claude/skills/verify/SKILL.md', '.claude/skills/verify/verify.mjs'] };
const ESCAPE = /^[ \t]*Agent docs unchanged:[ \t]*(\S.*?)[ \t\r]*$/m;

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

// The id of each group in SITE_GROUPS, the sidebar's sections. A group's id sits one level inside the array.
function sectionIds(text) {
  const start = text?.indexOf('export const SITE_GROUPS = [') ?? -1;
  if (start === -1) return new Set();
  const end = text.indexOf('\n]', start);
  const groups = text.slice(start, end === -1 ? undefined : end);
  return new Set([...groups.matchAll(/^ {4}id: ['"]([^'"]+)['"]/gm)].map((match) => match[1]));
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
    throw new Error(`${WORKFLOWS}${file} is not valid YAML: ${error.message}`);
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
    throw new Error(`package.json is not valid JSON: ${error.message}`);
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
  const workflows = git(['ls-tree', '--name-only', ref, WORKFLOWS])
    .split('\n')
    .filter((file) => /\.ya?ml$/.test(file));
  return {
    pages: new Set(routes.map((route) => `docs page ${route}`)),
    others: new Set([
      ...[...sectionIds(show(ref, SITE_GROUPS))].map((id) => `docs section ${id}`),
      ...workflows.flatMap((file) => workflowChecks(file.slice(WORKFLOWS.length), show(ref, file))),
      ...checkScriptParts(show(ref, 'package.json')),
    ]),
  };
}

const minus = (a, b) => [...a].filter((item) => !b.has(item));

// What the diff adds, and whether it changes the files agents read. Pages count only when the diff adds more
// routes than it removes, so a page that moves, however much it changes on the way, isn't new.
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
    claudeMd: changes(AGENT_DOCS.claude),
    verifySkill: changes(AGENT_DOCS.verify),
  };
}

// The reason a body gives for leaving the agent docs as they are, or null. A line in an HTML comment doesn't show on
// the pull request, so it doesn't count, and neither does a placeholder such as <reason>.
function escapeReason(body) {
  const reason = ESCAPE.exec((body ?? '').replace(/<!--[\s\S]*?(?:-->|$)/g, ''))?.[1] ?? null;
  return reason === null || /^<[^>]*>$/.test(reason) ? null : reason;
}

function main() {
  const [base = 'origin/main', head = 'HEAD'] = process.argv.slice(2);
  const lines = [];
  const say = (line) => {
    lines.push(line);
    console.log(line);
  };
  let status = 0;
  const { added, claudeMd, verifySkill } = review(base, head);
  if (added.length === 0) {
    say('agent-docs: this pull request adds no docs page, docs section or check.');
  } else {
    say('agent-docs: this pull request adds:');
    for (const item of added) say(`  - ${item}`);
    const reason = escapeReason(process.env.PR_BODY);
    if (claudeMd && verifySkill) {
      say('agent-docs: it changes CLAUDE.md and the verify skill too.');
    } else if (reason) {
      say(`agent-docs: its body says why the agent docs stay as they are: ${reason}`);
    } else {
      const missing = [!claudeMd && 'CLAUDE.md', !verifySkill && 'the verify skill (.claude/skills/verify/SKILL.md or verify.mjs)'];
      say(
        `agent-docs: change ${missing.filter(Boolean).join(' and ')} in this pull request too, so agents know what it ` +
          'adds. Both need Ben\'s yes. Where one or both need no change, add a line "Agent docs unchanged: <reason>" ' +
          'to the pull request body, with the reason in place of <reason>, then re-run this job.' +
          (process.env.PR_BODY === undefined ? ' For a run outside CI, set PR_BODY to that body.' : ''),
      );
      status = 1;
    }
  }
  if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, `${lines.join('\n')}\n`);
  return status;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) process.exitCode = main();
