import type { ComponentMeta } from '../meta.ts';

export const meta = {
  name: 'useDropzone',
  description:
    'Returns { dragging, getRootProps, getInputProps }. Spread getInputProps on a native <input type="file"> and getRootProps on the drop target, usually the label around it, so a click and the keyboard open the file picker natively. Dropped folders are skipped. Files from a drop or a pick are checked against accept, maxSize, minSize and the file count, then passed to onFiles. In the browser, the input keeps only the accepted files, so a native form submits them. onFiles also runs when the picker returns no files. dragging, and data-dragging on the root, are set while files are dragged over the root.',
  props: [
    {
      name: 'accept',
      type: 'string',
      required: false,
      description: "File types to take, in the input's accept syntax: '.pdf', 'image/*', 'application/json', comma separated. Checked on drop too.",
    },
    {
      name: 'multiple',
      type: 'boolean',
      required: false,
      default: 'false',
      description: 'Take more than one file.',
    },
    {
      name: 'maxFiles',
      type: 'number',
      required: false,
      description: "Most files to take when multiple is set. Files past it are rejected as 'too-many'.",
    },
    {
      name: 'maxSize',
      type: 'number',
      required: false,
      description: 'Largest file size in bytes.',
    },
    {
      name: 'minSize',
      type: 'number',
      required: false,
      description: 'Smallest file size in bytes.',
    },
    {
      name: 'disabled',
      type: 'boolean',
      required: false,
      default: 'false',
      description: 'Turn off the input and drops.',
    },
    {
      name: 'onFiles',
      type: '(accepted: File[], rejected: FileRejection[]) => void',
      required: false,
      description: 'Called with the files that passed and the files that did not, after a drop or a pick.',
    },
  ],
} as const satisfies ComponentMeta;
