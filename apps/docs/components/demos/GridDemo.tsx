import { Card } from '@omsoo.design/todae/card';
import { Grid } from '@omsoo.design/todae/grid';

const PLANS = ['Free', 'Team', 'Business', 'Enterprise'];

export function GridColumns() {
  return (
    <Grid.Root columns={2}>
      {PLANS.map((plan) => (
        <Card.Root key={plan}>{plan}</Card.Root>
      ))}
    </Grid.Root>
  );
}

export function GridFill() {
  return (
    <Grid.Root minItemSize="10rem">
      {PLANS.map((plan) => (
        <Card.Root key={plan}>{plan}</Card.Root>
      ))}
    </Grid.Root>
  );
}
