'use client';

import {
  Alert,
  Avatar,
  Badge,
  Button,
  Card,
  categoryTone,
  Checkbox,
  Chip,
  Field,
  Label,
  Progress,
  RadioGroup,
  Switch,
  Tabs,
  Text,
  ToggleGroup,
} from '@omsoo/todae';
import { useId, useState } from 'react';

/** A product-like screen built from Todae parts. The playground's theme paints it. Copy is English, like every demo. */
export function Preview() {
  const emailId = useId();
  const planId = useId();
  const billingId = useId();
  const [email, setEmail] = useState('ada@example.com');
  const [range, setRange] = useState<string | null>('week');
  const [plan, setPlan] = useState('pro');
  return (
    <div className="preview" lang="en">
      <div className="preview-head">
        <div className="preview-user">
          <Avatar.Root label="Ada Lovelace" tone={categoryTone('ada')}>
            <Avatar.Fallback>AL</Avatar.Fallback>
          </Avatar.Root>
          <div>
            <Text as="h2" size="l">
              Good morning, Ada
            </Text>
            <Text tone="muted" size="s">
              3 reviews wait on you today.
            </Text>
          </div>
        </div>
        <div className="preview-actions">
          <Button.Root variant="secondary">Invite</Button.Root>
          <Button.Root>New project</Button.Root>
        </div>
      </div>

      <div className="preview-grid">
        <Card.Root className="preview-span-2">
          <Card.Header>
            <div className="preview-card-title">
              <Text as="h3">Revenue</Text>
              <ToggleGroup.Root aria-label="Range" value={range} onValueChange={setRange}>
                <ToggleGroup.Item value="day">Day</ToggleGroup.Item>
                <ToggleGroup.Item value="week">Week</ToggleGroup.Item>
                <ToggleGroup.Item value="month">Month</ToggleGroup.Item>
              </ToggleGroup.Root>
            </div>
          </Card.Header>
          <Card.Body>
            <div className="preview-stats">
              <div>
                <Text tone="muted" size="s">
                  Booked
                </Text>
                <Text size="2xl" weight="bold">
                  $48,210
                </Text>
                <Badge.Root tone="success">+12.4%</Badge.Root>
              </div>
              <div>
                <Text tone="muted" size="s">
                  Churned
                </Text>
                <Text size="2xl" weight="bold">
                  $2,380
                </Text>
                <Badge.Root tone="critical">+3.1%</Badge.Root>
              </div>
              <div>
                <Text tone="muted" size="s">
                  Quota
                </Text>
                <Text size="2xl" weight="bold">
                  72%
                </Text>
                <Progress.Root value={72} max={100} aria-label="Quota used" />
              </div>
            </div>
          </Card.Body>
        </Card.Root>

        <Card.Root className="preview-tall">
          <Card.Header>
            <Text as="h3">Upgrade</Text>
          </Card.Header>
          <Card.Body>
            <form className="preview-form" onSubmit={(event) => event.preventDefault()}>
              <div className="labelled-field">
                <Label htmlFor={emailId}>Work email</Label>
                <Field.Root id={emailId}>
                  <Field.TextInput type="email" value={email} onChange={(event) => setEmail(event.target.value)} />
                </Field.Root>
              </div>
              <div className="labelled-field">
                <Label htmlFor={planId}>Plan</Label>
                <Field.Root id={planId}>
                  <Field.Select value={plan} onValueChange={setPlan}>
                    <option value="starter">Starter</option>
                    <option value="pro">Pro</option>
                    <option value="scale">Scale</option>
                  </Field.Select>
                </Field.Root>
              </div>
              <div className="labelled-field">
                <Text as="span" id={billingId} size="s" weight="medium">
                  Billing
                </Text>
                <RadioGroup.Root aria-labelledby={billingId} defaultValue="yearly">
                  <RadioGroup.Item value="monthly">Monthly</RadioGroup.Item>
                  <RadioGroup.Item value="yearly">Yearly, save 20%</RadioGroup.Item>
                </RadioGroup.Root>
              </div>
              <Checkbox defaultChecked>Email me the invoice</Checkbox>
              <Button.Root type="submit">Upgrade to Pro</Button.Root>
            </form>
          </Card.Body>
        </Card.Root>

        <Card.Root>
          <Card.Header>
            <Text as="h3">Notifications</Text>
          </Card.Header>
          <Card.Body>
            <div className="preview-stack">
              <Switch defaultChecked>Mentions</Switch>
              <Switch defaultChecked>Weekly digest</Switch>
              <Switch>Product news</Switch>
              <div className="preview-chips">
                <Chip.Root tone={categoryTone('design')}>design</Chip.Root>
                <Chip.Root tone={categoryTone('billing')}>billing</Chip.Root>
                <Chip.Root tone="critical">urgent</Chip.Root>
              </div>
            </div>
          </Card.Body>
        </Card.Root>

        <Card.Root>
          <Card.Header>
            <Text as="h3">Activity</Text>
          </Card.Header>
          <Card.Body>
            <Tabs.Root defaultValue="all">
              <Tabs.List aria-label="Activity">
                <Tabs.Tab value="all">All</Tabs.Tab>
                <Tabs.Tab value="mine">Mine</Tabs.Tab>
              </Tabs.List>
              <Tabs.Panel value="all">
                <ul className="preview-list">
                  <li>
                    <span>Invoice #1042</span>
                    <Badge.Root tone="success">Paid</Badge.Root>
                  </li>
                  <li>
                    <span>Invoice #1043</span>
                    <Badge.Root tone="warning">Due soon</Badge.Root>
                  </li>
                  <li>
                    <span>Invoice #1039</span>
                    <Badge.Root tone="critical">Overdue</Badge.Root>
                  </li>
                </ul>
              </Tabs.Panel>
              <Tabs.Panel value="mine">
                <Text tone="muted">Nothing assigned to you.</Text>
              </Tabs.Panel>
            </Tabs.Root>
          </Card.Body>
        </Card.Root>

        <div className="preview-span-3 preview-alerts">
          <Alert.Root tone="info" role="none">
            <Alert.Title>Scheduled maintenance</Alert.Title>
            <Alert.Description>Billing is read-only on Sunday from 02:00 to 03:00 UTC.</Alert.Description>
          </Alert.Root>
          <Alert.Root tone="warning" role="none">
            <Alert.Title>Card expires soon</Alert.Title>
            <Alert.Description>Update it before 2026-11-01 to keep your plan.</Alert.Description>
          </Alert.Root>
        </div>
      </div>
    </div>
  );
}
