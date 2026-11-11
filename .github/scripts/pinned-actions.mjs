// Fails when a workflow or composite action uses a remote action that is not pinned to a full commit SHA,
// or a job runs an image that is not pinned to a digest.
// A local action (./...) passes, and a docker:// image passes only when pinned to a sha256 digest. So does the
// image of a job's container or service, because a tag can be pushed again with other contents.
// With no arguments it scans .github/workflows and .github/actions. Each argument is a file to scan instead.
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { isAlias, isMap, isScalar, isSeq, LineCounter, parseAllDocuments } from 'yaml';

const root = fileURLToPath(new URL('../..', import.meta.url));

export function isPinned(ref) {
  if (ref.startsWith('./')) return true;
  if (/^docker:\/\/\S+@sha256:[0-9a-f]{64}$/.test(ref)) return true;
  return /^[\w.-]+\/[\w./-]+@[0-9a-f]{40}$/.test(ref);
}

export function isPinnedImage(ref) {
  return /^[^\s@$]+@sha256:[0-9a-f]{64}$/.test(ref);
}

// Each `uses:` a workflow job, a workflow step or a composite action step names, and each job container or
// service image, with its line.
export function findUnpinned(text) {
  const lineCounter = new LineCounter();
  const docs = parseAllDocuments(text, { lineCounter });
  const hits = [];
  for (const doc of docs) {
    if (doc.errors.length > 0) throw new Error(doc.errors[0].message);
    const deref = (node) => (isAlias(node) ? node.resolve(doc) : node);
    const map = (node) => (isMap(deref(node)) ? deref(node) : null);
    const check = (owner) => {
      // GitHub doesn't read merge keys, and a merged uses: would hide here, so a merge key fails.
      const merge = owner?.items.find((item) => isScalar(item.key) && item.key.value === '<<');
      if (merge) hits.push({ line: lineCounter.linePos(merge.key.range[0]).line, ref: '<< (merge key)' });
      const pair = owner?.items.find((item) => isScalar(item.key) && item.key.value === 'uses');
      if (!pair) return;
      const value = deref(pair.value);
      const ref = isScalar(value) ? String(value.value ?? '') : String(value ?? '');
      if (isPinned(ref)) return;
      const offset = (value?.range ?? pair.key.range)[0];
      hits.push({ line: lineCounter.linePos(offset).line, ref });
    };
    const steps = (owner) => {
      const list = deref(owner?.get('steps', true));
      if (!isSeq(list)) return;
      for (const step of list.items) check(map(step));
    };
    // A container or service is its image, or a map whose image key names it.
    const image = (node) => {
      const value = deref(node);
      const owner = map(value);
      const named = owner ? deref(owner.get('image', true)) : value;
      const ref = isScalar(named) ? String(named.value ?? '') : String(named ?? '');
      if (isPinnedImage(ref)) return;
      const offset = (named?.range ?? value?.range ?? [0])[0];
      hits.push({ line: lineCounter.linePos(offset).line, ref });
    };
    const top = map(doc.contents);
    const jobs = map(top?.get('jobs', true));
    for (const job of jobs?.items ?? []) {
      const body = map(job.value);
      check(body);
      steps(body);
      if (body?.has('container')) image(body.get('container', true));
      if (body?.has('services')) {
        // An expression in place of the services map would hide its images, so anything but a map fails.
        const services = map(body.get('services', true));
        if (services) for (const service of services.items) image(service.value);
        else image(body.get('services', true));
      }
    }
    steps(map(top?.get('runs', true)));
  }
  return hits;
}

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

export function scan(files) {
  const lines = [];
  for (const file of files) {
    const name = relative(process.cwd(), file) || file;
    try {
      for (const hit of findUnpinned(readFileSync(file, 'utf8'))) lines.push(`${name}:${hit.line}: ${hit.ref}`);
    } catch (error) {
      lines.push(`${name}: could not read it as YAML: ${error.message.split('\n')[0]}`);
    }
  }
  return lines;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const files = process.argv.length > 2 ? process.argv.slice(2) : defaultFiles();
  if (files.length === 0) {
    console.error('pinned-actions: found no workflow or action files under .github');
    process.exit(1);
  }
  const lines = scan(files);
  if (lines.length > 0) {
    for (const line of lines) console.error(line);
    console.error(
      'pinned-actions: pin each action above to a full commit SHA, with its version in a comment, such as actions/checkout@11d5960a326750d5838078e36cf38b85af677262 # v4.4.0. Dependabot keeps the pins current. Pin each container or service image to its digest, such as alpine:3.20@sha256:<64 hex digits>.',
    );
    process.exit(1);
  }
}
