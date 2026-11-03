'use client';

import { Alert, Button, Stack } from '@tounsoo/todae';
import { CircleCheck, CircleX, Info, TriangleAlert } from 'lucide-react';

// Todae ships no icons. These come from Lucide; any icon library works.

export default function AlertTones() {
  return (
    <Stack.Root>
      <Alert.Root tone="info" role="none">
        <Alert.Icon>
          <Info />
        </Alert.Icon>
        <Alert.Title>Scheduled maintenance</Alert.Title>
        <Alert.Description>Sign-in pauses for ten minutes on Sunday at 02:00 UTC.</Alert.Description>
      </Alert.Root>
      <Alert.Root tone="success" role="none">
        <Alert.Icon>
          <CircleCheck />
        </Alert.Icon>
        <Alert.Title>Invoice paid</Alert.Title>
      </Alert.Root>
      <Alert.Root tone="warning" role="none">
        <Alert.Icon>
          <TriangleAlert />
        </Alert.Icon>
        <Alert.Title>Storage almost full</Alert.Title>
        <Alert.Description>You have used 92% of your plan.</Alert.Description>
      </Alert.Root>
      <Alert.Root tone="critical" role="none">
        <Alert.Icon>
          <CircleX />
        </Alert.Icon>
        <Alert.Title>Payment failed</Alert.Title>
        <Alert.Description>Update your card to keep your plan.</Alert.Description>
        <Alert.Actions>
          <Button.Root variant="secondary">Update card</Button.Root>
        </Alert.Actions>
      </Alert.Root>
    </Stack.Root>
  );
}
