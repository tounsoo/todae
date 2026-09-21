export const INTENTS = [
  'choose-one',
  'choose-many',
  'toggle',
  'text-entry',
  'tag-entry',
  'search-select',
  'confirm',
  'destructive-confirm',
  'contextual-overlay',
  'transient-hint',
  'label',
  'helper-text',
  'validation-message',
  'layout',
  'typography',
  'action',
  'theme',
  'density',
] as const;

export type Intent = (typeof INTENTS)[number];

export type EntryKind = 'component' | 'part' | 'hook' | 'provider';

export type PropMeta = {
  name: string;
  type: string;
  required: boolean;
  default?: string;
  description: string;
};

export type SlotMeta = {
  name: string;
  accepts: readonly string[];
  required: boolean;
  description: string;
};

export type Relation = {
  id: string;
  relation: 'alternative' | 'pairsWith' | 'partOf' | 'requires';
};

export type ComponentMeta = {
  name: string;
  kind: EntryKind;
  description: string;
  whenToUse: readonly string[];
  whenNotToUse: readonly string[];
  intents: readonly Intent[];
  props: readonly PropMeta[];
  slots?: readonly SlotMeta[];
  related?: readonly Relation[];
  docs?: string;
};

export type PatternFill = { $fill: string };

export type PatternNode = {
  component: string;
  props?: Record<string, string | number | boolean | PatternFill>;
  spread?: string;
  children?: readonly (PatternNode | PatternFill)[];
};

export type PatternMeta = {
  id: string;
  name: string;
  description: string;
  whenToUse: readonly string[];
  whenNotToUse: readonly string[];
  intents: readonly Intent[];
  uses: readonly string[];
  hooks?: readonly { id: string; as: string }[];
  tree: readonly PatternNode[];
  fills: readonly { name: string; description: string }[];
  docs?: string;
};

export type Catalog = {
  version: 1;
  package: '@tounsoo/todae';
  intents: readonly Intent[];
  components: readonly ComponentMeta[];
  patterns: readonly PatternMeta[];
};

export type CatalogEntry = ComponentMeta | PatternMeta;

/** @deprecated Projection of name/description/props only. Prefer Catalog. */
export type ComponentsDocument = {
  version: 1;
  components: Array<Pick<ComponentMeta, 'name' | 'description' | 'props'>>;
};
