import type { ComponentMeta } from '../meta.ts';

export const meta = {
  name: 'Alert.Root',
  description: 'A status message in one of four tones. Takes native div attributes.',
  props: [
    {
      name: 'tone',
      type: '"info" | "success" | "warning" | "critical"',
      required: false,
      default: '"info"',
      description: 'Colors from color.status.<tone> through the alert contract tokens. Also picks the default role.',
    },
    {
      name: 'role',
      type: 'React.AriaRole',
      required: false,
      default: '"status" for info and success, "alert" for warning and critical',
      description: 'Live region role. Pass role="none" for a banner that is on the page from the start.',
    },
    {
      name: 'children',
      type: 'React.ReactNode',
      required: false,
      description: 'Alert parts, or any content.',
    },
  ],
} as const satisfies ComponentMeta;
