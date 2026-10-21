import type { ComponentMeta } from '../meta.ts';

export const meta = {
  name: 'Avatar.Group',
  description:
    'A div with role="group" that stacks several Avatar.Root, each over the one before, with a ring in the surface color. Name it with aria-label or aria-labelledby. Takes native div attributes except role.',
  props: [
    {
      name: 'aria-label',
      type: 'string',
      required: false,
      description: 'Accessible name for the group, such as "Assignees".',
    },
    {
      name: 'size',
      type: '"sm" | "md" | "lg"',
      required: false,
      default: '"md"',
      description: 'Size for the avatars inside that set no size of their own. The overlap is a fraction of it, from avatar.group.overlap.',
    },
    {
      name: 'children',
      type: 'React.ReactNode',
      required: false,
      description: 'Avatar.Root elements, one of them optionally a +N count.',
    },
  ],
} as const satisfies ComponentMeta;
