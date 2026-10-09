'use client';

import { Button, Card, Text } from '@omsoo/todae';

export function CardPlan() {
  return (
    <Card.Root style={{ maxInlineSize: '24rem' }}>
      <Card.Header>
        <Text as="h3">Pro plan</Text>
      </Card.Header>
      <Card.Body>
        <Text>Billed yearly. Renews on 2027-01-04.</Text>
      </Card.Body>
      <Card.Footer>
        <Button.Root variant="secondary">Cancel plan</Button.Root>
        <Button.Root>Change plan</Button.Root>
      </Card.Footer>
    </Card.Root>
  );
}
