import type { ComponentMeta } from '../meta.ts';

export const meta = {
  name: 'Chip.Root',
  description: 'Text-only label with optional named remove button. Overflow +N is Chip.Overflow.',
  props: [
    {
      name: 'children',
      type: 'string',
      required: true,
      description: 'Chip label. Text only.',
    },
    {
      name: 'tone',
      type: '"neutral" | "info" | "success" | "warning" | "critical" | "category-1" | "category-2" | "category-3" | "category-4" | "category-5" | "category-6" | "category-7" | "category-8"',
      required: false,
      default: '"neutral"',
      description: 'neutral reads the chip.bg, chip.fg and chip.border state tokens; other tones read the chip.<tone> contract tokens. A disabled chip takes the disabled colors instead.',
    },
    {
      name: 'onRemove',
      type: '() => void',
      required: false,
      description: 'Renders a named remove button.',
    },
    {
      name: 'removeLabel',
      type: 'string',
      required: false,
      description: 'Remove button aria-label. Default is the removeChip string from StringsProvider, Remove {label} in English.',
    },
    {
      name: 'removeIcon',
      type: 'React.ReactNode',
      required: false,
      description: "Remove button content, such as an icon from your own set. Without it, the close glyph from GlyphsProvider, else Todae's cross.",
    },
    {
      name: 'disabled',
      type: 'boolean',
      required: false,
      default: 'false',
      description: 'Disables the remove button.',
    },
  ],
} as const satisfies ComponentMeta;
