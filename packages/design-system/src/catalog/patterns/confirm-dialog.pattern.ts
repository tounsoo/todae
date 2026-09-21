import type { PatternMeta } from '../types.ts';

export const pattern = {
  id: 'confirm-dialog',
  name: 'Confirm dialog',
  description: 'Centered Dialog with title, body, and footer actions. Stays a dialog. No sheet morph.',
  whenToUse: [
    'Ask the user to confirm or cancel before a commit.',
    'For a destructive commit, label the confirm action clearly and keep the dialog centered.',
  ],
  whenNotToUse: [
    'Use BottomSheet when the task is a mobile sheet, not a confirm.',
    'Do not morph this dialog into a sheet.',
  ],
  intents: ['confirm', 'destructive-confirm'],
  uses: ['Dialog', 'Dialog.Header', 'Dialog.Title', 'Dialog.Body', 'Dialog.Footer', 'Button.Root'],
  tree: [
    {
      component: 'Dialog',
      props: { open: { $fill: 'open' } },
      children: [
        {
          component: 'Dialog.Header',
          children: [{ component: 'Dialog.Title', children: [{ $fill: 'title' }] }],
        },
        { component: 'Dialog.Body', children: [{ $fill: 'body' }] },
        {
          component: 'Dialog.Footer',
          children: [
            { component: 'Button.Root', props: { variant: 'ghost' }, children: [{ $fill: 'cancelLabel' }] },
            { component: 'Button.Root', children: [{ $fill: 'confirmLabel' }] },
          ],
        },
      ],
    },
  ],
  fills: [
    { name: 'open', description: 'Controlled open flag.' },
    { name: 'title', description: 'Dialog.Title copy.' },
    { name: 'body', description: 'Explanation in Dialog.Body.' },
    { name: 'cancelLabel', description: 'Ghost footer action that dismisses.' },
    { name: 'confirmLabel', description: 'Primary footer action that commits. Name the destructive verb when needed.' },
  ],
  docs: '/dialog',
} as const satisfies PatternMeta;
