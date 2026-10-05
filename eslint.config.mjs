import js from '@eslint/js';
import globals from 'globals';
import reactHooks from 'eslint-plugin-react-hooks';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    ignores: ['**/dist/**', '**/.next/**', '**/node_modules/**', '**/*.generated.*', 'apps/docs/next-env.d.ts', '.cursor/**', '**/graft/**', '**/.graft/**'],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['**/*.{ts,tsx,js,mjs}'],
    languageOptions: {
      globals: { ...globals.browser, ...globals.node },
    },
    plugins: { 'react-hooks': reactHooks },
    rules: {
      // The classic hook rules. The React Compiler rules in the plugin's
      // recommended preset flag the latest-value ref pattern used across the
      // overlays, so they stay off until that pattern is reworked.
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'error',
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_' },
      ],
    },
  },
  {
    // Test fixtures poke at loosely typed JSON and mixed element refs.
    files: ['**/*.test.{ts,tsx}'],
    rules: { '@typescript-eslint/no-explicit-any': 'off' },
  },
  {
    // TypeScript already checks undefined names.
    files: ['**/*.{ts,tsx}'],
    rules: { 'no-undef': 'off' },
  },
);
