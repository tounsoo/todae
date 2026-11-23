// Fails when a workflow that runs on a push or pull request installs system packages from Ubuntu's
// apt mirror. Playwright's `install --with-deps` and `install-deps` do that install. WebKit's did,
// until the job timed out (#347). Firefox's was left on the runner and later timed out too (#381).
// The fix is the digest-pinned mcr.microsoft.com/playwright image Fernway, Engines and Docs use:
// the browsers and their packages are already in it, so the job deletes the install.
// A workflow_dispatch-only workflow is out of scope. Bench stays on the runner so its records keep
// one machine type, and it never runs on a push or a pull request.
// With no arguments it scans .github/workflows and .github/actions. Each argument is a file to scan instead.
import { spawnSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { isAlias, isMap, isScalar, isSeq, LineCounter, parseAllDocuments } from 'yaml';

const root = fileURLToPath(new URL('../..', import.meta.url));

const CI_EVENTS = new Set(['push', 'pull_request', 'pull_request_target', 'merge_group']);

// The run lines from the workflows that timed out. #347 merged them, they were still on main at
// acf5adff when WebKit's install timed out, and #381 (6d659a85) left the Firefox ones in place.
export const PAST_COMMANDS = [
  'pnpm --filter @tounsoo/todae exec playwright install --with-deps ${{ matrix.browser }}',
  'pnpm --filter @tounsoo/todae exec playwright install-deps ${{ matrix.browser }}',
  'pnpm --filter @tounsoo/todae exec playwright install --with-deps chromium',
  'pnpm --filter @tounsoo/todae exec playwright install-deps chromium',
  'pnpm --filter docs exec playwright install --with-deps webkit firefox',
];

// Each fixture is `.github/workflows/ci.yml` at that commit, byte for byte. The blob id is
// `git rev-parse <rev>:.github/workflows/ci.yml`, so a shallow clone still proves the file.
export const PAST_WORKFLOWS = [
  { ref: '#347', rev: '26833697d9c697c81fe1eeb7b743b79b61f4b98c', blob: '9e27dc3c41110c1fbc38875d60e88b3bf73f635f' },
  { ref: '#347', rev: 'acf5adff8f103b21f6b7a89cbb68dd6761768e87', blob: '82ce4d149381dec0008560889a0c37b4282f0a84' },
  { ref: '#381', rev: '6d659a85eed65b92147f14e4894b19aedfdae137', blob: 'c6f9dd0d5c0fde0a38df04b9ff8fdebdfc877fa2' },
];

const FIX =
  'Delete the install. Run the job in the digest-pinned mcr.microsoft.com/playwright image Fernway, Engines and Docs use. The browsers and their packages are already in it. playwright install --with-deps, playwright install-deps and apt-get install pull packages from Ubuntu\'s mirror, which timed out WebKit (#347) and Firefox (#381).';

function yamlFiles(dir, deep) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir, { withFileTypes: true })
    .flatMap((entry) => {
      const path = join(dir, entry.name);
      if (entry.isDirectory()) return deep ? yamlFiles(path, deep) : [];
      return /\.ya?ml$/.test(entry.name) ? [path] : [];
    })
    .sort();
}

export function defaultFiles() {
  return [...yamlFiles(join(root, '.github/workflows'), false), ...yamlFiles(join(root, '.github/actions'), true)];
}

