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
  Pagination,
  Stack,
  ToggleGroup,
  type Glyphs,
} from '@omsoo/todae';
import { useState, type ReactNode } from 'react';
import { ICON_LIBRARIES, type IconLibrary } from '../iconLibraries';

const NO_GLYPHS: Glyphs = {};

/** Picks Todae's own glyphs or one of the three libraries. */
export function LibraryPicker({
  value,
  onChange,
  label,
}: {
  value: string;
  onChange: (id: string) => void;
  label: string;
}) {
  return (
    <ToggleGroup.Root aria-label={label} value={value} onValueChange={(next) => next && onChange(next)}>
      <ToggleGroup.Item value="todae">Todae</ToggleGroup.Item>
      {ICON_LIBRARIES.map((library) => (
        <ToggleGroup.Item key={library.id} value={library.id}>
          {library.name}
        </ToggleGroup.Item>
      ))}
    </ToggleGroup.Root>
  );
}

export function libraryById(id: string): IconLibrary | undefined {
  return ICON_LIBRARIES.find((library) => library.id === id);
}

/** Every part that draws a glyph, under the glyphs the picker chose. */
export function GlyphsLibraries() {
  const [id, setId] = useState('lucide');
  const library = libraryById(id);
  return (
    <Stack.Root>
      <LibraryPicker label="Icon library" value={id} onChange={setId} />
      <GlyphsProvider glyphs={library?.glyphs ?? NO_GLYPHS}>
        <GlyphParts icon={library?.icons.info} />
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
          <a href="#glyphs">Projects</a>
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
