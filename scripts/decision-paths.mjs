// Every repo path that a live decision names must exist in the checkout.
// A decision is live while its Status starts with Active or Partly superseded, because it still gives current
// guidance. A Superseded decision is history and may keep paths that are gone.
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync, realpathSync } from 'node:fs';
import path from 'node:path';

export const DECISIONS_DIR = 'docs/decisions';

const DECISION_FILE = /^\d{4}-[\w-]+\.md$/;
const STATUS_LINE = /^- \*\*Status:\*\* (.*)$/;
// A clause that ends by saying its paths are gone ("... `x.mjs` and `y.json` are removed.") records history, so its
// paths are not checked. Only that ending counts, so a removal word elsewhere does not hide a live path.
const REMOVAL = /\b(?:is|are|was|were)\s+(?:now\s+)?(?:removed|deleted|gone)\s*[.!?]?\s*$/i;
const FIX =
  'Amend the decision: mark it "Partly superseded by [NNNN](NNNN-slug.md)" and rewrite or strike (~~path~~) the dead path, or restore the file if it should still exist.';

export function checkDecisions(root) {
  const dir = path.join(root, DECISIONS_DIR);
  if (!existsSync(dir)) return [];
  const problems = [];
  const statuses = new Map();
  const roots = rootEntries(root);
  for (const name of readdirSync(dir)
    .filter((entry) => DECISION_FILE.test(entry))
    .sort()) {
    const rel = `${DECISIONS_DIR}/${name}`;
    const lines = readFileSync(path.join(dir, name), 'utf8').split(/\r?\n/);
    const statusIndex = lines.findIndex((line) => STATUS_LINE.test(line));
    const status = statusIndex < 0 ? '' : (STATUS_LINE.exec(lines[statusIndex] ?? '')?.[1] ?? '');
    const kind = statusKind(status);
    statuses.set(name, kind);
    if (kind === null) {
      problems.push(
        `${rel}: Status "${status}" does not start with Active, Partly superseded or Superseded. Use one of those so the path check knows whether the decision is live.`,
      );
      continue;
    }
    if (kind === 'Superseded') continue;
    lines.forEach((line, index) => {
      if (index === statusIndex) return;
      for (const clause of clauses(line)) {
        if (REMOVAL.test(clause.replace(/`[^`]*`/g, ''))) continue;
        for (const ref of namedPaths(clause, roots)) {
          if (ref.problem) {
            problems.push(`${rel}:${index + 1}: ${ref.problem}`);
            continue;
          }
          const target = ref.link ? path.resolve(dir, ref.path) : path.resolve(root, ref.path);
          if (existsSync(target)) continue;
          problems.push(
            `${rel}:${index + 1}: names \`${ref.shown}\`, which does not exist, and the decision is still ${kind}. ${FIX}`,
          );
        }
      }
    });
  }
  problems.push(...checkIndex(root, statuses));
  return [...new Set(problems)];
}

function statusKind(status) {
  if (/^Active\b/.test(status)) return 'Active';
  if (/^Partly superseded\b/.test(status)) return 'Partly superseded';
  if (/^Superseded\b/.test(status)) return 'Superseded';
  return null;
}

// The README index lists each decision with its status. The listed status must match the file's.
function checkIndex(root, statuses) {
  const rel = `${DECISIONS_DIR}/README.md`;
  const full = path.join(root, rel);
  if (!existsSync(full)) return [];
  const problems = [];
  readFileSync(full, 'utf8')
    .split(/\r?\n/)
    .forEach((line, index) => {
      const match = /^- \[[^\]]*\]\((\d{4}-[\w-]+\.md)\)\. (.*)$/.exec(line);
      if (!match) return;
      const [, file = '', rest = ''] = match;
      const fileKind = statuses.get(file);
      if (fileKind === undefined || fileKind === null) return;
      const listed = statusKind(rest);
      if (listed !== fileKind) {
        problems.push(
          `${rel}:${index + 1}: lists ${file} as "${rest.split(',')[0]}", but its Status is ${fileKind}. Write ${fileKind} in the index entry.`,
        );
      }
    });
  return problems;
}

