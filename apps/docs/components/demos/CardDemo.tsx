'use client';

import { Button, Card, Text } from '@omsoo.design/todae';

export function CardPlan() {
  return (
    <Card.Root style={{ maxInlineSize: '24rem' }}>
      <Card.Header>
        <Text.Root as="h3">Pro plan</Text.Root>
      </Card.Header>
      <Card.Body>
        <Text.Root>Billed yearly. Renews on 2027-01-04.</Text.Root>
      </Card.Body>
      <Card.Footer>
        <Button.Root variant="secondary">Cancel plan</Button.Root>
        <Button.Root>Change plan</Button.Root>
      </Card.Footer>
    </Card.Root>
  );
}
