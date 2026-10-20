import { readFileSync } from 'node:fs';
import { packageFile } from './build';

const SOURCE = 'todae-docs' as const;
export const CHANGELOG_URL = 'https://github.com/tounsoo/todae/blob/main/packages/design-system/CHANGELOG.md';

const VERSION_RE = /^(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?$/;
// Entries written before the changelog template: "[#12](pr) [`abc1234`](commit) Thanks [@user](profile)! - summary".
const OLD_PREFIX_RE = /^(?:\[#(\d+)\]\([^)]*\) )?(?:\[`[0-9a-f]+`\]\([^)]*\) )?(?:Thanks .+?! )?- /;
// The template's ref at the end of the first line: "summary ([#12](pr))" or "summary ([`abc1234`](commit))".
const REF_RE = / \(\[(?:#(\d+)|`[0-9a-f]+`)\]\([^)]*\)\)$/;

export type ChangeEntry = { text: string; pullRequest?: number };
export type Release = { version: string; breaking: ChangeEntry[]; other: ChangeEntry[] };

/** Orders two versions as semver does, leaving out build metadata, which Todae doesn't use. */
export function compareVersions(a: string, b: string): number {
  const [, ...pa] = VERSION_RE.exec(a) ?? [];
  const [, ...pb] = VERSION_RE.exec(b) ?? [];
  if (pa.length === 0 || pb.length === 0) throw new Error(`Not a version: "${pa.length === 0 ? a : b}"`);
  for (let i = 0; i < 3; i++) {
    const diff = Number(pa[i]) - Number(pb[i]);
    if (diff !== 0) return diff;
  }
  // A prerelease comes before its release.
  if (pa[3] === pb[3]) return 0;
  if (pa[3] === undefined) return 1;
  if (pb[3] === undefined) return -1;
  return pa[3] < pb[3] ? -1 : 1;
}

function entry([head = '', ...rest]: string[]): ChangeEntry {
  let first = head;
  let pullRequest: number | undefined;
  const old = OLD_PREFIX_RE.exec(first);
  if (old) {
    first = first.slice(old[0].length);
    if (old[1]) pullRequest = Number(old[1]);
  } else {
    const ref = REF_RE.exec(first);
    if (ref) {
      first = first.slice(0, ref.index);
      if (ref[1]) pullRequest = Number(ref[1]);
    }
  }
  const text = [first, ...rest.map((line) => line.replace(/^ {2}/, ''))].join('\n').trim();
  return pullRequest === undefined ? { text } : { text, pullRequest };
}

/**
 * Reads the CHANGELOG.md the release workflow writes. A change is breaking when
 * it is under "Major Changes", or under "Minor Changes" before 1.0, since a
 * breaking change is a minor bump then.
 */
export function parseChangelog(markdown: string): Release[] {
  const releases: Release[] = [];
  let release: Release | undefined;
  let breaking = false;
  let lines: string[] | undefined;
  const flush = () => {
    if (release && lines) (breaking ? release.breaking : release.other).push(entry(lines));
    lines = undefined;
  };
  for (const line of markdown.replace(/\r\n/g, '\n').split('\n')) {
    const version = /^## (\S+)\s*$/.exec(line)?.[1];
    if (version !== undefined) {
      flush();
      if (!VERSION_RE.test(version)) throw new Error(`Unreadable changelog heading "${line}"`);
      const next: Release = { version, breaking: [], other: [] };
      releases.push(next);
      release = next;
      continue;
    }
    const section = /^### (\w+) Changes\s*$/.exec(line);
    if (section) {
      flush();
      breaking = section[1] === 'Major' || (section[1] === 'Minor' && release?.version.startsWith('0.') === true);
      continue;
    }
    if (line.startsWith('- ')) {
      flush();
      lines = [line.slice(2)];
    } else if (lines && (line.startsWith('  ') || line.trim() === '')) {
      lines.push(line);
    } else if (line.trim() !== '') {
      flush();
    }
  }
  flush();
  return releases.sort((a, b) => compareVersions(a.version, b.version));
}

let cached: Release[] | undefined;

function releases(): Release[] {
  if (!cached) {
    const file = packageFile(process.cwd(), 'CHANGELOG.md');
    if (!file) throw new Error("Could not find Todae's CHANGELOG.md");
    cached = parseChangelog(readFileSync(file, 'utf8'));
  }
  return cached;
}

/**
 * The released changes after `from` up to and including `to` (the latest
 * release unless given), oldest first, with each release's breaking changes
 * apart from the rest.
 */
export function getChanges({ from, to }: { from: string; to?: string }, all: Release[] = releases()) {
  const latest = all.at(-1)?.version;
  if (!latest) throw new Error('The changelog has no releases');
  const target = to ?? latest;
  compareVersions(from, target);
  if (!all.some((release) => release.version === target)) {
    throw new Error(`No release ${target}. The latest is ${latest}.`);
  }
  const picked = all.filter(
    (release) => compareVersions(release.version, from) > 0 && compareVersions(release.version, target) <= 0,
  );
  return {
    from,
    to: target,
    latest,
    breakingCount: picked.reduce((count, release) => count + release.breaking.length, 0),
    releases: picked,
    changelogUrl: CHANGELOG_URL,
    source: SOURCE,
  };
}
