import type { ComponentMeta } from '../meta.ts';

export const meta = {
  name: 'useStrings',
  description:
    "useStrings() returns the strings in effect: the nearest StringsProvider's, merged over its parents', else English. Use it in your own components for text Todae's strings cover.",
  props: [],
} as const satisfies ComponentMeta;
