import { readFileSync } from 'node:fs';
import { packageFile } from './package-file';

const SOURCE = 'todae-docs' as const;
export const CHANGELOG_URL = 'https://github.com/tounsoo/todae/blob/main/packages/design-system/CHANGELOG.md';

/** A release version. Todae has no prereleases, so a prerelease heading in the changelog is an error rather than misordered. */
export const VERSION_RE = /^(\d+)\.(\d+)\.(\d+)$/;
// Entries written before the changelog template: "[#12](pr) [`abc1234`](commit) Thanks [@user](profile)! - summary".
const OLD_PREFIX_RE = /^(?:\[#(\d+)\]\([^)]*\) )?(?:\[`[0-9a-f]+`\]\([^)]*\) )?(?:Thanks .+?! )?- /;
// The template's ref at the end of the first line: "summary ([#12](…/pull/12))" or "summary ([`abc1234`](…/commit/abc1234…))".
// Matching on the URL keeps an issue link that ends a summary, "([#5](…/issues/5))", in the text.
const REF_RE = / \((?:\[#(\d+)\]\([^)]*\/pull\/\d+\)|\[`[0-9a-f]+`\]\([^)]*\/commit\/[0-9a-f]+\))\)$/;

export type ChangeEntry = { text: string; pullRequest?: number };
export type Release = { version: string; breaking: ChangeEntry[]; other: ChangeEntry[] };

function parts(version: string): [number, number, number] {
  const match = VERSION_RE.exec(version);
  if (!match) throw new Error(`Not a version: "${version}". Use one such as 0.2.0.`);
  return [Number(match[1]), Number(match[2]), Number(match[3])];
}

/** Orders two release versions. */
export function compareVersions(a: string, b: string): number {
  const pa = parts(a);
  const pb = parts(b);
  return pa[0] - pb[0] || pa[1] - pb[1] || pa[2] - pb[2];
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
  // Where the next entry goes: the release's breaking or other list, once a section heading picks one.
  let bucket: ChangeEntry[] | undefined;
  let lines: string[] | undefined;
  const flush = () => {
    if (bucket && lines) bucket.push(entry(lines));
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
      bucket = undefined;
      continue;
    }
    const heading = /^### (Major|Minor|Patch) Changes\s*$/.exec(line)?.[1];
    if (heading !== undefined) {
      flush();
      if (!release) throw new Error(`Changelog section before any release: "${line}"`);
      const breaking = heading === 'Major' || (heading === 'Minor' && parts(release.version)[0] === 0);
      bucket = breaking ? release.breaking : release.other;
      continue;
    }
    if (line.startsWith('- ')) {
      flush();
      if (!bucket) throw new Error(`Changelog entry outside a release's change section: "${line}"`);
      lines = [line.slice(2)];
    } else if (lines && (line.startsWith('  ') || line.trim() === '')) {
      lines.push(line);
    } else if (line.trim() !== '') {
      flush();
      // Before the first release is the title. Changesets writes this line for a release with no entries.
      if (release && line.trim() !== 'No changes in this release.') {
        throw new Error(`Unreadable changelog line "${line}"`);
      }
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
  if (compareVersions(from, target) > 0) {
    throw new Error(`from ${from} is after ${to === undefined ? `the latest release, ${target}` : `to, ${target}`}`);
  }
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
