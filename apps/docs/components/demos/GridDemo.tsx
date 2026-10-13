import { Card } from '@omsoo.design/todae/card';
import { Grid } from '@omsoo.design/todae/grid';

const PLANS = ['Free', 'Team', 'Business', 'Enterprise'];

export function GridColumns() {
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

export function GridFill() {
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
