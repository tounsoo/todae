import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ESLint } from 'eslint';

const eslint = new ESLint({ cwd: new URL('..', import.meta.url).pathname });

async function banned(file, code) {
  const [result] = await eslint.lintText(code, { filePath: `packages/design-system/src/${file}` });
  return result.messages.filter((m) => m.ruleId === 'todae/layer-imports').length;
}

test('hooks/, overlay/ and mentions/ take only types from components/, in every spelling', async () => {
  const runtime = [
    "import { Button } from '../components/Button.js';",
    "import { Button } from './../components/Button.js';",
    "import { Button } from '../hooks/../components/Button.js';",
    "import { Button } from '../components';",
    "import { Button } from '../index.ts';",
    "import { Button } from '../index.js';",
    "import { Button } from '..';",
    "import { Button } from '@tounsoo/todae';",
    "import { Text } from '../server/text.js';",
    "import { type ButtonRootProps } from '../components/Button.js';",
    "export { type ButtonRootProps } from '../components/Button.js';",
    "export * from '../components/Button.js';",
    "export const lazy = () => import('../components/Button.js');",
    'export const lazy = () => import(`../components/Button.js`);',
    'export const lazy = (p: string) => import(p);',
  ];
  for (const file of ['hooks/useX.ts', 'overlay/x.ts', 'mentions/x.ts']) {
    for (const code of runtime) assert.equal(await banned(file, code), 1, `${file}: ${code}`);
  }
  assert.equal(await banned('overlay/sub/x.ts', "import { Button } from '../../components/Button.js';"), 1);
});

test('type-only imports from components/ and imports of hooks/, overlay/ and internal/ pass', async () => {
  const fine = [
    "import type { ButtonRootProps } from '../components/Button.js';",
    "export type { ButtonRootProps } from '../components/Button.js';",
    "type P = import('../components/Button.js').ButtonRootProps;",
    "import { cx } from '../internal/cx.js';",
    "import { useControlledState } from '../hooks/useControlledState.js';",
    "import { useId } from 'react';",
  ];
  for (const code of fine) assert.equal(await banned('overlay/x.ts', code), 0, code);
});

test('internal/ imports nothing else in the package, types included', async () => {
  const outside = [
    "import { useControlledState } from '../hooks/useControlledState.js';",
    "import { useControlledState } from './../hooks/useControlledState.js';",
    "import type { ButtonRootProps } from '../components/Button.js';",
    "export const lazy = () => import('./../hooks/useControlledState.js');",
    'export const lazy = () => import(`../components/Button.js`);',
    "import { Button } from '@tounsoo/todae';",
  ];
  for (const code of outside) assert.equal(await banned('internal/x.ts', code), 1, code);
  assert.equal(await banned('internal/x.ts', "import { cx } from './cx.js';\nimport { useId } from 'react';"), 0);
});

test('components/ may import any layer', async () => {
  assert.equal(await banned('components/X.tsx', "import { usePopover } from '../hooks/usePopover.js';"), 0);
});
