import type { CatalogEntry, ComponentMeta, PropMeta, SlotMeta } from '../types';

export type PropTypeSchema =
  | { type: 'boolean' | 'string' | 'number' }
  | { enum: string[] }
  | { 'x-todae-type': string };

export type PropSchema = Record<string, PropTypeSchema>;

export type SlotSchema = {
  accepts: readonly string[];
  required: boolean;
  description?: string;
};

export type RenderComponent = {
  description: string;
  props: PropSchema;
  slots?: Record<string, SlotSchema>;
};

export type RenderCatalog = {
  components: Record<string, RenderComponent>;
};

const STRING_LITERAL = /^(?:"([^"]*)"|'([^']*)')$/;

function parsePropType(type: string): PropTypeSchema {
  if (type === 'boolean') return { type: 'boolean' };
  if (type === 'string') return { type: 'string' };
  if (type === 'number') return { type: 'number' };
  const parts = type.split('|').map((part) => part.trim());
  if (parts.length > 0 && parts.every((part) => STRING_LITERAL.test(part))) {
    return { enum: parts.map((part) => part.slice(1, -1)) };
  }
  return { 'x-todae-type': type };
}

function toProps(props: readonly PropMeta[]): PropSchema {
  const schema: PropSchema = {};
  for (const prop of props) {
    schema[prop.name] = parsePropType(prop.type);
  }
  return schema;
}

function toSlots(slots: readonly SlotMeta[]): Record<string, SlotSchema> {
  const schema: Record<string, SlotSchema> = {};
  for (const slot of slots) {
    const mapped: SlotSchema = { accepts: slot.accepts, required: slot.required };
    if (slot.description) mapped.description = slot.description;
    schema[slot.name] = mapped;
  }
  return schema;
}

function isComponent(entry: CatalogEntry): entry is ComponentMeta {
  return !('tree' in entry);
}

export function toRenderCatalog(entries: readonly CatalogEntry[]): RenderCatalog {
  const components: Record<string, RenderComponent> = {};
  for (const entry of entries) {
    if (!isComponent(entry)) continue;
    const mapped: RenderComponent = {
      description: entry.description,
      props: toProps(entry.props),
    };
    if (entry.slots) mapped.slots = toSlots(entry.slots);
    components[entry.name] = mapped;
  }
  return { components };
}
