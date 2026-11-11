import { useId, useState } from 'react';
import {
  Alert,
  Badge,
  Button,
  Card,
  Field,
  Grid,
  Label,
  Stack,
  Switch,
  Tabs,
  Text,
  ThemeProvider,
  useAppearance,
} from '@tounsoo/todae';
import { THEME_OVERRIDE_TYPES } from './theme/todae-theme.types';

const CABINS = [
  { name: 'Alder Hollow', region: 'Coast', price: 140, sleeps: 2, tag: 'New' },
  { name: 'Birch Ridge', region: 'Mountains', price: 185, sleeps: 4, tag: 'Popular' },
  { name: 'Cedar Fork', region: 'Lakes', price: 120, sleeps: 3, tag: null },
] as const;

type Appearance = 'light' | 'dark';

export function App() {
  const [appearance, setAppearance] = useState<Appearance>('light');
  const [region, setRegion] = useState('all');
  const [guests, setGuests] = useState<number | null>(2);
  const regionId = useId();
  const guestsId = useId();
  const cabins = CABINS.filter((cabin) => region === 'all' || cabin.region === region);

  return (
    <ThemeProvider appearance={appearance} className="page">
      <div className="shell">
        <Stack.Root gap="spacious">
          <Stack.Root direction="row" justify="between" align="center" as="header">
            <Text.Root as="span" className="wordmark" weight="bold" tone="accent">
              Fernway
            </Text.Root>
            <Switch.Root
              checked={appearance === 'dark'}
              onCheckedChange={(checked) => setAppearance(checked ? 'dark' : 'light')}
            >
              Dark
            </Switch.Root>
          </Stack.Root>

          <section className="hero">
            <Stack.Root>
              <hgroup>
                <Text.Root variant="label">Cabins for the weekend</Text.Root>
                <Text.Root as="h1" weight="bold">
                  A quiet cabin, a short drive away
                </Text.Root>
              </hgroup>
              <Text.Root>Book a night in the woods, with the kettle already on.</Text.Root>
              <Stack.Root direction="row" wrap>
                <Button.Root>Find a cabin</Button.Root>
                <Button.Root variant="soft">Gift a stay</Button.Root>
              </Stack.Root>
            </Stack.Root>
          </section>

          <Stack.Root direction="row" wrap align="end">
            <Field.Group>
              <Label.Root htmlFor={regionId}>Region</Label.Root>
              <Field.Root id={regionId}>
                <Field.Select value={region} onValueChange={setRegion}>
                  <option value="all">Anywhere</option>
                  <option value="Coast">Coast</option>
                  <option value="Mountains">Mountains</option>
                  <option value="Lakes">Lakes</option>
                </Field.Select>
              </Field.Root>
            </Field.Group>
            <Field.Group>
              <Label.Root htmlFor={guestsId}>Guests</Label.Root>
              <Field.Root id={guestsId}>
                <Field.Decrement />
                <Field.NumberInput value={guests} onValueChange={setGuests} min={1} max={12} />
                <Field.Increment />
              </Field.Root>
            </Field.Group>
          </Stack.Root>

          <Tabs.Root defaultValue="cabins">
            <Tabs.List aria-label="Browse">
              <Tabs.Tab value="cabins">Cabins</Tabs.Tab>
              <Tabs.Tab value="partner">Partner stays</Tabs.Tab>
              <Tabs.Tab value="business">For business</Tabs.Tab>
            </Tabs.List>
            <Tabs.Panel value="cabins">
              <Grid.Root minItemSize="16rem">
                {cabins.map((cabin) => (
                  <Card.Root key={cabin.name}>
                    <Card.Header>
                      <Stack.Root direction="row" justify="between" align="center">
                        <Text.Root as="h2" className="cabin-name" weight="bold">
                          {cabin.name}
                        </Text.Root>
                        {cabin.tag ? <Badge.Root tone="category-4">{cabin.tag}</Badge.Root> : null}
                      </Stack.Root>
                    </Card.Header>
                    <Card.Body>
                      <Text.Root tone="muted">
                        {cabin.region} · sleeps {cabin.sleeps}
                      </Text.Root>
                    </Card.Body>
                    <Card.Footer>
                      <Stack.Root direction="row" justify="between" align="center">
                        <Text.Root weight="medium">${cabin.price} a night</Text.Root>
                        <Button.Root variant="secondary">Details</Button.Root>
                      </Stack.Root>
                    </Card.Footer>
                  </Card.Root>
                ))}
              </Grid.Root>
            </Tabs.Panel>
            <Tabs.Panel value="partner">
              <PartnerStays />
            </Tabs.Panel>
            <Tabs.Panel value="business">
              <BusinessStays />
            </Tabs.Panel>
          </Tabs.Root>

          <Alert.Root tone="info">
            <Alert.Title>Winter hours</Alert.Title>
            <Alert.Description>Check-in closes at 6 pm from November to March.</Alert.Description>
          </Alert.Root>
        </Stack.Root>
      </div>
    </ThemeProvider>
  );
}

// A partner lodge brings its own colors at runtime, so they go through
// ThemeProvider overrides instead of the token build. An override holds in
// every appearance, so pick the value for the current one.
const PARTNER_COLORS = {
  light: { bg: [0.93, 0.04, 60], fg: [0.32, 0.08, 50] },
  dark: { bg: [0.28, 0.04, 50], fg: [0.92, 0.05, 60] },
} as const;

function PartnerStays() {
  const colors = PARTNER_COLORS[useAppearance()];
  return (
    <ThemeProvider
      overrideTypes={THEME_OVERRIDE_TYPES}
      overrides={{
        'fernway.hero.bg': { colorSpace: 'oklch', components: colors.bg },
        'fernway.hero.fg': { colorSpace: 'oklch', components: colors.fg },
      }}
    >
      <section className="hero">
        <Stack.Root>
          <Text.Root as="h2" weight="bold">
            Lakeview Lodge, a Fernway partner
          </Text.Root>
          <Text.Root>Partner pages keep Fernway's layout and take the partner's colors.</Text.Root>
        </Stack.Root>
      </section>
    </ThemeProvider>
  );
}

// Fernway for business is a second token build of Fernway's tokens with its
// own accent, scoped to .business, so it can sit inside the Fernway page and
// follow its light or dark appearance.
function BusinessStays() {
  return (
    <section className="business hero">
      <Stack.Root>
        <Text.Root as="h2" weight="bold">
          Fernway for business
        </Text.Root>
        <Text.Root>Team offsites in cabins near you, billed to one account.</Text.Root>
        <Stack.Root direction="row" wrap>
          <Button.Root>Plan an offsite</Button.Root>
          <Button.Root variant="soft">Talk to sales</Button.Root>
        </Stack.Root>
      </Stack.Root>
    </section>
  );
}
