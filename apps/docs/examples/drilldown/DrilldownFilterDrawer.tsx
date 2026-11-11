'use client';

import { Button, Checkbox, Drawer, Drilldown, Stack, Text } from '@tounsoo/todae';
import { ChevronRight } from 'lucide-react';
import { useState, type ReactNode } from 'react';

const row = { justifyContent: 'space-between', inlineSize: '100%' } as const;

function Row({ value, children }: { value: string; children: ReactNode }) {
  return (
    <Drilldown.Trigger value={value} variant="ghost" style={row}>
      {children}
      <Button.Icon>
        <ChevronRight />
      </Button.Icon>
    </Drilldown.Trigger>
  );
}

const BRANDS = ['Arden', 'Birch & Co', 'Cobalt', 'Driftwood', 'Ember', 'Fernway'];

export default function DrilldownFilterDrawer() {
  const [open, setOpen] = useState(false);
  const [brands, setBrands] = useState<readonly string[]>([]);
  const toggle = (brand: string, checked: boolean) =>
    setBrands((current) => (checked ? [...current, brand] : current.filter((b) => b !== brand)));
  return (
    <>
      <Button.Root variant="secondary" onClick={() => setOpen(true)}>
        Open filters
      </Button.Root>
      <Drawer.Root open={open} onOpenChange={setOpen}>
        <Drilldown.Root defaultValue={['filters']}>
          <Drawer.Header>
            <Drilldown.Back />
            <Drawer.Title>
              <Drilldown.Label />
            </Drawer.Title>
            <Drawer.Close />
          </Drawer.Header>
          <Drawer.Body>
            <Drilldown.Viewport>
              <Drilldown.View value="filters" label="Filters">
                <Stack.Root gap="condensed">
                  <Row value="brand">Brand{brands.length > 0 ? ` (${brands.length})` : ''}</Row>
                  <Row value="price">Price</Row>
                </Stack.Root>
              </Drilldown.View>
              <Drilldown.View value="brand" label="Brand">
                <Stack.Root gap="condensed">
                  {BRANDS.map((brand) => (
                    <Checkbox.Root
                      key={brand}
                      checked={brands.includes(brand)}
                      onCheckedChange={(checked) => toggle(brand, checked)}
                    >
                      {brand}
                    </Checkbox.Root>
                  ))}
                </Stack.Root>
              </Drilldown.View>
              <Drilldown.View value="price" label="Price">
                <Text.Root>Under $50, $50 to $100, over $100.</Text.Root>
              </Drilldown.View>
            </Drilldown.Viewport>
          </Drawer.Body>
          <Drawer.Footer>
            <Button.Root variant="secondary" onClick={() => setBrands([])}>
              Reset
            </Button.Root>
            <Button.Root onClick={() => setOpen(false)}>Apply</Button.Root>
          </Drawer.Footer>
        </Drilldown.Root>
      </Drawer.Root>
    </>
  );
}
