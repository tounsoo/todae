export type PropMeta = {
  name: string;
  type: string;
  required: boolean;
  default?: string;
  description: string;
};

export type ComponentMeta = {
  name: string;
  description: string;
  props: readonly PropMeta[];
};

export type ComponentsDocument = {
  version: 1;
  components: ComponentMeta[];
};
