'use client';

import { BottomSheet, Button, Checkbox, Dialog, Drawer, Drilldown, Field, Label, Stack, Switch, Text } from '@tounsoo/todae';
import { ChevronRight } from 'lucide-react';
import { useId, useState, type ReactNode } from 'react';

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

export function DrilldownSettingsDialog() {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('Ada Lovelace');
  const [email, setEmail] = useState('ada@example.com');
  const nameId = useId();
  const emailId = useId();
  return (
    <>
      <Button.Root variant="secondary" onClick={() => setOpen(true)}>
        Open settings
      </Button.Root>
      <Dialog.Root open={open} onOpenChange={setOpen}>
        <Drilldown.Root defaultValue={['settings']}>
          <Dialog.Header>
            <Drilldown.Back />
            <Dialog.Title>
              <Drilldown.Label />
            </Dialog.Title>
            <Dialog.Close />
          </Dialog.Header>
          <Dialog.Body>
            <Drilldown.Viewport>
              <Drilldown.View value="settings" label="Settings">
                <Stack.Root gap="condensed">
                  <Row value="account">Account</Row>
                  <Row value="notifications">Notifications</Row>
                </Stack.Root>
              </Drilldown.View>
              <Drilldown.View value="account" label="Account">
                <Stack.Root>
                  <Field.Group>
                    <Label.Root htmlFor={nameId}>Display name</Label.Root>
                    <Field.Root id={nameId}>
                      <Field.TextInput value={name} onValueChange={setName} />
                    </Field.Root>
                  </Field.Group>
                  <Row value="email">Email</Row>
                </Stack.Root>
              </Drilldown.View>
              <Drilldown.View value="email" label="Email">
                <Field.Group>
                  <Label.Root htmlFor={emailId}>Email address</Label.Root>
                  <Field.Root id={emailId}>
                    <Field.TextInput type="email" value={email} onValueChange={setEmail} />
                  </Field.Root>
                </Field.Group>
              </Drilldown.View>
              <Drilldown.View value="notifications" label="Notifications">
                <Stack.Root gap="condensed">
                  <Switch.Root defaultChecked>Mentions</Switch.Root>
                  <Switch.Root>Weekly digest</Switch.Root>
                </Stack.Root>
              </Drilldown.View>
            </Drilldown.Viewport>
          </Dialog.Body>
        </Drilldown.Root>
      </Dialog.Root>
    </>
  );
}

const BRANDS = ['Arden', 'Birch & Co', 'Cobalt', 'Driftwood', 'Ember', 'Fernway'];

export function DrilldownFilterDrawer() {
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

const ORDER = [
  { id: 'lamp', name: 'Desk lamp', detail: 'Brass, warm white bulb. Ships in 2 days.' },
  { id: 'chair', name: 'Oak chair', detail: 'Solid oak, oiled finish. Ships in 5 days.' },
  { id: 'rug', name: 'Wool rug', detail: '160 × 230 cm, undyed wool. Ships in 1 week.' },
];

export function DrilldownOrderSheet() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button.Root variant="secondary" onClick={() => setOpen(true)}>
        Open order
      </Button.Root>
      <BottomSheet.Root open={open} onOpenChange={setOpen}>
        <Drilldown.Root defaultValue={['order']}>
          <BottomSheet.Header>
            <Drilldown.Back />
            <BottomSheet.Title>
              <Drilldown.Label />
            </BottomSheet.Title>
            <BottomSheet.Close />
          </BottomSheet.Header>
          <BottomSheet.Body>
            <Drilldown.Viewport>
              <Drilldown.View value="order" label="Your order">
                <Stack.Root gap="condensed">
                  {ORDER.map((item) => (
                    <Row key={item.id} value={item.id}>
                      {item.name}
                    </Row>
                  ))}
                </Stack.Root>
              </Drilldown.View>
              {ORDER.map((item) => (
                <Drilldown.View key={item.id} value={item.id} label={item.name}>
                  <Text.Root>{item.detail}</Text.Root>
                </Drilldown.View>
              ))}
            </Drilldown.Viewport>
          </BottomSheet.Body>
        </Drilldown.Root>
      </BottomSheet.Root>
    </>
  );
}
