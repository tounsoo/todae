import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { ENGINES, macosEntry, macosOnly } from '../../../../browser.host';
import { firefoxQuarantine } from '../../scripts/firefox-quarantine';

const repo = join(import.meta.dirname, '../../../..');

// A test whose name it.each, describe.each or a template literal builds is not in its file as it is: a
// quoted name holds %s or %i, and a template literal holds ${...}. Each such name, as a matcher for the names
// it gives. Any other name is in the file as it is.
function builtNames(source: string): ((name: string) => boolean)[] {
  const escape = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const quoted = [...source.matchAll(/'((?:\\.|[^'\\\n])*%[sdif](?:\\.|[^'\\\n])*)'/g)].map(([, text]) =>
    escape(text!.replace(/\\(.)/g, '$1')).replace(/%[sdif]/g, '.+'),
  );
  const templates = [...source.matchAll(/`([^`\n]*\$\{[^`\n]*)`/g)].map(([, text]) =>
    text!.split(/\$\{[^}]*\}/).map(escape).join('.+'),
  );
  return [...quoted, ...templates].map((pattern) => {
    const match = new RegExp(`^${pattern}$`);
    return (name: string) => match.test(name);
  });
}

// browser.host.ts at the repo root holds the list; the package's unit tests check it for both apps.
describe('the macOS host list', () => {
  it('skips nothing on Linux or Windows, where CI and most contributors run', () => {
    for (const entry of macosOnly) {
      for (const platform of ['linux', 'win32']) expect(macosEntry(platform, entry.engines[0]!, entry.file, entry.test)).toBeUndefined();
    }
  });

  it('skips an entry only in the engines it names, from the absolute path Vitest gives', () => {
    for (const entry of macosOnly) {
      for (const engine of ENGINES) {
        const found = macosEntry('darwin', engine, join(repo, entry.file), entry.test);
        expect(found === entry).toBe(entry.engines.includes(engine));
      }
    }
    expect(macosEntry('darwin', 'webkit', '/elsewhere/other.browser.test.tsx', macosOnly[0]?.test)).toBeUndefined();
  });

  // firefox-quarantine.ts fails CI's Firefox run when a quarantined test is skipped, so the two lists never share
  // a Firefox test. A quarantined test runs in Firefox on a Mac too, and the quarantine judges it there.
  it('skips no Firefox test that the Firefox quarantine holds', () => {
    const quarantined = new Set(firefoxQuarantine.map((entry) => `packages/design-system/${entry.file} ${entry.test}`));
    const both = macosOnly.filter((entry) => entry.engines.includes('firefox') && quarantined.has(`${entry.file} ${entry.test}`));
    expect(both).toEqual([]);
  });

  // A renamed or deleted test would leave an entry that skips nothing, and hide that the list is stale.
  it('names tests that exist, each once, with a reason', () => {
    const seen = new Set<string>();
    for (const entry of macosOnly) {
      const source = readFileSync(join(repo, entry.file), 'utf8');
      // A name such as 'keeps the dialog\'s own focus' is escaped in the file.
      const unescaped = source.replace(/\\(['"`])/g, '$1');
      const built = builtNames(source);
      for (const name of entry.test.split(' > ')) {
        expect(unescaped.includes(name) || built.some((match) => match(name)), `${entry.file}: ${name}`).toBe(true);
      }
      expect(entry.engines.length).toBeGreaterThan(0);
      expect(entry.reason.trim()).not.toBe('');
      const key = `${entry.file} ${entry.test}`;
      expect(seen.has(key), key).toBe(false);
      seen.add(key);
    }
  });
});
