import type { PatternMeta } from '../types.ts';

export const pattern = {
  id: 'combobox-popover',
  name: 'Combobox popover',
  description: 'Desktop combobox recipe. Closed control is a Field. List lives in Popover.',
  whenToUse: [
    'Search-select on a wide pointer viewport.',
    'Spread getAnchorProps onto Field.Root. Do not also spread usePopover getTriggerProps.',
  ],
  whenNotToUse: [
    'Use combobox-sheet when the closed control is a Button and the list is a BottomSheet.',
    'Do not export Combobox.* chrome. This is a recipe, not a namespace.',
  ],
  intents: ['search-select', 'tag-entry', 'choose-one', 'choose-many'],
  uses: ['Label', 'Field.Root', 'Field.Icon', 'Field.ChipInput', 'Popover', 'OptionList'],
  hooks: [{ id: 'useCombobox', as: 'cb' }],
  tree: [
    {
      component: 'Label',
      props: { htmlFor: { $fill: 'inputId' }, children: { $fill: 'label' } },
    },
    {
      component: 'Field.Root',
      spread: 'cb.getAnchorProps()',
      children: [
        { component: 'Field.Icon', children: [{ $fill: 'leadingIcon' }] },
        { component: 'Field.ChipInput', spread: 'cb.getChipInputProps()' },
        { component: 'Field.Icon', children: [{ $fill: 'trailingIcon' }] },
      ],
    },
    {
      component: 'Popover',
      spread: 'cb.getPopoverProps()',
      children: [{ component: 'OptionList', spread: 'cb.getListboxProps()', children: [{ $fill: 'options' }] }],
    },
  ],
  fills: [
    { name: 'inputId', description: 'Id shared by Label htmlFor and the combobox input.' },
    { name: 'label', description: 'Visible field caption.' },
    { name: 'leadingIcon', description: 'Decorative or search icon before the input.' },
    { name: 'trailingIcon', description: 'Decorative chevron after the input.' },
    { name: 'options', description: 'Option or OptionList.Option children for the current query.' },
  ],
  docs: '/combobox',
} as const satisfies PatternMeta;
