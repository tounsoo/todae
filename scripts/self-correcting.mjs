import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';

const AGENTS_PATH = 'AGENTS.md';
const WEEDS_PATH = '.agents/weeds.tsv';
const BASELINE_PATH = '.agents/suppression-baseline.json';

const WEEDS_HEADER = 'date\tclass\tref\tcaught_by\tnote';
const CAUGHT_BY = new Set(['review', 'ben', 'prod', 'revert']);
const STATUSES = new Set(['enforced', 'seeded', 'text', 'retired']);
const PACIFIC = 'America/Los_Angeles';
const COLUMNS = ['ID', 'Rule', 'Enforcer', 'Evidence', 'Status'];
const SOURCE_EXT = new Set(['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '.mts', '.cts']);
const SKIP_DIRS = new Set([
  'node_modules',
  'dist',
  'coverage',
  '.next',
  '.vercel',
  '.git',
  '.claude',
  '.cursor',
  'graft',
  '.graft',
]);

const MARKERS = ['eslint-disable', '@ts-ignore', '@ts-expect-error', '@ts-nocheck', 'biome-ignore', 'oxlint-disable'];

export function checkRepository(root, now = new Date()) {
  const problems = [];
  const today = isoDate(now);
  const rules = readRules(root, problems);
  const weeds = readWeeds(root, problems, today);
  const suppressions = readSuppressions(root, problems, today);

  const tier = rules?.tier ?? 'T0';
  const rows = rules?.rows ?? [];
  const dated = weeds.filter((weed) => isRealDate(weed.date));
  if (tier === 'T1') {
    const enforced = new Set(rows.filter((row) => row.status === 'enforced').map((row) => row.id));
    const cutoff = addDays(today, -30);
    for (const weed of dated) {
      if (enforced.has(weed.className) && weed.date >= cutoff && weed.date <= today) {
        problems.push(`T1: enforced class "${weed.className}" is in the weeds log on ${weed.date}, within 30 days.`);
      }
    }
  }

  const weedClasses = new Set(weeds.map((weed) => weed.className));
  const byClass = new Map();
  for (const weed of weeds) byClass.set(weed.className, (byClass.get(weed.className) ?? 0) + 1);
  const enforcedIds = new Set(rows.filter((row) => row.status === 'enforced').map((row) => row.id));
  let enforcedInLog = 0;
  for (const className of weedClasses) {
    if (enforcedIds.has(className)) enforcedInLog += 1;
  }
  const twiceWithoutEnforcement = [...byClass.entries()]
    .filter(([className, count]) => count >= 2 && !enforcedIds.has(className))
    .map(([className]) => className)
    .sort();

  const cutoff = addDays(today, -30);
  const seen = new Set();
  let repeats = 0;
  for (const weed of dated) {
    if (seen.has(weed.className) && weed.date >= cutoff && weed.date <= today) repeats += 1;
    seen.add(weed.className);
  }

  return {
    problems,
    machineCaught: {
      percent: weedClasses.size === 0 ? null : Math.round((enforcedInLog / weedClasses.size) * 100),
      enforced: enforcedInLog,
      classes: weedClasses.size,
    },
    repeats,
    suppressions,
    textRows: rows.filter((row) => row.status === 'text').map((row) => row.id),
    twiceWithoutEnforcement,
  };
}

export function formatReport(report) {
  const caught =
    report.machineCaught.percent === null
      ? `machine-caught: n/a (${report.machineCaught.enforced}/${report.machineCaught.classes})`
      : `machine-caught: ${report.machineCaught.percent}% (${report.machineCaught.enforced}/${report.machineCaught.classes})`;
  const baseline = report.suppressions.baselineTotal === null ? 'baseline missing' : `baseline ${report.suppressions.baselineTotal}`;
  const baselineUn =
    report.suppressions.baselineUnannotated === null
      ? 'baseline missing'
      : `baseline ${report.suppressions.baselineUnannotated}`;
  return [
    caught,
    `repeats: ${report.repeats}`,
    `suppressions: total ${report.suppressions.total} (${baseline}), unannotated ${report.suppressions.unannotated} (${baselineUn})`,
    `text: ${report.textRows.length > 0 ? report.textRows.join(', ') : 'none'}`,
    `seen twice without enforcement: ${report.twiceWithoutEnforcement.length > 0 ? report.twiceWithoutEnforcement.join(', ') : 'none'}`,
  ].join('\n');
}

function readRules(root, problems) {
  const text = readText(root, AGENTS_PATH);
  if (text === null) {
    problems.push(`${AGENTS_PATH} is missing.`);
    return null;
  }
  const lines = text.split(/\r?\n/);
  const start = lines.findIndex((line) => line.trim() === '## Rule table');
  if (start < 0) {
    problems.push(`${AGENTS_PATH} has no "## Rule table" section.`);
    return null;
  }
  let index = start + 1;
  while (index < lines.length && lines[index]?.trim() === '') index += 1;
  const tierLine = lines[index]?.trim() ?? '';
  const tierMatch = /^Tier: (T0|T1)$/.exec(tierLine);
  const tier = tierMatch?.[1];
  if (tier !== 'T0' && tier !== 'T1') {
    problems.push('rule table has no "Tier: T0" or "Tier: T1" line.');
    return null;
  }
  index += 1;
  while (index < lines.length && lines[index]?.trim() === '') index += 1;
  const header = cells(lines[index] ?? '');
  if (!header || header.join('\t') !== COLUMNS.join('\t')) {
    problems.push('rule table header must be | ID | Rule | Enforcer | Evidence | Status |.');
    return null;
  }
  index += 1;
  const separator = cells(lines[index] ?? '');
  if (!separator || separator.length !== COLUMNS.length || separator.some((cell) => !/^:?-+:?$/.test(cell))) {
    problems.push('rule table header has no separator row.');
    return null;
  }
  index += 1;
  const rows = [];
  const seenIds = new Set();
  const scripts = packageScripts(root);
  for (; index < lines.length; index += 1) {
    const line = lines[index] ?? '';
    if (!line.trim().startsWith('|')) break;
    const row = cells(line);
    const where = `rule table row ${rows.length + 1}`;
    if (!row || row.length !== COLUMNS.length) {
      problems.push(`${where} has ${row?.length ?? 0} cells, not 5.`);
      continue;
    }
    const [id = '', rule = '', enforcer = '', evidence = '', status = ''] = row;
    if (!isKebab(id)) problems.push(`${where} id "${id}" is not kebab-case.`);
    else if (seenIds.has(id)) problems.push(`${where} id "${id}" is duplicated.`);
    else seenIds.add(id);
    if (rule === '') problems.push(`${where} rule is empty.`);
    if (!STATUSES.has(status)) problems.push(`${where} status "${status}" is not enforced, seeded, text or retired.`);
    if (!validRef(evidence)) problems.push(`${where} evidence "${evidence}" is not a pull request, commit or tounsoo link.`);
    const parsed = parseEnforcer(enforcer);
    if ('problem' in parsed) {
      problems.push(`${where} ${parsed.problem}`);
      continue;
    }
    if (status === 'text' && !parsed.text) problems.push(`${where} status is text but the enforcer is not text.`);
    if ((status === 'enforced' || status === 'seeded') && parsed.text) {
      problems.push(`${where} status is ${status} but the enforcer is text.`);
    }
    if ((status === 'enforced' || status === 'seeded' || status === 'retired') && !parsed.text) {
      for (const token of parsed.machine) {
        if (!enforcerResolves(root, token, scripts)) problems.push(`${where} enforcer \`${token}\` does not resolve.`);
      }
    }
    rows.push({ id, enforcer, evidence, status });
  }
  return { tier, rows };
}

function readWeeds(root, problems, today) {
  const text = readText(root, WEEDS_PATH);
  if (text === null) {
    problems.push(`${WEEDS_PATH} is missing.`);
    return [];
  }
  const lines = text.split(/\r?\n/);
  if (lines.at(-1) === '') lines.pop();
  if (lines[0] !== WEEDS_HEADER) {
    problems.push(`${WEEDS_PATH} header must be date, class, ref, caught_by and note, separated by tabs.`);
    return [];
  }
  const rows = [];
  for (let index = 1; index < lines.length; index += 1) {
    const line = lines[index] ?? '';
    const fields = line.split('\t');
    const where = `weeds row ${index + 1}`;
    if (fields.length !== 5) {
      problems.push(`${where} has ${fields.length} fields, not 5.`);
      continue;
    }
    const [date = '', className = '', ref = '', caughtBy = '', note = ''] = fields;
    if (!isRealDate(date)) problems.push(`${where} date "${date}" is not YYYY-MM-DD.`);
    else if (date > today) problems.push(`${where} date "${date}" is after today.`);
    if (!isKebab(className)) problems.push(`${where} class "${className}" is not kebab-case.`);
    if (!validRef(ref)) problems.push(`${where} ref "${ref}" is not a pull request, commit or tounsoo link.`);
    if (!CAUGHT_BY.has(caughtBy)) problems.push(`${where} caught_by "${caughtBy}" is not review, ben, prod or revert.`);
    if (note.trim() === '') problems.push(`${where} note is empty.`);
    rows.push({ date, className });
  }
  return rows;
}

function readSuppressions(root, problems, today) {
  const baseline = readBaseline(root, problems);
  let total = 0;
  let unannotated = 0;
  for (const file of sourceFiles(root)) {
    const text = readFileSync(file, 'utf8');
    const lines = text.split(/\r?\n/);
    for (let index = 0; index < lines.length; index += 1) {
      const comment = commentBody(lines[index] ?? '');
      if (comment === null || !MARKERS.some((marker) => comment.includes(marker))) continue;
      total += 1;
      const where = `${path.relative(root, file).split(path.sep).join('/')}:${index + 1}`;
      if (!/why:|expires:|approved:/.test(comment)) {
        unannotated += 1;
        continue;
      }
      const reason = /why:\s*([^;]*)/.exec(comment)?.[1]?.trim() ?? '';
      if (reason === '') problems.push(`${where}: annotated suppression has no reason.`);
      const expires = /expires:\s*(\d{4}-\d{2}-\d{2})\b/.exec(comment)?.[1] ?? '';
      if (!isRealDate(expires)) problems.push(`${where}: annotated suppression has no expiry.`);
      else if (expires < today) problems.push(`${where}: annotated suppression expired on ${expires}.`);
      else if (expires > addDays(today, 90)) problems.push(`${where}: annotated suppression expires ${expires}, more than 90 days out.`);
      const approved = /approved:\s*(\S+)/.exec(comment)?.[1] ?? '';
      if (!validRef(approved)) problems.push(`${where}: annotated suppression has no approval.`);
    }
  }
  if (baseline) {
    if (total > baseline.total) problems.push(`suppressions: total ${total} is above the baseline ${baseline.total}.`);
    if (unannotated > baseline.unannotated) {
      problems.push(`suppressions: unannotated ${unannotated} is above the baseline ${baseline.unannotated}.`);
    }
  }
  return {
    total,
    unannotated,
    baselineTotal: baseline?.total ?? null,
    baselineUnannotated: baseline?.unannotated ?? null,
  };
}

function readBaseline(root, problems) {
  const text = readText(root, BASELINE_PATH);
  if (text === null) {
    problems.push(`${BASELINE_PATH} is missing.`);
    return null;
  }
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    problems.push(`${BASELINE_PATH} is not JSON.`);
    return null;
  }
  if (!isRecord(parsed)) {
    problems.push(`${BASELINE_PATH} must be an object with total and unannotated.`);
    return null;
  }
  const total = countField(parsed.total);
  const unannotated = countField(parsed.unannotated);
  if (total === null) problems.push(`${BASELINE_PATH} "total" must be a non-negative integer.`);
  if (unannotated === null) problems.push(`${BASELINE_PATH} "unannotated" must be a non-negative integer.`);
  if (total === null || unannotated === null) return null;
  return { total, unannotated };
}

function sourceFiles(root) {
  const found = [];
  const visit = (dir) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (SKIP_DIRS.has(entry.name)) continue;
      const full = path.join(dir, entry.name);
      const rel = path.relative(root, full).split(path.sep).join('/');
      if (rel === '.agents/pstack' || rel.startsWith('.agents/pstack/')) continue;
      if (entry.isDirectory()) visit(full);
      else if (entry.isFile() && countedSource(entry.name)) found.push(full);
    }
  };
  visit(root);
  return found;
}

