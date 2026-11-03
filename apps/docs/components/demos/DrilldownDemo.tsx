'use client';

import { BottomSheet, Button, Drilldown, Stack, Text } from '@tounsoo/todae';
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