// Splits a line into sentences and then into clauses at ; and :, ignoring those marks inside code spans and link
// targets. Struck-through text is dropped, because it is history too.
function clauses(raw) {
  const line = raw.replace(/~~.*?~~/g, '');
  const masked = line
    .replace(/`[^`]*`/g, (code) => code.replace(/[.!?;:]/g, '\u0000'))
    .replace(/\]\([^)]*\)/g, (link) => link.replace(/[.!?;:]/g, '\u0000'));
  const parts = [];
  let start = 0;
  const boundary = /[.!?](?=\s)|[;:]/g;
  let match;
  while ((match = boundary.exec(masked)) !== null) {
    parts.push(line.slice(start, match.index + 1));
    start = match.index + 1;
  }
  parts.push(line.slice(start));
  return parts;
}

function namedPaths(sentence, roots) {
  const found = [];
  for (const match of sentence.matchAll(/`([^`]+)`/g)) {
    const shown = match[1] ?? '';
    const candidate = repoPath(shown, roots);
    if (candidate !== null) found.push({ shown, path: candidate, link: false });
  }
  const withoutCode = sentence.replace(/`[^`]*`/g, '');
  for (const match of withoutCode.matchAll(/\]\(([^)\s]+)\)/g)) {
    const target = match[1] ?? '';
    if (/^[a-z][a-z0-9+.-]*:/i.test(target) || target.startsWith('#')) continue;
    const file = target.split('#')[0] ?? '';
    if (file === '') continue;
    let decoded;
    try {
      decoded = decodeURI(file);
    } catch {
      found.push({ problem: `links to \`${target}\`, which is not a valid URI. Fix the link.` });
      continue;
    }
    found.push({ shown: target, path: decoded, link: true });
  }
  return found;
}

// A code span is a repo path when it has no spaces or placeholders and starts with a top-level entry of the
// checkout, or with a dot folder that git does not ignore. Commands, identifiers, branch names and paths in
// other repos (such as home's `standards/git.md`) do not.
function repoPath(code, roots) {
  if (/[\s<>{}*="'()|$]/.test(code) || code.startsWith('/') || code.includes('://')) return null;
  const clean = code
    .replace(/#.*$/, '')
    .replace(/:\d+(?::\d+)?$/, '')
    .replace(/\/+$/, '');
  if (clean === '' || clean === '.' || clean.split('/').includes('..')) return null;
  const first = clean.split('/')[0] ?? '';
  if (roots.entries.has(first)) return clean;
  if (first.startsWith('.') && first.length > 1 && clean.includes('/') && !roots.ignored.has(first)) return clean;
  return null;
}

function rootEntries(root) {
  const ignored = new Set(['.git', 'node_modules']);
  const gitignore = path.join(root, '.gitignore');
  if (existsSync(gitignore)) {
    for (const raw of readFileSync(gitignore, 'utf8').split(/\r?\n/)) {
      const line = raw.trim().replace(/^\//, '').replace(/\/$/, '');
      if (line !== '' && !line.startsWith('#') && !/[*/!?[]/.test(line)) ignored.add(line);
    }
  }
  const entries = new Set((trackedTopLevel(root) ?? readdirSync(root)).filter((name) => !ignored.has(name)));
  return { entries, ignored };
}

// Top-level names git tracks, so an untracked local folder does not make a path count on one machine and not in
// CI. Outside a git checkout (the tests' scratch folders) this returns null and the caller lists the folder.
function trackedTopLevel(root) {
  try {
    const out = execFileSync('git', ['ls-files', '-z'], {
      cwd: root,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    });
    const top = execFileSync('git', ['rev-parse', '--show-toplevel'], {
      cwd: root,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
    if (realpathSync(top) !== realpathSync(root)) {
      return null;
    }
    return [
      ...new Set(
        out
          .split('\0')
          .filter(Boolean)
          .map((file) => file.split('/')[0] ?? ''),
      ),
    ];
  } catch {
    return null;
  }
}
