export const allowlist = [
  // Unitless zero. It is no length, not a chosen size.
  { value: '0' },
  // Same length as unitless zero. The unit does not choose a size.
  { value: '0px' },
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
  // Scales with the element's font. Not a type-scale step.
  {
    value: '1em',
    where: 'font-size',
    files: ['Code.module.css', 'CodeBlock.module.css', 'Kbd.module.css'],
  },
  // A marker, inset, or check offset in em, so it tracks that element's font.
  {
    value: '1em',
    where: 'spacing',
    files: ['Disclosure.module.css', 'Menu.module.css', 'OptionList.module.css'],
  },
  // The element's own line box. Not a chosen gap.
  { value: '1lh', where: 'spacing', files: ['Field.module.css', 'Steps.module.css'] },
  // Pulls a 1px clip box out of the layout. Not a spacing step.
  {
    value: '-1px',
    where: 'spacing',
    files: ['ColorPicker.module.css', 'Nav.module.css', 'VisuallyHidden.module.css'],
  },
  // HSV black. The model's end, not a theme color.
  { value: 'black', where: 'background', files: ['ColorPicker.module.css'] },
  // HSV white. The model's end, not a theme color.
  { value: 'white', where: 'background', files: ['ColorPicker.module.css'] },
  // Each stacked toast is a fraction narrower than the one in front.
  { value: '2.5%', where: 'spacing', files: ['Toast.module.css'] },
  // The radio dot's margin inside its indicator.
  { value: '30%', where: 'spacing', files: ['selection.module.css'] },
];
