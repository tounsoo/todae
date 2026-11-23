// Fails when a workflow that runs on a push, a pull request, or workflow_call installs apt packages.
// Playwright's `install --with-deps` and `install-deps` do that install, and so does apt-get.
// WebKit's did, until the job timed out (#347). Firefox's was left on the runner and later timed out
// too (#381). The fix is the digest-pinned mcr.microsoft.com/playwright image Fernway, Engines and
// Docs use: the browsers and the libraries they need are already in it, so the job deletes the install.
// A workflow_dispatch-only workflow is out of scope. Bench stays on the runner so its records keep
// one machine type, and it never runs on a push or a pull request.
// With no arguments it scans .github/workflows and .github/actions. Each argument is a file to scan instead.
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { isAlias, isMap, isScalar, isSeq, LineCounter, parseAllDocuments } from 'yaml';

const root = fileURLToPath(new URL('../..', import.meta.url));

const CI_EVENTS = new Set(['push', 'pull_request', 'pull_request_target', 'merge_group', 'workflow_call']);

// The install steps from the workflows that timed out, kept as short excerpts. #347 is 26833697.
// #381 is 6d659a85. acf5adff had the same five steps as #347.
const PAST_FIXTURES = ['347.yml', '381.yml'];

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

// A quoted sentence is one word. `echo "use apt-get to install"` does not run apt-get.
function shellWords(command) {
  const words = [];
  let current = '';
  let quote = '';
  let started = false;
  const flush = () => {
    if (!started) return;
    words.push(current);
    current = '';
    started = false;
  };
  for (let index = 0; index < command.length; index += 1) {
    const ch = command[index];
    if (quote) {
      started = true;
      if (ch === '\\' && quote === '"' && index + 1 < command.length) {
        current += command[index + 1];
        index += 1;
        continue;
      }
      if (ch === quote) {
        quote = '';
        continue;
      }
      current += ch;
      continue;
    }
    if (ch === '"' || ch === "'") {
      quote = ch;
      started = true;
      continue;
    }
    if (ch === ' ' || ch === '\t') {
      flush();
      continue;
    }
    started = true;
    current += ch;
  }
  flush();
  return words;
}

function commandName(token) {
  const slash = token.lastIndexOf('/');
  return slash === -1 ? token : token.slice(slash + 1);
}

function splitCommands(line) {
  const commands = [];
  let current = '';
  let quote = '';
  const push = () => {
    const command = current.replace(/\s+/g, ' ').trim();
    current = '';
    if (command === '' || command.startsWith('#')) return;
    commands.push(command);
  };
  for (let index = 0; index < line.length; index += 1) {
    const ch = line[index];
    if (quote) {
      current += ch;
      if (ch === '\\' && quote === '"' && index + 1 < line.length) {
        current += line[index + 1];
        index += 1;
        continue;
      }
      if (ch === quote) quote = '';
      continue;
    }
    if (ch === '"' || ch === "'") {
      quote = ch;
      current += ch;
      continue;
    }
    if (ch === '#' && (current === '' || /\s$/.test(current))) break;
    if (ch === ';') {
      push();
      continue;
    }
    if ((ch === '&' && line[index + 1] === '&') || (ch === '|' && line[index + 1] === '|')) {
      push();
      index += 1;
      continue;
    }
    if (ch === '|' || ch === '(' || ch === ')') {
      push();
      continue;
    }
    current += ch;
  }
  push();
  return commands;
}

function matchApt(command) {
  const tokens = shellWords(command).map(commandName);
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

// One hit per shell command. A trailing backslash joins the next physical line.
export function aptCommands(script) {
  const lines = String(script).split(/\r?\n/);
  const found = [];
  let buffer = '';
  let start = 0;
  const flush = () => {
    const line = buffer;
    buffer = '';
    for (const command of splitCommands(line)) {
      if (matchApt(command)) found.push({ index: start, command });
    }
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

function runLines(text) {
  return text.split(/\r?\n/).flatMap((line) => {
    const match = /^\s*(?:-\s+)?run:\s+(\S.*)$/.exec(line);
    return match ? [match[1].trim()] : [];
  });
}

export function selfTest() {
  const problems = [];
  for (const name of PAST_FIXTURES) {
    const path = join(root, '.github/scripts/fixtures/ci-apt-install', name);
    let text;
    try {
      text = readFileSync(path, 'utf8');
    } catch (error) {
      problems.push(`${name} could not be read: ${error.message.split('\n')[0]}`);
      continue;
    }
    const hits = findAptInstalls(text, name);
    const runs = runLines(text);
    if (runs.length === 0) problems.push(`${name} has no install steps`);
    for (const command of runs) {
      if (!hits.some((hit) => hit.command === command)) problems.push(`${name} did not flag: ${command}`);
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
