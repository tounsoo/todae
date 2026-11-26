import { describe, it } from 'node:test';
import { RuleTester } from 'eslint';
import tseslint from 'typescript-eslint';
import plugin from './todae.mjs';

// layer-imports.test.mjs covers layer-imports through the repo config. These cover the other rules alone.
RuleTester.describe = describe;
RuleTester.it = it;
RuleTester.itOnly = it.only;

const tester = new RuleTester({
  languageOptions: {
    parser: tseslint.parser,
    parserOptions: { ecmaFeatures: { jsx: true } },
  },
});
const src = (file) => `${new URL('..', import.meta.url).pathname}packages/design-system/src/${file}`;

tester.run('use-client-placement', plugin.rules['use-client-placement'], {
  valid: [
    { code: "'use client';\nexport {};", filename: src('index.ts') },
    { code: "'use client';\nexport {};", filename: src('providers/StringsProvider.tsx') },
    { code: 'export {};', filename: src('components/Button.tsx') },
  ],
  invalid: [
    { code: "'use client';\nexport {};", filename: src('components/Button.tsx'), errors: [{ messageId: 'misplaced' }] },
    { code: "import 'x';\n'use client';", filename: src('index.ts'), errors: [{ messageId: 'misplaced' }] },
    { code: "'use client';\nexport {};", filename: src('providers/helpers.tsx'), errors: [{ messageId: 'misplaced' }] },
  ],
});

tester.run('focus-without-scroll', plugin.rules['focus-without-scroll'], {
  valid: [
    'el.focus();',
    'el.focus({ preventScroll: false });',
    'function focusWithoutScroll(el) { el.focus({ preventScroll: true }); }',
  ],
  invalid: [
    { code: 'el.focus({ preventScroll: true });', errors: [{ messageId: 'banned' }] },
    { code: "el.focus({ 'preventScroll': true });", errors: [{ messageId: 'banned' }] },
  ],
});

tester.run('no-hidden-type', plugin.rules['no-hidden-type'], {
  valid: ['<input type="text" />', '<input type={kind} />', '<input hidden />'],
  invalid: [
    { code: '<input type="hidden" />', errors: [{ messageId: 'banned' }] },
    { code: "<input type={'hidden'} />", errors: [{ messageId: 'banned' }] },
  ],
});

tester.run('prop-naming', plugin.rules['prop-naming'], {
  valid: [
    'type ButtonProps = { disabled?: boolean; invalid?: boolean };',
    'interface FieldProps { disabled?: boolean }',
    // Only *Props types are props.
    'type State = { isOpen: boolean };',
  ],
  invalid: [
    { code: 'interface ButtonProps { isDisabled?: boolean }', errors: [{ messageId: 'banned', data: { name: 'isDisabled' } }] },
    { code: 'type FieldProps = { error?: string };', errors: [{ messageId: 'banned', data: { name: 'error' } }] },
    {
      code: "type FieldProps = Base & ({ hasError?: boolean } | { 'isInvalid'?: boolean });",
      errors: [
        { messageId: 'banned', data: { name: 'hasError' } },
        { messageId: 'banned', data: { name: 'isInvalid' } },
      ],
    },
  ],
});

tester.run('dev-only-diagnostics', plugin.rules['dev-only-diagnostics'], {
  valid: [
    "if (process.env.NODE_ENV !== 'production') console.warn('x');",
    "if (ready && process.env.NODE_ENV !== 'production') { console.error('x'); }",
    "function f() { if (process.env.NODE_ENV === 'production') return; console.warn('x'); }",
    "const DEV = process.env.NODE_ENV !== 'production';\nif (DEV) console.warn('x');",
    "const DEV = process.env.NODE_ENV !== 'production';\nfunction f() { if (!DEV) return; console.info('x'); }",
    // Not a diagnostic method.
    'console.table(rows);',
  ],
  invalid: [
    { code: "console.warn('x');", errors: [{ messageId: 'banned' }] },
    { code: "if (process.env.NODE_ENV === 'production') console.warn('x');", errors: [{ messageId: 'banned' }] },
    { code: "if (ready || process.env.NODE_ENV !== 'production') console.log('x');", errors: [{ messageId: 'banned' }] },
    // DEV counts only when it is defined from NODE_ENV.
    { code: "const DEV = true;\nif (DEV) console.warn('x');", errors: [{ messageId: 'banned' }] },
    { code: "console['error']('x');", errors: [{ messageId: 'banned' }] },
  ],
});
