import type { ComponentMeta } from '../meta.ts';

export const meta = {
  name: 'cssVarName',
  description: 'cssVarName(path) returns the custom property for a token path: --todae- followed by the path with dots as hyphens, so color.fg.default is --todae-color-fg-default.',
  props: [
    {
      name: 'path',
      type: 'string',
      required: true,
      description: 'A dotted token path. It is not checked against the token list.',
    },
  ],
} as const satisfies ComponentMeta;