function word(token) {
  return token.replace(/^['"]+|['"]+$/g, '');
}

// Tokens, not a substring: `ci-apt-install` is the check's own name, and it is not an apt install.
function matchApt(line) {
  if (/^\s*#/.test(line)) return false;
  const tokens = line.trim().split(/\s+/).map(word);
  for (let index = 0; index < tokens.length; index += 1) {
    const token = tokens[index];
    if (/^playwright(?:@\S+)?$/.test(token)) {
      const next = tokens[index + 1];
      if (next === 'install-deps') return true;
      if (next === 'install' && tokens.some((item) => item === '--with-deps' || item.startsWith('--with-deps='))) return true;
    }
    if ((token === 'apt' || token === 'apt-get') && tokens.slice(index + 1).includes('install')) return true;
  }
  return false;
}

// One hit per logical command. A trailing backslash joins the next physical line.
export function aptCommands(script) {
  const lines = String(script).split(/\r?\n/);
  const found = [];
  let buffer = '';
  let start = 0;
  const flush = () => {
    const command = buffer.replace(/\s+/g, ' ').trim();
    buffer = '';
    if (command === '' || command.startsWith('#')) return;
    if (matchApt(command)) found.push({ index: start, command });
  };
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index] ?? '';
    if (buffer === '') start = index;
    if (/\\\s*$/.test(line)) {
      buffer += `${line.replace(/\\\s*$/, '')} `;
      continue;
    }
    buffer += line;
    flush();
  }
  if (buffer !== '') flush();
  return found;
}

function eventsOf(node, deref) {
  const value = deref(node);
  if (isScalar(value)) return [String(value.value ?? '')];
  if (isSeq(value)) {
    const names = [];
    for (const item of value.items) {
      const named = deref(item);
      if (!isScalar(named)) return null;
      names.push(String(named.value ?? ''));
    }
    return names;
  }
  if (isMap(value)) {
    const names = [];
    for (const item of value.items) {
      if (!isScalar(item.key)) return null;
      names.push(String(item.key.value ?? ''));
    }
    return names;
  }
  return null;
}

function lineOf(lineCounter, text, range, index) {
  const base = lineCounter.linePos(range[0]).line;
  const source = text.slice(range[0], range[1]).trimStart();
  const block = source.startsWith('|') || source.startsWith('>');
  return base + (block ? 1 : 0) + index;
}

function walkSteps(owner, job, text, lineCounter, deref, mapOf, hits, file) {
  const steps = deref(owner?.get('steps', true));
  if (!isSeq(steps)) {
    if (owner?.has('steps')) hits.push({ file, line: 1, job, command: 'could not read steps' });
    return;
  }
  for (const step of steps.items) {
    const body = mapOf(step);
    if (!body) continue;
    const pair = body.items.find((item) => isScalar(item.key) && item.key.value === 'run');
    if (!pair) continue;
    const value = deref(pair.value);
    if (!isScalar(value) || value.value === null || value.value === undefined) {
      const offset = (value?.range ?? pair.key.range)[0];
      hits.push({ file, line: lineCounter.linePos(offset).line, job, command: 'could not read run' });
      continue;
    }
    const range = value.range ?? pair.key.range;
    for (const hit of aptCommands(String(value.value))) {
      hits.push({ file, line: lineOf(lineCounter, text, range, hit.index), job, command: hit.command });
    }
  }
}

// `on` is a boolean in YAML 1.1, so accept that key as well as the string.
function onValue(top) {
  const pair = top.items.find((item) => isScalar(item.key) && (item.key.value === 'on' || item.key.value === true));
  return pair ? pair.value : undefined;
}

export function findAptInstalls(text, file = 'workflow.yml') {
  const lineCounter = new LineCounter();
  let docs;
  try {
    docs = parseAllDocuments(text, { lineCounter });
  } catch (error) {
    return [{ file, line: 1, job: '', command: `could not read it as YAML: ${error.message.split('\n')[0]}` }];
  }
  const hits = [];
  for (const doc of docs) {
    if (doc.errors.length > 0) {
      hits.push({ file, line: 1, job: '', command: `could not read it as YAML: ${doc.errors[0].message.split('\n')[0]}` });
      continue;
    }
    const deref = (node) => (isAlias(node) ? node.resolve(doc) : node);
    const mapOf = (node) => (isMap(deref(node)) ? deref(node) : null);
    const top = mapOf(doc.contents);
    if (!top) continue;
    const jobs = top.has('jobs') ? mapOf(top.get('jobs', true)) : null;
    if (top.has('jobs')) {
      if (!jobs) {
        hits.push({ file, line: 1, job: '', command: 'could not read jobs' });
        continue;
      }
      const on = onValue(top);
      if (on === undefined) {
        hits.push({ file, line: 1, job: '', command: 'could not read on:' });
        continue;
      }
      const events = eventsOf(on, deref);
      if (events === null) {
        hits.push({ file, line: 1, job: '', command: 'could not read on:' });
        continue;
      }
      if (!events.some((event) => CI_EVENTS.has(event))) continue;
      for (const job of jobs.items) {
        const name = isScalar(job.key) ? String(job.key.value ?? '') : '';
        const body = mapOf(job.value);
        if (!body) {
          hits.push({ file, line: 1, job: name, command: 'could not read the job' });
          continue;
        }
        walkSteps(body, name, text, lineCounter, deref, mapOf, hits, file);
      }
      continue;
    }
    const runs = mapOf(top.get('runs', true));
    if (runs) walkSteps(runs, 'action', text, lineCounter, deref, mapOf, hits, file);
  }
  return hits;
}

export function formatHit(hit) {
  const where = hit.job ? `${hit.job}: ` : '';
  return `${hit.file}:${hit.line}: ${where}${hit.command}`;
}

export function scan(files) {
  const lines = [];
  for (const file of files) {
    const name = relative(process.cwd(), file) || file;
    let text;
    try {
      text = readFileSync(file, 'utf8');
    } catch (error) {
      lines.push(`${name}:1: could not read it: ${error.message.split('\n')[0]}`);
      continue;
    }
    for (const hit of findAptInstalls(text, name)) lines.push(formatHit(hit));
  }
  return lines;
}

function workflowWith(command) {
  return `on: pull_request\njobs:\n  engines:\n    runs-on: ubuntu-24.04\n    steps:\n      - run: ${JSON.stringify(command)}\n`;
}

function gitOutput(args) {
  const result = spawnSync('git', args, { cwd: root, encoding: 'utf8' });
  if (result.status !== 0) return null;
  return result.stdout.trim();
}

export function fixturePath(blob) {
  return join(root, '.github/scripts/fixtures/ci-apt-install', `${blob}.yml`);
}

export function selfTest() {
  const problems = [];
  for (const command of PAST_COMMANDS) {
    const hits = findAptInstalls(workflowWith(command), 'past.yml');
    if (!hits.some((hit) => hit.command === command)) {
      problems.push(`past command was not flagged: ${command}`);
    }
  }
  for (const past of PAST_WORKFLOWS) {
    const path = fixturePath(past.blob);
    if (gitOutput(['hash-object', path]) !== past.blob) {
      problems.push(`${past.ref} fixture is not blob ${past.blob} from ${past.rev}`);
      continue;
    }
    let text;
    try {
      text = readFileSync(path, 'utf8');
    } catch (error) {
      problems.push(`${past.ref} fixture could not be read: ${error.message.split('\n')[0]}`);
      continue;
    }
    const hits = findAptInstalls(text, `${past.rev}:.github/workflows/ci.yml`);
    for (const command of PAST_COMMANDS) {
      if (!hits.some((hit) => hit.command === command)) {
        problems.push(`${past.ref} ${past.rev} did not flag: ${command}`);
      }
    }
    const has = spawnSync('git', ['cat-file', '-e', `${past.rev}^{commit}`], { cwd: root });
    if (has.status !== 0) continue;
    if (gitOutput(['rev-parse', `${past.rev}:.github/workflows/ci.yml`]) !== past.blob) {
      problems.push(`${past.ref} ${past.rev} is not blob ${past.blob}`);
    }
  }
  const bench = join(root, '.github/workflows/bench.yml');
  if (existsSync(bench)) {
    const hits = findAptInstalls(readFileSync(bench, 'utf8'), '.github/workflows/bench.yml');
    if (hits.length > 0) problems.push(`bench.yml is workflow_dispatch only and was flagged: ${hits.map(formatHit).join('; ')}`);
  }
  for (const line of scan(defaultFiles())) problems.push(line);
  return problems;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const self = process.argv.includes('--self-test');
  const files = process.argv.slice(2).filter((arg) => arg !== '--self-test');
  if (self) {
    const problems = selfTest();
    if (problems.length > 0) {
      for (const problem of problems) console.error(problem);
      console.error(`ci-apt-install: ${FIX}`);
      process.exit(1);
    }
  }
  if (!self || files.length > 0) {
    const chosen = files.length > 0 ? files : defaultFiles();
    if (chosen.length === 0) {
      console.error('ci-apt-install: found no workflow or action files under .github');
      process.exit(1);
    }
    const lines = scan(chosen);
    if (lines.length > 0) {
      for (const line of lines) console.error(line);
      console.error(`ci-apt-install: ${FIX}`);
      process.exit(1);
    }
  }
}
