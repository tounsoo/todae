import { describe, expect, it } from 'vitest';
import type { ComponentMeta, PropMeta } from '../src/meta.ts';
import { checkMetaTypes, loadMetas } from './meta-types.ts';

const prop = (name: string, type: string, required = false, more: Partial<PropMeta> = {}): PropMeta => ({
  name,
  type,
  required,
  description: '',
  ...more,
});
const meta = (name: string, ...props: PropMeta[]): ComponentMeta => ({ name, description: '', props });

// Each drifted meta and the one problem it must raise.
const drifted: [ComponentMeta, string][] = [
  [meta('Button.Root', prop('variant', 'string', false, { default: '"primary"' })), 'Button.Root variant: type is "string"'],
  [meta('Button.Root', prop('variant', '"primary" | "secondary"', false, { default: '"primary"' })), 'Button.Root variant: type is ""primary" | "secondary"",'],
  [meta('Button.Root', prop('variant', '"primary" | "secondary" | "ghost" | "outline"', false, { default: '"primary"' })), 'outline'],
  [meta('Button.Root', prop('tone', 'string')), 'Button.Root tone: TypeScript has no such prop'],
  [meta('Button.Root', prop('variant', '"primary" | "secondary" | "ghost"', true, { default: '"primary"' })), 'Button.Root variant: required is true'],
  [
    meta('Button.Root', prop('variant', '"primary" | "secondary" | "ghost"', false, { default: '"ghost"' })),
    'Button.Root variant: default is "ghost", the code defaults to "primary"',
  ],
  [meta('Button.Root', prop('variant', '"primary" | "secondary" | "ghost"')), 'Button.Root variant: has no default'],
  [meta('Button.Root', prop('variant', 'ButtonVariantz', false, { default: '"primary"' })), `Button.Root variant: type "ButtonVariantz" doesn't compile`],
  [meta('Button.Root', prop('type', '"button" | "submit" | "reset" | "image" | …', false, { default: '"button"' })), 'Button.Root type: type is'],
  [meta('useSelection', prop('keys', 'readonly string[]', true)), 'useSelection keys: type is "readonly string[]"'],
  [meta('formatNumber', prop('value', 'number', true), prop('options.locale', 'number')), 'formatNumber options.locale: type is "number"'],
  [meta('useHotkey', prop('enabled', 'boolean')), 'useHotkey enabled: TypeScript has no such prop'],
  [meta('Button.Nope'), 'Button.Nope: no such export'],
];

// Written correctly, these read each lookup rule and must raise nothing.
const correct: ComponentMeta[] = [
  // A union of shapes: Tabs.Root takes value with onValueChange, or defaultValue.
  meta('Tabs.Root', prop('value', 'string'), prop('defaultValue', 'string')),
  // An overload per mode, each with its own callback.
  meta('OptionList.Root', prop('onValueChange', '((value: string) => void) | ((value: string[]) => void)', true)),
  // A type parameter named in the meta stands for the export's own.
  meta('useSelection', prop('keys', 'readonly K[]', true)),
  // `| …` lists only some members.
  meta('Field.NumberInput', prop('inputMode', '"numeric" | "decimal" | …')),
  // A rest parameter, and a hook described by the function it returns.
  meta('composeRefs', prop('...refs', '(React.Ref<T> | undefined)[]')),
  meta('useAnnouncer', prop('message', 'string', true), prop('options.politeness', '"polite" | "assertive"', false, { default: '"polite"' })),
];

describe('meta types', () => {
  it('match the TypeScript types in every meta, and catch each kind of drift', { timeout: 120_000 }, async () => {
    const metas = await loadMetas();
    // One run for all three groups, since each run builds the whole package.
    const problems = checkMetaTypes([...metas, ...correct, ...drifted.map(([drift]) => drift)]);
    const raised = (group: readonly ComponentMeta[]) => problems.filter((problem) => group.includes(problem.meta)).map((problem) => problem.text);
    expect(raised(metas)).toEqual([]);
    expect(raised(correct)).toEqual([]);
    for (const [drift, text] of drifted) {
      const lines = raised([drift]);
      expect(lines).toHaveLength(1);
      expect(lines[0]).toContain(text);
    }
  });
});
