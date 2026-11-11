'use client';

import { Card } from '@tounsoo/todae/card';
import { Grid } from '@tounsoo/todae/grid';

const PLANS = ['Free', 'Team', 'Business', 'Enterprise'];

export default function GridColumns() {
  return (
    <Grid.Root columns={2} role="list" aria-label="Plans">
      {PLANS.map((plan) => (
        <Card.Root key={plan} role="listitem">
          {plan}
        </Card.Root>
      ))}
    </Grid.Root>
  );
}
