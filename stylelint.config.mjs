/** @type {import('stylelint').Config} */
export default {
  plugins: [
    './stylelint/no-raw-value.mjs',
    './stylelint/no-raw-literal.mjs',
    './stylelint/token-root-scope.mjs',
    './stylelint/local-custom-property.mjs',
    './stylelint/focus-ring-token.mjs',
    './stylelint/disabled-state.mjs',
  ],
  ignoreFiles: ['**/*.generated.css', '**/*.test.css', '**/*.stories.css', 'apps/docs/**'],
  rules: {
    'todae/no-raw-value': [true, { severity: 'error' }],
    'todae/no-raw-literal': [true, { severity: 'error' }],
    'todae/local-custom-property': [true, { severity: 'error' }],
    'todae/disabled-state': [true, { severity: 'error' }],
    'todae/token-root-scope': [
      true,
      {
        severity: 'error',
        // Components read contract tokens only. These sheets still read a core
        // spacing step for an anchor offset or a gap fallback.
        coreReads: {
          ChipList: ['space'],
          Field: ['space'],
        },
        // Contract groups every component shares.
        sharedRoots: ['overlay', 'focus'],
        // Which component's tokens each sheet reads, when its name is not the root.
        ownRoots: {
          BottomSheet: ['sheet'],
          OptionList: ['option'],
          Label: ['field'],
          Description: ['field'],
          ErrorMessage: ['field'],
          ChipList: ['chip'],
          // Native <select> options take the OptionList look.
          Field: ['field', 'option'],
          // A vertical group stacks with the toolbar gap, as a toolbar segment.
          ToggleGroup: ['togglegroup', 'toolbar'],
          // Progress and meter share one sheet.
          Progress: ['progress', 'meter'],
          ScrollArea: ['scroll'],
          ColorPicker: ['picker'],
          // A code block reads code.block and the font Code.Root shares.
          CodeBlock: ['code'],
        },
      },
    ],
    'todae/focus-ring-token': [
      true,
      {
        severity: 'error',
        // Pagination's forced-colors box around the current page is not a focus ring.
        outlineExceptions: [{ file: 'Pagination.module.css', value: '1px solid CanvasText' }],
      },
    ],
  },
};
