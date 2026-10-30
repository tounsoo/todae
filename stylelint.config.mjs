/** @type {import('stylelint').Config} */
export default {
  plugins: ['./stylelint/no-raw-value.mjs'],
  ignoreFiles: ['**/*.generated.css', '**/*.test.css', '**/*.stories.css', 'apps/docs/**'],
  rules: {
    'todae/no-raw-value': [true, { severity: 'error' }],
  },
};
