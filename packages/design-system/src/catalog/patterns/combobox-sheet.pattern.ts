import type { PatternMeta } from '../types.ts';

export const pattern = {
  id: 'combobox-sheet',
  name: 'Combobox sheet',
  description: 'Touch combobox recipe. Closed control is Button.Root. Search Field lives inside BottomSheet.',
  whenToUse: [
    'Search-select on a coarse pointer or a narrow viewport.',
    'Spread getTriggerProps onto Button.Root. Put the search Field inside the sheet.',
  ],
  whenNotToUse: [
    'Use combobox-popover when the closed control is a Field anchored to a Popover.',
    'Do not pretend Field.Root is the touch trigger.',
  ],
  intents: ['search-select', 'choose-one', 'choose-many', 'contextual-overlay'],
  uses: ['Button.Root', 'BottomSheet', 'Label', 'Field.Root', 'Field.Icon', 'Field.TextInput', 'OptionList'],
  hooks: [{ id: 'useCombobox', as: 'cb' }],
  tree: [
    {
      component: 'Button.Root',
      spread: 'cb.getTriggerProps()',
      children: [{ $fill: 'triggerLabel' }],
    },
    {
      component: 'BottomSheet',
      spread: 'cb.getSheetProps()',
      children: [
        {
          component: 'Label',
          props: { htmlFor: { $fill: 'inputId' }, children: { $fill: 'label' } },
        },
        {
          component: 'Field.Root',
          props: { id: { $fill: 'inputId' } },
          children: [
            { component: 'Field.Icon', children: [{ $fill: 'leadingIcon' }] },
            { component: 'Field.TextInput', spread: 'cb.getInputProps()' },
          ],
        },
        { component: 'OptionList', spread: 'cb.getListboxProps()', children: [{ $fill: 'options' }] },
      ],
    },
  ],
  fills: [
    { name: 'triggerLabel', description: 'Closed-control label on Button.Root.' },
    { name: 'inputId', description: 'Id shared by the in-sheet Label and Field.Root.' },
    { name: 'label', description: 'Visible search caption inside the sheet.' },
    { name: 'leadingIcon', description: 'Decorative search icon.' },
    { name: 'options', description: 'Option or OptionList.Option children for the current query.' },
  ],
  docs: '/combobox',
} as const satisfies PatternMeta;
