import { block, fail, indent, type FlatToken } from './shared.ts';

/**
 * Checks a `--scope` selector before it goes into `@scope (…)` and `:is(…)`.
 * It can't be parsed without a browser, so this rejects what could end the
 * rule or the file early.
 */
export function parseScope(selector: string): string {
  const scope = selector.trim();
  if (scope === '') fail('--scope must be a CSS selector, such as ".brand-acme"');
  if (/[{};@]|<\/|<!--|\/\*|\*\/|-->/.test(scope)) {
    fail(`--scope "${scope}" must be a selector list without braces, semicolons, at-rules, "</" or comments`);
  }
  const closers: string[] = [];
  const members: string[] = [];
  let member = '';
  let quote: string | null = null;
  for (let i = 0; i < scope.length; i++) {
    const ch = scope[i]!;
    if (ch === '\\') {
      if (i + 1 === scope.length) fail(`--scope "${scope}" ends in a backslash`);
      member += ch + scope[++i];
      continue;
    }
    if (!quote && closers.length === 0 && ch === ',') {
      members.push(member);
      member = '';
      continue;
    }
    member += ch;
    if (quote) {
      if (ch === quote) quote = null;
      continue;
    }
    if (ch === '"' || ch === "'") quote = ch;
    else if (ch === '(') closers.push(')');
    else if (ch === '[') closers.push(']');
    else if ((ch === ')' || ch === ']') && closers.pop() !== ch) fail(`--scope "${scope}" has an unmatched "${ch}"`);
  }
  if (quote || closers.length > 0) fail(`--scope "${scope}" has an unclosed ${quote ? 'quote' : `"${closers.at(-1) === ')' ? '(' : '['}"`}`);
  for (const part of [...members, member].map((each) => each.trim())) {
    if (part === '') fail(`--scope "${scope}" has an empty selector in its list`);
    // Quoted strings can hold any character, so the checks below skip them.
    // An escape reads as the character it stands for, so `:befor\65` is still
    // a pseudo-element, except an escaped ":" or combinator, which is part of a name.
    const bare = part
      .replace(/\\([0-9a-fA-F]{1,6})(?:\r\n|[ \t\n\r\f])?|\\(.)/g, (_, hex: string | undefined, ch: string | undefined) => {
        const char = hex === undefined ? ch! : String.fromCodePoint(Math.min(Number.parseInt(hex, 16), 0x10ffff) || 0xfffd);
        return /[\w-]/.test(char) ? char : 'x';
      })
      .replace(/"[^"]*"|'[^']*'/g, '""');
    if (/^[>+~]|[>+~]$/.test(bare)) fail(`--scope "${scope}" must not start or end a selector with a combinator`);
    if (bare.includes('<')) fail(`--scope "${scope}" has a "<" outside a quoted value`);
    if (/::|:(before|after|first-line|first-letter)(?![\w-])/i.test(bare)) fail(`--scope "${scope}" must not hold a pseudo-element`);
  }
  return scope;
}

/**
 * Rules for a scope element without the modifier's attribute, outside
 * `@scope (S)`: it takes the context of the nearest element around it that
 * has the attribute (the `to` limit stops at a nearer one), the same under
 * "system" in `media`, or the default when no element has the attribute.
 */
export function scopeFallbacks(
  scope: string,
  attribute: string,
  context: string,
  lines: string[],
  { rootDefault, media }: { rootDefault: boolean; media: string | null },
): string[] {
  const bare = `:is(${scope}):not([${attribute}])`;
  const nearest = (value: string) => block(`@scope ([${attribute}="${value}"]) to ([${attribute}])`, indent(block(bare, lines)));
  return [
    ...nearest(context),
    ...(rootDefault ? block(`${bare}:not([${attribute}] *)`, lines) : []),
    ...(media ? block(`@media ${media}`, indent(nearest('system'))) : []),
  ];
}

export function clearedInputs(tokens: FlatToken[]): string {
  return tokens.map((t) => `  --_${t.cssVar.slice(2)}: initial;`).join('\n');
}
