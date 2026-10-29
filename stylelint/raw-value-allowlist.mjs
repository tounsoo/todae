/**
 * Literals a component sheet may use without a token.
 * `var(--…)` is allowed in the rule. It is a token reference, not a literal.
 * Every entry has a reason.
 */

export const allowlist = [
  // Unitless zero. It is no length, not a chosen size.
  { value: '0' },
  // The whole percentage axis. A chosen fraction such as 50% is not this.
  { value: '100%' },
  // The element's own color. Not a palette color.
  { value: 'currentcolor' },
  // No paint.
  { value: 'transparent' },
  // Take the parent value.
  { value: 'inherit' },
  // The property's automatic value.
  { value: 'auto' },
  // Hairline border and outline widths only. Button floors a border at 1px, and forced-colors rings use a 1px border or outline. This check adds no token.
  { value: '1px', where: 'hairline' },
];
