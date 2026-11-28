/**
 * Why npm would refuse a new package name, after npm's own rules
 * (validate-npm-package-name): lowercase, at most 214 characters, URL-safe,
 * no leading dot or underscore, no ~'!()*, not a Node core module, and a
 * scope written as `@scope/name`.
 */
export type PackageNameProblem =
  | 'empty'
  | 'too-long'
  | 'uppercase'
  | 'spaces'
  | 'leading-dot-or-underscore'
  | 'special-character'
  | 'bad-scope'
  | 'not-url-safe'
  | 'reserved';

const MAX_LENGTH = 214;

// Node's core modules, which npm refuses as names. Inlined, since this also runs in the browser.
const RESERVED = new Set([
  'node_modules', 'favicon.ico',
  'assert', 'async_hooks', 'buffer', 'child_process', 'cluster', 'console', 'constants', 'crypto', 'dgram',
  'diagnostics_channel', 'dns', 'domain', 'events', 'fs', 'http', 'http2', 'https', 'inspector', 'module', 'net',
  'os', 'path', 'perf_hooks', 'process', 'punycode', 'querystring', 'readline', 'repl', 'stream', 'string_decoder',
  'sys', 'timers', 'tls', 'trace_events', 'tty', 'url', 'util', 'v8', 'vm', 'wasi', 'worker_threads', 'zlib',
]);

/** Null when npm accepts `name` for a new package, or else the first rule it breaks. */
export function packageNameProblem(name: string): PackageNameProblem | null {
  if (name.trim() === '') return 'empty';
  if (name.length > MAX_LENGTH) return 'too-long';
  if (name !== name.toLowerCase()) return 'uppercase';
  if (/\s/.test(name)) return 'spaces';
  if (/[~'!()*]/.test(name)) return 'special-character';
  if (RESERVED.has(name)) return 'reserved';
  let parts = [name];
  if (name.startsWith('@')) {
    const scoped = /^@([^/]+)\/([^/]+)$/.exec(name);
    if (!scoped) return 'bad-scope';
    parts = [scoped[1]!, scoped[2]!];
  } else if (name.includes('/')) {
    return 'bad-scope';
  }
  if (parts.some((part) => part.startsWith('.') || part.startsWith('_'))) return 'leading-dot-or-underscore';
  if (parts.some((part) => encodeURIComponent(part) !== part)) return 'not-url-safe';
  return null;
}
