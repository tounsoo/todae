let seen: Set<string> | undefined;

/** Development only: logs `message` the first time `key` is seen for the page's life, however many components or renders hit it. */
export function warnOnce(key: string, message: string, level: 'warn' | 'error' = 'warn'): void {
  if (process.env.NODE_ENV === 'production') return;
  seen ??= new Set();
  if (seen.has(key)) return;
  seen.add(key);
  console[level](message);
}

/** Lets a test see a message again. */
export function resetWarnOnce(): void {
  seen?.clear();
}
