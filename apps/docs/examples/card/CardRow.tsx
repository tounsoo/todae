'use client';

import { Button, Card, Grid, Stack, Text } from '@tounsoo/todae';

const plans = [
  { name: 'Starter', features: ['Three projects.'] },
  { name: 'Pro', features: ['Unlimited projects.', 'Priority support.', 'An audit log for every change.'] },
];

export default function CardRow() {
  return (
    <Grid.Root minItemSize="14rem" style={{ maxInlineSize: '36rem' }}>
      {plans.map((plan) => (
        <Card.Root key={plan.name}>
          <Card.Header>
            <Text.Root as="h3">{plan.name}</Text.Root>
          </Card.Header>
          <Card.Body>
            <Stack.Root as="ul" gap="condensed">
              {plan.features.map((feature) => (
                <li key={feature}>{feature}</li>
              ))}
            </Stack.Root>
          </Card.Body>
          <Card.Footer>
            <Button.Root>Choose {plan.name}</Button.Root>
          </Card.Footer>
        </Card.Root>
      ))}
    </Grid.Root>
  );
}
