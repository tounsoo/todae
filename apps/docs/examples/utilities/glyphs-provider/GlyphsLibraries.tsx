'use client';

import {
  Alert,
  Breadcrumbs,
  Button,
  Checkbox,
  Chip,
  Disclosure,
  Field,
  GlyphsProvider,
  Link,
  Pagination,
  Stack,
  ToggleGroup,
  type Glyphs,
} from '@tounsoo/todae';
import { Check as PhCheck, X as PhX, CaretDown, CaretRight, DotsThree, Info as PhInfo } from '@phosphor-icons/react';
import { IconCheck, IconChevronDown, IconChevronRight, IconDots, IconInfoCircle, IconX } from '@tabler/icons-react';
import { Check, ChevronDown, ChevronRight, Ellipsis, Info, X } from 'lucide-react';
import { useState, type ReactNode } from 'react';

/** The glyphs the parts below draw, and an icon for the alert, from each library. */
const LIBRARIES: { id: string; name: string; glyphs: Glyphs; info: ReactNode }[] = [
  {
    id: 'lucide',
    name: 'Lucide',
    glyphs: {
      close: <X />,
      check: <Check />,
      chevron: <ChevronDown />,
      separator: <ChevronRight />,
      ellipsis: <Ellipsis />,
    },
    info: <Info />,
  },
  {
    id: 'phosphor',
    name: 'Phosphor',
    glyphs: {
      close: <PhX />,
      check: <PhCheck weight="bold" />,
      chevron: <CaretDown />,
      separator: <CaretRight />,
      ellipsis: <DotsThree weight="bold" />,
    },
    info: <PhInfo />,
  },
  {
    id: 'tabler',
    name: 'Tabler',
    glyphs: {
      close: <IconX />,
      check: <IconCheck />,
      chevron: <IconChevronDown />,
      separator: <IconChevronRight />,
      ellipsis: <IconDots />,
    },
    info: <IconInfoCircle />,
  },
];

const NO_GLYPHS: Glyphs = {};

/** Every part that draws a glyph, under the glyphs the picker chose. */
export default function GlyphsLibraries() {
  const [id, setId] = useState('lucide');
  const library = LIBRARIES.find((each) => each.id === id);
  return (
    <Stack.Root>
      <ToggleGroup.Root aria-label="Icon library" value={id} onValueChange={(next) => next && setId(next)}>
        <ToggleGroup.Item value="todae">Todae</ToggleGroup.Item>
        {LIBRARIES.map((each) => (
          <ToggleGroup.Item key={each.id} value={each.id}>
            {each.name}
          </ToggleGroup.Item>
        ))}
      </ToggleGroup.Root>
      <GlyphsProvider glyphs={library?.glyphs ?? NO_GLYPHS}>
        <GlyphParts icon={library?.info} />
      </GlyphsProvider>
    </Stack.Root>
  );
}

function GlyphParts({ icon }: { icon?: ReactNode }) {
  const [plan, setPlan] = useState('pro');
  return (
    <>
      <Alert.Root tone="info" role="none">
        {icon ? <Alert.Icon>{icon}</Alert.Icon> : null}
        <Alert.Title>Invoice sent</Alert.Title>
        <Alert.Close />
      </Alert.Root>
      <Stack.Root direction="row">
        <Checkbox.Root defaultChecked>Email me a copy</Checkbox.Root>
        <Chip.Root onRemove={() => undefined}>design</Chip.Root>
      </Stack.Root>
      <Field.Root aria-label="Plan">
        <Field.Select value={plan} onValueChange={setPlan}>
          <option value="starter">Starter</option>
          <option value="pro">Pro</option>
        </Field.Select>
      </Field.Root>
      <Disclosure.Root>
        <Disclosure.Summary>Billing details</Disclosure.Summary>
        <p>Paid yearly by card.</p>
      </Disclosure.Root>
      <Breadcrumbs.Root>
        <Breadcrumbs.Item>
          <Link.Root href="#glyphs">Projects</Link.Root>
        </Breadcrumbs.Item>
        <Breadcrumbs.Item current>Todae</Breadcrumbs.Item>
      </Breadcrumbs.Root>
      <Pagination.Root>
        <Pagination.Item>
          <Button.Root variant="ghost">1</Button.Root>
        </Pagination.Item>
        <Pagination.Ellipsis />
        <Pagination.Item>
          <Button.Root variant="ghost">9</Button.Root>
        </Pagination.Item>
      </Pagination.Root>
    </>
  );
}
