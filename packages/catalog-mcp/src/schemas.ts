import { INTENTS } from '@tounsoo/todae/catalog';
import { z, type ZodTypeAny } from 'zod/v3';

export function read<S extends ZodTypeAny>(schema: S, args: unknown): z.infer<S> {
  return schema.parse(args);
}

export const intent = z.enum(INTENTS);
export const kind = z.enum(['component', 'part', 'hook', 'provider']);

export const listComponents = z.object({
  kind: kind.optional(),
  intent: intent.optional(),
});

export const getComponent = z.object({ id: z.string() });

export const listPatterns = z.object({
  intent: intent.optional(),
});

export const getPattern = z.object({ id: z.string() });

export const listForIntent = z.object({
  intent,
  kinds: z.array(kind).optional(),
  includePatterns: z.boolean().optional(),
});

export const search = z.object({
  query: z.string(),
  limit: z.number().int().positive().optional(),
  kinds: z.array(kind).optional(),
  includePatterns: z.boolean().optional(),
  intents: z.array(intent).optional(),
});

export const listIntents = z.object({});

export const toRenderCatalog = z.object({
  names: z.array(z.string()).optional(),
});

export const toCandidateRecipe = z.object({ id: z.string() });

export const toCriteria = z.object({ id: z.string() });
