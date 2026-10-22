'use client';

import {
  Alert,
  Button,
  Description,
  ErrorMessage,
  Field,
  Form,
  Label,
  Link,
  Stack,
  Text,
  useAnnouncer,
  type FormErrors,
} from '@tounsoo/todae';
import { Eye, EyeOff } from 'lucide-react';
import { useEffect, useId, useLayoutEffect, useRef, useState, type SubmitEvent } from 'react';

const CODE_LENGTH = 6;
const WIDTH = { inlineSize: '100%', maxInlineSize: '22rem' };

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// A stand-in for the server. It knows one account, whose code is always 123456.
async function checkPassword(email: string, password: string): Promise<FormErrors> {
  await wait(600);
  if (email.trim().toLowerCase() === 'ben@example.com' && password === 'correct horse') return {};
  return { password: 'The email or password is wrong.' };
}

async function checkCode(code: string): Promise<FormErrors> {
  await wait(600);
  return code === '123456' ? {} : { code: "That code isn't right. Check the latest message, or send a new code." };
}

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

export function SignInExample() {
  const ids = { email: useId(), password: useId(), code: useId(), codeHint: useId(), codeHeading: useId() };
  const [step, setStep] = useState<'password' | 'code' | 'done'>('password');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [shown, setShown] = useState(false);
  const [code, setCode] = useState('');
  const [errors, setErrors] = useState<FormErrors>({});
  const [sending, setSending] = useState(false);
  // Why the last request failed, shown in an Alert beside the button.
  const [failed, setFailed] = useState<string | null>(null);
  const [resent, setResent] = useState(false);
  const [resending, setResending] = useState(false);
  const codeForm = useRef<HTMLFormElement>(null);
  const doneHeading = useFocusOnShow<HTMLHeadingElement>(step === 'done');
  const announce = useAnnouncer();

  const send = async (request: Promise<FormErrors>, next: typeof step) => {
    setSending(true);
    setFailed(null);
    setErrors({});
    let reply: FormErrors;
    try {
      reply = await request;
    } catch {
      setFailed("We couldn't reach the server. Try again.");
      return;
    } finally {
      setSending(false);
    }
    if (hasErrors(reply)) setErrors(reply);
    else setStep(next);
  };

  const submitPassword = (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (sending) return;
    // Hidden again before the form goes, so the browser offers to save a password, not typed text.
    setShown(false);
    void send(checkPassword(email, password), 'code');
  };

  const submitCode = (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (sending) return;
    void send(checkCode(code), 'done');
  };

  // A full code sends itself a short pause after its last character, since an IME can still take it back.
  useEffect(() => {
    if (step !== 'code' || code.length !== CODE_LENGTH) return;
    const timer = setTimeout(() => codeForm.current?.requestSubmit(), 500);
    return () => clearTimeout(timer);
  }, [code, step]);

  const resend = async () => {
    if (resending) return;
    setResending(true);
    setFailed(null);
    try {
      await wait(300);
    } catch {
      setFailed("We couldn't send a new code. Try again.");
      return;
    } finally {
      setResending(false);
    }
    // The error was about the old code. The code stays, so a submitted form doesn't call it missing.
    setErrors({});
    setResent(true);
    // The hint changes too, but a description that changes isn't read out.
    announce('We sent a new code.');
  };

  const restart = () => {
    setPassword('');
    setCode('');
    setErrors({});
    setResent(false);
    setStep('password');
  };

  if (step === 'done') {
    return (
      <Stack.Root gap="normal" style={WIDTH}>
        <Text.Root as="h3" ref={doneHeading} tabIndex={-1}>
          Signed in
        </Text.Root>
        <div>
          <Button.Root variant="secondary" onClick={restart}>
            Sign out
          </Button.Root>
        </div>
      </Stack.Root>
    );
  }

  if (step === 'code') {
    return (
      // Its own key, so React mounts a new form, not the sign-in form that was already submitted.
      <Form.Root key="code" ref={codeForm} errors={errors} onSubmit={submitCode} aria-labelledby={ids.codeHeading}>
        <Stack.Root gap="normal" style={WIDTH}>
          <Text.Root as="h3" id={ids.codeHeading}>
            Check your phone
          </Text.Root>
          <Field.Group>
            <Label.Root htmlFor={ids.code}>Verification code</Label.Root>
            <Field.Root id={ids.code} name="code" aria-describedby={ids.codeHint}>
              {/* Focus goes straight to the code, where a phone offers the one from a text message. */}
              <Field.OneTimeCode autoFocus required length={CODE_LENGTH} value={code} onValueChange={setCode} />
            </Field.Root>
            <Description.Root id={ids.codeHint}>
              {resent ? 'We sent a new code' : 'Enter the 6-digit code we sent'} to the phone ending in 42.
            </Description.Root>
            <ErrorMessage.Root />
          </Field.Group>
          {failed ? <Alert.Root tone="critical">{failed}</Alert.Root> : null}
          <Stack.Root direction="row" gap="condensed" wrap>
            <Button.Root type="submit" aria-disabled={sending || undefined}>
              {sending ? 'Verifying…' : 'Verify'}
            </Button.Root>
            <Button.Root variant="ghost" aria-disabled={resending || undefined} onClick={resend}>
              Send a new code
            </Button.Root>
          </Stack.Root>
        </Stack.Root>
      </Form.Root>
    );
  }

  return (
    <Form.Root key="password" errors={errors} onSubmit={submitPassword} aria-label="Sign in">
      <Stack.Root gap="normal" style={WIDTH}>
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
            autoComplete="current-password"
            value={password}
            onValueChange={setPassword}
            shown={shown}
            onShownChange={setShown}
          />
          <ErrorMessage.Root />
        </Field.Group>
        {failed ? <Alert.Root tone="critical">{failed}</Alert.Root> : null}
        <Stack.Root direction="row" gap="normal" align="center" wrap>
          <Button.Root type="submit" aria-disabled={sending || undefined}>
            {sending ? 'Signing in…' : 'Sign in'}
          </Button.Root>
          <Link.Root href="#forgot-password">Forgot password?</Link.Root>
        </Stack.Root>
      </Stack.Root>
    </Form.Root>
  );
}

export function SignUpExample() {
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
