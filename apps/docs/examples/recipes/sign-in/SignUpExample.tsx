'use client';

import {
  Alert,
  Button,
  Description,
  ErrorMessage,
  Field,
  Form,
  Label,
  Stack,
  Text,
  type FormErrors,
} from '@tounsoo/todae';
import { Eye, EyeOff } from 'lucide-react';
import { useId, useLayoutEffect, useRef, useState, type SubmitEvent } from 'react';

const WIDTH = { inlineSize: '100%', maxInlineSize: '22rem' };

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// A stand-in for the server. It knows one account, ben@example.com.
async function createAccount(email: string): Promise<FormErrors> {
  await wait(600);
  return email.trim().toLowerCase() === 'ben@example.com' ? { email: 'An account with this email already exists.' } : {};
}

// Errors the person can fix, or none: the request is done.
function hasErrors(reply: FormErrors): boolean {
  return Object.values(reply).some(Boolean);
}

type PasswordFieldProps = {
  id: string;
  name: string;
  autoComplete: 'current-password' | 'new-password';
  value: string;
  onValueChange: (value: string) => void;
  shown: boolean;
  onShownChange: (shown: boolean) => void;
  minLength?: number;
  disabled?: boolean;
  'aria-describedby'?: string;
};

function PasswordField({ id, name, shown, onShownChange, disabled, 'aria-describedby': describedBy, ...input }: PasswordFieldProps) {
  return (
    <Field.Root id={id} name={name} disabled={disabled} aria-describedby={describedBy}>
      <Field.TextInput
        {...input}
        type={shown ? 'text' : 'password'}
        required
        // Off, so a shown password isn't sent to a spell checker or changed by autocorrect.
        spellCheck={false}
        autoCapitalize="none"
        autoCorrect="off"
      />
      {/* One label in both states: aria-pressed says whether the password shows. Field.Root's
          disabled doesn't reach a button, so it gets its own. */}
      <Button.Root variant="ghost" aria-label="Show password" pressed={shown} onPressedChange={onShownChange} disabled={disabled}>
        <Button.Icon>{shown ? <EyeOff /> : <Eye />}</Button.Icon>
      </Button.Root>
    </Field.Root>
  );
}

// Focuses a heading that confirms the result once it shows, as the form that held focus is gone.
function useFocusOnShow<T extends HTMLElement>(shown: boolean) {
  const ref = useRef<T>(null);
  useLayoutEffect(() => {
    if (shown) ref.current?.focus();
  }, [shown]);
  return ref;
}

export default function SignUpExample() {
  const ids = { name: useId(), email: useId(), password: useId(), rules: useId() };
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [shown, setShown] = useState(false);
  const [errors, setErrors] = useState<FormErrors>({});
  const [sending, setSending] = useState(false);
  const [failed, setFailed] = useState<string | null>(null);
  const [created, setCreated] = useState(false);
  const createdHeading = useFocusOnShow<HTMLHeadingElement>(created);

  const submit = async (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (sending) return;
    setShown(false);
    setSending(true);
    setFailed(null);
    setErrors({});
    let reply: FormErrors;
    try {
      reply = await createAccount(email);
    } catch {
      setFailed("The account wasn't created. Try again.");
      return;
    } finally {
      setSending(false);
    }
    if (hasErrors(reply)) setErrors(reply);
    else setCreated(true);
  };

  if (created) {
    return (
      <Stack.Root gap="normal" style={WIDTH}>
        <Text.Root as="h3" ref={createdHeading} tabIndex={-1}>
          Account created
        </Text.Root>
        <div>
          <Button.Root
            variant="secondary"
            onClick={() => {
              setPassword('');
              setCreated(false);
            }}
          >
            Start again
          </Button.Root>
        </div>
      </Stack.Root>
    );
  }

  return (
    <Form.Root errors={errors} onSubmit={submit} aria-label="Create an account">
      <Stack.Root gap="normal" style={WIDTH}>
        <Field.Group>
          <Label.Root htmlFor={ids.name}>Name</Label.Root>
          <Field.Root id={ids.name} name="name">
            <Field.TextInput required autoComplete="name" value={name} onValueChange={setName} />
          </Field.Root>
          <ErrorMessage.Root />
        </Field.Group>
        <Field.Group>
          <Label.Root htmlFor={ids.email}>Email</Label.Root>
          <Field.Root id={ids.email} name="email">
            <Field.TextInput type="email" required autoComplete="username" value={email} onValueChange={setEmail} />
          </Field.Root>
          <ErrorMessage.Root />
        </Field.Group>
        <Field.Group>
          <Label.Root htmlFor={ids.password}>Password</Label.Root>
          <PasswordField
            id={ids.password}
            name="password"
            autoComplete="new-password"
            minLength={12}
            aria-describedby={ids.rules}
            value={password}
            onValueChange={setPassword}
            shown={shown}
            onShownChange={setShown}
          />
          <Description.Root id={ids.rules}>12 characters or more. A few words you'll remember work well.</Description.Root>
          <ErrorMessage.Root />
        </Field.Group>
        {failed ? <Alert.Root tone="critical">{failed}</Alert.Root> : null}
        <div>
          <Button.Root type="submit" aria-disabled={sending || undefined}>
            {sending ? 'Creating account…' : 'Create account'}
          </Button.Root>
        </div>
      </Stack.Root>
    </Form.Root>
  );
}
