'use client';

import { Alert, Button, Checkbox, ErrorMessage, Field, Fieldset, Form, Label, RadioGroup, Stack, type FormErrors } from '@tounsoo/todae';
import { useId, useState } from 'react';

export default function FormSignUp() {
  const nameId = useId();
  const emailId = useId();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [plan, setPlan] = useState<string | null>(null);
  const [errors, setErrors] = useState<FormErrors>({});
  const [created, setCreated] = useState(false);
  return (
    <Form.Root
      errors={errors}
      onSubmit={(event) => {
        event.preventDefault();
        // A stand-in for a server that knows this address.
        const taken = email.trim().toLowerCase() === 'ben@example.com';
        setErrors(taken ? { email: 'That address is taken.' } : {});
        setCreated(!taken);
      }}
      onReset={() => {
        setName('');
        setEmail('');
        setPlan(null);
        setErrors({});
        setCreated(false);
      }}
    >
      <Stack.Root>
        <Form.Summary />
        <Field.Group>
          <Label.Root htmlFor={nameId}>Name</Label.Root>
          <Field.Root id={nameId} name="name">
            <Field.TextInput required minLength={2} value={name} onValueChange={setName} />
          </Field.Root>
          <ErrorMessage.Root />
        </Field.Group>
        <Field.Group>
          <Label.Root htmlFor={emailId}>Work email</Label.Root>
          <Field.Root id={emailId} name="email">
            <Field.TextInput type="email" required value={email} onValueChange={setEmail} />
          </Field.Root>
          <ErrorMessage.Root />
        </Field.Group>
        <Fieldset.Root>
          <Fieldset.Legend>Plan</Fieldset.Legend>
          <RadioGroup.Root aria-label="Plan" name="plan" value={plan} onValueChange={setPlan}>
            <RadioGroup.Item value="team" required>
              Team
            </RadioGroup.Item>
            <RadioGroup.Item value="pro">Pro</RadioGroup.Item>
          </RadioGroup.Root>
          <ErrorMessage.Root />
        </Fieldset.Root>
        <Field.Group>
          <Checkbox.Root name="terms" required>
            I accept the terms
          </Checkbox.Root>
          <ErrorMessage.Root />
        </Field.Group>
        <Stack.Root direction="row">
          <Button.Root type="submit">Create account</Button.Root>
          <Button.Root type="reset" variant="ghost">
            Reset
          </Button.Root>
        </Stack.Root>
        {created ? <Alert.Root tone="success">Account created.</Alert.Root> : null}
      </Stack.Root>
    </Form.Root>
  );
}
