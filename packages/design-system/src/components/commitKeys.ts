export const CHIP_COMMIT_KEYS = ['Enter', 'Tab', ',', ';', ' '] as const;

export type ChipCommitKey = (typeof CHIP_COMMIT_KEYS)[number];

const ALLOWED = new Set<string>(CHIP_COMMIT_KEYS);

export function isCommitKey(key: string): key is ChipCommitKey {
  return ALLOWED.has(key);
}

export function resolveCommitKeys(keys?: readonly string[]): readonly ChipCommitKey[] {
  if (!keys) return ['Enter'];
  const allowed = keys.filter(isCommitKey);
  if (allowed.length !== keys.length && process.env.NODE_ENV !== 'production') {
    console.error('ChipField commitKeys must be a closed allowlist of Enter, Tab, comma, semicolon, or space');
  }
  return allowed.length > 0 ? allowed : ['Enter'];
}
