import { describe, expect, it } from 'vitest';
import { packageNameProblem } from './packageName';

describe('packageNameProblem', () => {
  it.each(['acme-tokens', 'acme.tokens', 'acme_tokens', 'a', '@acme/tokens', '@acme-co/design.tokens', 'tokens2', 'a'.repeat(214),
    // npm checks a leading dot or underscore on the whole name, and ~'!()* on the part after the scope only.
    '@acme/.tokens', '@acme/_tokens', '@acme~/tokens'])(
    'accepts %s, which npm publishes',
    (name) => {
      expect(packageNameProblem(name)).toBeNull();
    },
  );

  it.each([
    ['', 'empty'],
    ['   ', 'empty'],
    ['a'.repeat(215), 'too-long'],
    ['Acme-Tokens', 'uppercase'],
    ['@Acme/tokens', 'uppercase'],
    [' acme', 'spaces'],
    ['acme tokens', 'spaces'],
    ['.acme', 'leading-dot-or-underscore'],
    ['_acme', 'leading-dot-or-underscore'],
    ['acme~tokens', 'special-character'],
    ["acme'tokens", 'special-character'],
    ['acme!', 'special-character'],
    ['acme(tokens)', 'special-character'],
    ['acme*', 'special-character'],
    ['@acme/tokens!', 'special-character'],
    ['acme/tokens', 'bad-scope'],
    ['@acme', 'bad-scope'],
    ['@/tokens', 'bad-scope'],
    ['@acme/', 'bad-scope'],
    ['@acme/tokens/extra', 'bad-scope'],
    ['acme:tokens', 'not-url-safe'],
    ['acme%20', 'not-url-safe'],
    ['tokens€', 'not-url-safe'],
    ['node_modules', 'reserved'],
    ['favicon.ico', 'reserved'],
    ['fs', 'reserved'],
    ['http', 'reserved'],
  ])('rejects %j as %s', (name, problem) => {
    expect(packageNameProblem(name)).toBe(problem);
  });
});
