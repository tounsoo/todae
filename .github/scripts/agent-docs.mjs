// Fails a pull request that adds a docs page, a docs section or a check without changing both CLAUDE.md and
// the Claude verify skill in .claude/skills/verify/, unless its body has a line `Agent docs unchanged: <reason>`.
// Agents learn the repository from those two files, so they have to grow with it.
// Usage: node .github/scripts/agent-docs.mjs [<base> [<head>]], from the repository root. The base defaults to
// origin/main and the head to HEAD; the diff starts at their merge base, as `git diff <base>...<head>` does.
// PR_BODY holds the pull request body.
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { parse } from 'yaml';

const PAGE = /^apps\/docs\/app\/\(en\)\/(?:(.+)\/)?page\.(?:mdx?|[jt]sx?)$/;
const SITE_GROUPS = 'apps/docs/components/siteGroups.ts';
const WORKFLOWS = '.github/workflows/';
const VERIFY = '.claude/skills/verify/';
const ESCAPE = /^[ \t]*Agent docs unchanged:[ \t]*(\S.*?)[ \t\r]*$/m;

const git = (args) => execFileSync('git', args, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });

// The file at a commit, or null when it isn't there.
function show(ref, path) {
  try {
    return execFileSync('git', ['show', `${ref}:${path}`], {
      encoding: 'utf8',
      maxBuffer: 64 * 1024 * 1024,
      stdio: ['ignore', 'pipe', 'ignore'],
    });
  } catch {
    return null;
  }
}

// The route a page file under app/(en) serves, with route groups such as (marketing) left out.
export function pageRoute(path) {
  const match = PAGE.exec(path);
  if (!match) return null;
  const segments = (match[1] ?? '').split('/').filter((segment) => segment && !/^\(.*\)$/.test(segment));
  return `/${segments.join('/')}`;
}

// The id of each group in SITE_GROUPS, the sidebar's sections.
export function sectionIds(text) {
  return new Set([...(text ?? '').matchAll(/^\s*id:\s*['"]([^'"]+)['"]/gm)].map((match) => match[1]));
}

function triggersOnPullRequests(on) {
  const events = typeof on === 'string' ? [on] : Array.isArray(on) ? on : Object.keys(on ?? {});
  return events.some((event) => event === 'pull_request' || event === 'pull_request_target');
}

// Each job, and each step that runs a command, in a workflow that pull requests start. A step is known by its name,
// or by its command when it has none, across the whole workflow, so a step copied into another job isn't new.
// Steps that only use an action, such as checkout or a cache, aren't checks.
export function workflowChecks(file, text) {
  if (text == null) return [];
  const workflow = parse(text, { maxAliasCount: -1 });
  if (!workflow || !triggersOnPullRequests(workflow.on)) return [];
  const checks = [];
  for (const [id, job] of Object.entries(workflow.jobs ?? {})) {
    checks.push(`${file}: job ${id}`);
    for (const step of job?.steps ?? []) {
      if (typeof step?.run !== 'string') continue;
      checks.push(`${file}: step ${step.name ? `"${step.name}"` : `\`${step.run.trim()}\``}`);
    }
  }
  return checks;
}

// Each command that the root `pnpm check` chains.
export function checkScriptParts(text) {
  if (text == null) return [];
  const script = JSON.parse(text).scripts?.check;
  if (typeof script !== 'string') return [];
  return script
    .split('&&')
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => `package.json: \`pnpm check\` runs \`${part}\``);
}

function checksAt(ref) {
  const files = git(['ls-tree', '--name-only', ref, WORKFLOWS])
    .split('\n')
    .filter((file) => /\.ya?ml$/.test(file));
  return new Set([
    ...files.flatMap((file) => workflowChecks(file.slice(WORKFLOWS.length), show(ref, file))),
    ...checkScriptParts(show(ref, 'package.json')),
  ]);
}

function routesAt(ref) {
  return new Set(
    git(['ls-tree', '-r', '-z', '--name-only', ref, '--', 'apps/docs/app/(en)'])
      .split('\0')
      .map(pageRoute)
      .filter((route) => route !== null),
  );
}

// Changed paths with their status, renames paired so that a moved page doesn't count as a new one.
function changes(base, head) {
  const fields = git(['-c', 'core.quotePath=false', 'diff', '-z', '--name-status', '-M', base, head]).split('\0');
  const list = [];
  for (let i = 0; i < fields.length - 1; ) {
    const status = fields[i++];
    if (/^[RC]/.test(status)) list.push({ status: status[0], from: fields[i++], path: fields[i++] });
    else list.push({ status, path: fields[i++] });
  }
  return list;
}

// What the diff adds, and whether it changes both files agents read.
export function review(base, head) {
  const mergeBase = git(['merge-base', base, head]).trim();
  const changed = changes(mergeBase, head);
  const baseRoutes = routesAt(mergeBase);
  const pages = changed
    .filter((change) => change.status === 'A')
    .map((change) => pageRoute(change.path))
    .filter((route) => route !== null && !baseRoutes.has(route))
    .map((route) => `docs page ${route}`);
  const baseSections = sectionIds(show(mergeBase, SITE_GROUPS));
  const sections = [...sectionIds(show(head, SITE_GROUPS))]
    .filter((id) => !baseSections.has(id))
    .map((id) => `docs section ${id}`);
  const baseChecks = checksAt(mergeBase);
  const checks = [...checksAt(head)].filter((check) => !baseChecks.has(check)).map((check) => `check ${check}`);
  const paths = changed.flatMap((change) => (change.from ? [change.from, change.path] : [change.path]));
  return {
    added: [...pages, ...sections, ...checks],
    claudeMd: paths.includes('CLAUDE.md'),
    verifySkill: paths.some((path) => path.startsWith(VERIFY)),
  };
}

export function escapeReason(body) {
  return ESCAPE.exec(body ?? '')?.[1] ?? null;
}

function main() {
  const [base = 'origin/main', head = 'HEAD'] = process.argv.slice(2);
  const { added, claudeMd, verifySkill } = review(base, head);
  if (added.length === 0) {
    console.log('agent-docs: this pull request adds no docs page, docs section or check.');
    return 0;
  }
  console.log('agent-docs: this pull request adds:');
  for (const item of added) console.log(`  - ${item}`);
  if (claudeMd && verifySkill) {
    console.log('agent-docs: it changes CLAUDE.md and the verify skill too.');
    return 0;
  }
  const reason = escapeReason(process.env.PR_BODY);
  if (reason) {
    console.log(`agent-docs: its body says the agent docs stay as they are: ${reason}`);
    return 0;
  }
  const missing = [!claudeMd && 'CLAUDE.md', !verifySkill && `the verify skill in ${VERIFY}`].filter(Boolean);
  console.log(
    `agent-docs: change ${missing.join(' and ')} in this pull request too, so agents know what it adds. ` +
      'Both need Ben\'s yes. If neither needs to change, add a line "Agent docs unchanged: <reason>" to the ' +
      'pull request body, then push or re-run this job.',
  );
  return 1;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) process.exitCode = main();