function countedSource(name) {
  if (!SOURCE_EXT.has(path.extname(name))) return false;
  if (name === 'next-env.d.ts' || name === 'routeTree.gen.ts' || name.includes('.generated.')) return false;
  return true;
}

function commentBody(line) {
  const stripped = line
    .replace(/`(?:\\.|[^`\\])*`/g, '""')
    .replace(/"(?:\\.|[^"\\])*"/g, '""')
    .replace(/'(?:\\.|[^'\\])*'/g, "''");
  const slash = stripped.indexOf('//');
  const block = stripped.indexOf('/*');
  const start = slash < 0 ? block : block < 0 ? slash : Math.min(slash, block);
  if (start < 0) return null;
  return stripped.slice(start);
}

function parseEnforcer(cell) {
  const machine = [...cell.matchAll(/`([^`]+)`/g)].map((match) => match[1] ?? '').filter((token) => token !== '');
  const leftover = cell.replace(/`[^`]*`/g, '').replace(/[,\s]/g, '');
  if (machine.length === 0) {
    if (cell.trim() === 'text') return { text: true, machine: [] };
    return { problem: 'enforcer is empty.' };
  }
  if (machine.length === 1 && machine[0] === 'text' && leftover === '') return { text: true, machine: [] };
  if (machine.includes('text') || leftover !== '') return { problem: 'status and enforcer disagree.' };
  return { text: false, machine };
}

function enforcerResolves(root, token, scripts) {
  const npm = /^npm run ([\w:-]+)$/.exec(token);
  if (npm) return scripts?.[npm[1] ?? ''] !== undefined;
  const pnpm = /^pnpm ([\w:-]+)$/.exec(token);
  if (pnpm) return scripts?.[pnpm[1] ?? ''] !== undefined;
  const script = /^script:([\w:-]+)$/.exec(token);
  if (script) return scripts?.[script[1] ?? ''] !== undefined;
  const eslint = /^eslint:(.+)$/.exec(token);
  if (eslint) return eslintRuleNamed(root, eslint[1] ?? '');
  const tsconfig = /^tsconfig:(.+)$/.exec(token);
  if (tsconfig) return tsconfigOption(root, tsconfig[1] ?? '');
  const file = token.split('#')[0] ?? '';
  if (file === '' || path.isAbsolute(file)) return false;
  const full = path.resolve(root, file);
  const rootFull = path.resolve(root);
  if (full !== rootFull && !full.startsWith(rootFull + path.sep)) return false;
  return existsSync(full);
}

function packageScripts(root) {
  const text = readText(root, 'package.json');
  if (text === null) return null;
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    return null;
  }
  if (!isRecord(parsed)) return null;
  const scripts = {};
  if (!isRecord(parsed.scripts)) return scripts;
  for (const [name, value] of Object.entries(parsed.scripts)) {
    if (typeof value === 'string') scripts[name] = value;
  }
  return scripts;
}

function eslintRuleNamed(root, rule) {
  const names = [
    'eslint.config.js',
    'eslint.config.mjs',
    'eslint.config.cjs',
    'eslint.config.ts',
    '.eslintrc',
    '.eslintrc.js',
    '.eslintrc.cjs',
    '.eslintrc.json',
  ];
  const quoted = [`"${rule}"`, `'${rule}'`];
  return names.some((name) => {
    const text = readText(root, name);
    return text !== null && quoted.some((needle) => text.includes(needle));
  });
}

function tsconfigOption(root, option) {
  return tsconfigFiles(root).some((file) => {
    try {
      const parsed = JSON.parse(readFileSync(file, 'utf8'));
      if (!isRecord(parsed) || !isRecord(parsed.compilerOptions)) return false;
      return parsed.compilerOptions[option] === true;
    } catch {
      return false;
    }
  });
}

function tsconfigFiles(root) {
  const found = [];
  const visit = (dir) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (SKIP_DIRS.has(entry.name)) continue;
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) visit(full);
      else if (entry.isFile() && /^tsconfig.*\.json$/.test(entry.name)) found.push(full);
    }
  };
  visit(root);
  return found;
}

function cells(line) {
  const trimmed = line.trim();
  if (!trimmed.startsWith('|') || !trimmed.endsWith('|')) return null;
  const parts = trimmed
    .split('|')
    .slice(1, -1)
    .map((cell) => cell.trim());
  return parts.length > 0 ? parts : null;
}

function validRef(value) {
  return /^#\d+$/.test(value) || /^[0-9a-f]{7,40}$/i.test(value) || /^https:\/\/github\.com\/tounsoo\/\S+$/.test(value);
}

function isKebab(value) {
  return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value);
}

function isRealDate(value) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

function isoDate(date) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: PACIFIC,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  const value = (type) => parts.find((part) => part.type === type)?.value ?? '';
  return `${value('year')}-${value('month')}-${value('day')}`;
}

function addDays(iso, days) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  const date = new Date(Date.UTC(Number(match?.[1] ?? 1970), Number(match?.[2] ?? 1) - 1, Number(match?.[3] ?? 1)));
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function countField(value) {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0 ? value : null;
}

function isRecord(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function readText(root, rel) {
  const full = path.join(root, rel);
  if (!existsSync(full) || !statSync(full).isFile()) return null;
  return readFileSync(full, 'utf8');
}
