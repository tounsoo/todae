import { Card } from '@omsoo/todae/card';
import { Grid } from '@omsoo/todae/grid';

const PLANS = ['Free', 'Team', 'Business', 'Enterprise'];

export function GridColumns() {
  return (
    <Grid columns={2}>
      {PLANS.map((plan) => (
        <Card.Root key={plan}>{plan}</Card.Root>
      ))}
    </Grid>
  );
}

export function GridFill() {
  return (
    <Grid minItemSize="10rem">
      {PLANS.map((plan) => (
        <Card.Root key={plan}>{plan}</Card.Root>
      ))}
    </Grid>
  );
}
