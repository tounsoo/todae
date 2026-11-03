'use client';

import { Card } from '@tounsoo/todae/card';
import { Grid } from '@tounsoo/todae/grid';

const PLANS = ['Free', 'Team', 'Business', 'Enterprise'];

export default function GridFill() {
  return (
    <Grid.Root minItemSize="10rem" role="list" aria-label="Plans">
      {PLANS.map((plan) => (
        <Card.Root key={plan} role="listitem">
          {plan}
        </Card.Root>
      ))}
    </Grid.Root>
  );
}
