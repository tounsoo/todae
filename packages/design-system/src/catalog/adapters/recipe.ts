import type { PatternMeta, PatternNode } from '../types';

export type CandidateRecipe = {
  id: string;
  description: string;
  hooks: readonly { id: string; as: string }[];
  tree: readonly PatternNode[];
  fills: readonly { name: string; description: string }[];
  constraints: readonly string[];
};

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

export function toCandidateRecipe(pattern: PatternMeta): CandidateRecipe {
  return {
    id: pattern.id,
    description: pattern.description,
    hooks: clone(pattern.hooks ?? []),
    tree: clone(pattern.tree),
    fills: clone(pattern.fills),
    constraints: clone(pattern.whenNotToUse),
  };
}
