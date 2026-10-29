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
  // Circle and ellipse radii. Half of each side is the shape, not a chosen corner size. This check adds no token.
  { value: '50%', where: 'circle' },
  // End stop of a longer-hue gradient. hsl(360) is the same hue as hsl(0). This check adds no token.
  { value: '360', where: 'hue' },
];
