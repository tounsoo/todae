import js from '@eslint/js';
import globals from 'globals';
import reactHooks from 'eslint-plugin-react-hooks';
import tseslint from 'typescript-eslint';
import eslintComments from '@eslint-community/eslint-plugin-eslint-comments';
import todae from './eslint/todae.mjs';

export default tseslint.config(
  {
    ignores: ['**/dist/**', '**/.next/**', '**/node_modules/**', '**/*.generated.*', 'apps/docs/next-env.d.ts', 'examples/ssr-smoke/next-env.d.ts', '.cursor/**', '.claude/**', '**/graft/**', '**/.graft/**'],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['**/*.{ts,tsx,js,mjs}'],
    linterOptions: {
      reportUnusedDisableDirectives: 'error',
    },
    languageOptions: {
      globals: { ...globals.browser, ...globals.node },
    },
    plugins: { 'react-hooks': reactHooks, 'eslint-comments': eslintComments },
    rules: {
      // The classic hook rules. The React Compiler rules in the plugin's
      // recommended preset flag the latest-value ref pattern used across the
      // overlays, so they stay off until that pattern is reworked.
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'error',
      'eslint-comments/require-description': 'error',
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_' },
      ],
    },
  },
  {
    files: ['packages/design-system/src/**/*.{ts,tsx}'],
    ignores: ['packages/design-system/src/**/*.test.ts', 'packages/design-system/src/**/*.test.tsx'],
    plugins: { todae },
    rules: {
      'todae/use-client-placement': 'error',
      'todae/focus-without-scroll': 'error',
      'todae/no-hidden-type': 'error',
      'todae/prop-naming': 'error',
      'todae/dev-only-diagnostics': 'error',
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
