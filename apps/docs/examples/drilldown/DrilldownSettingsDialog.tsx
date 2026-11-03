'use client';

import { Button, Dialog, Drilldown, Field, Label, Stack, Switch } from '@tounsoo/todae';
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

export default function DrilldownSettingsDialog() {
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
