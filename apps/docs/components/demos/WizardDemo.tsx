'use client';

import {
  Alert,
  Button,
  DataList,
  ErrorMessage,
  Field,
  Fieldset,
  Form,
  Label,
  RadioGroup,
  Stack,
  Steps,
  Text,
  type FormErrors,
  type StepsStatus,
} from '@tounsoo/todae';
import { useId, useLayoutEffect, useRef, useState, type ReactNode, type SubmitEvent } from 'react';

type Answers = { name: string; email: string; workspace: string; plan: string };
type Name = keyof Answers;

const EMPTY: Answers = { name: '', email: '', workspace: '', plan: '' };

// Each step and the controls it holds, so a reply's errors go to the step that asks for them.
const STEPS: readonly { title: string; fields: readonly string[] }[] = [
  { title: 'Account', fields: ['name', 'email'] },
  { title: 'Workspace', fields: ['workspace', 'plan'] },
  { title: 'Review', fields: [] },
];

const PLANS: Record<string, string> = { team: 'Team', pro: 'Pro' };

function statusOf(index: number, step: number): StepsStatus {
  if (index < step) return 'done';
  return index === step ? 'current' : 'pending';
}

// The entries of a reply that belong, or don't belong, to a step's controls.
function pick(reply: FormErrors, fields: readonly string[], keep = true): FormErrors {
  return Object.fromEntries(Object.entries(reply).filter(([name]) => fields.includes(name) === keep));
}

// A stand-in for the server, which knows this address.
async function createWorkspace(answers: Answers): Promise<FormErrors> {
  await new Promise((resolve) => setTimeout(resolve, 600));
  return answers.email.trim().toLowerCase() === 'ben@example.com' ? { email: 'That address is taken.' } : {};
}

export function WizardExample() {
  const ids = { name: useId(), email: useId(), workspace: useId() };
  const headingId = useId();
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState(EMPTY);
  // The last reply's errors, less those of each step sent again since.
  const [reply, setReply] = useState<FormErrors>({});
  const [sending, setSending] = useState(false);
  const [failed, setFailed] = useState(false);
  const [created, setCreated] = useState(false);
  const forms = useRef<(HTMLFormElement | null)[]>([]);
  const headings = useRef<(HTMLElement | null)[]>([]);
  const createdHeading = useRef<HTMLElement>(null);
  // Set once the person moves, so the first render doesn't take focus.
  const moved = useRef(false);

  // Runs after the shown step's form has taken any reply. If it moved focus to a control with an
  // error, focus stays there; otherwise the step's heading takes it, as the button pressed is hidden.
  useLayoutEffect(() => {
    if (!moved.current) return;
    if (!forms.current[step]?.contains(document.activeElement)) headings.current[step]?.focus();
  }, [step]);

  useLayoutEffect(() => {
    if (created) createdHeading.current?.focus();
  }, [created]);

  const go = (index: number) => {
    moved.current = true;
    setStep(index);
  };

  const set = (name: Name) => (value: string) => setAnswers((current) => ({ ...current, [name]: value }));

  // A step's form calls this once its controls pass the check.
  const next = (index: number) => (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();
    // Moving on sends the step again: drop its errors, as Form.Root asks.
    setReply((current) => pick(current, STEPS[index]!.fields, false));
    go(index + 1);
  };

  const create = async (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSending(true);
    setFailed(false);
    setReply({});
    try {
      const errors = await createWorkspace(answers);
      const first = STEPS.findIndex((each) => each.fields.some((name) => errors[name]));
      if (first === -1) {
        setCreated(true);
        return;
      }
      setReply(errors);
      go(first);
    } catch {
      setFailed(true);
    } finally {
      setSending(false);
    }
  };

  const restart = () => {
    setAnswers(EMPTY);
    setReply({});
    setCreated(false);
    go(0);
  };

  if (created) {
    return (
      <Stack.Root gap="normal">
        <Text.Root as="h3" ref={createdHeading} tabIndex={-1}>
          Workspace created
        </Text.Root>
        <Text.Root>
          {answers.workspace} is ready on the {PLANS[answers.plan]} plan.
        </Text.Root>
        <div>
          <Button.Root variant="secondary" onClick={restart}>
            Start again
          </Button.Root>
        </div>
      </Stack.Root>
    );
  }

  // Every step's form stays mounted and hidden, so it keeps waiting on a reply. Only the step that
  // shows gets its errors, so a reply lands on a form the person can see.
  const form = (index: number) => ({
    ref: (element: HTMLFormElement | null) => {
      forms.current[index] = element;
    },
    hidden: step !== index,
    'aria-labelledby': `${headingId}-step-${index}`,
    errors: step === index ? pick(reply, STEPS[index]!.fields) : {},
  });

  const heading = (index: number) => (
    <Text.Root
      as="h3"
      id={`${headingId}-step-${index}`}
      ref={(element) => {
        headings.current[index] = element;
      }}
      tabIndex={-1}
    >
      <Text.Root as="span" size="label" style={{ display: 'block' }}>
        Step {index + 1} of {STEPS.length}
      </Text.Root>
      {STEPS[index]!.title}
    </Text.Root>
  );

  const actions = (index: number, submit: ReactNode) => (
    <Stack.Root direction="row" gap="condensed" wrap>
      {index > 0 ? (
        // Held while the last step sends, so the reply comes back to the answers it was sent.
        <Button.Root type="button" variant="secondary" aria-disabled={sending || undefined} onClick={() => go(index - 1)}>
          Back
        </Button.Root>
      ) : null}
      {submit}
    </Stack.Root>
  );

  return (
    <Stack.Root gap="spacious" style={{ inlineSize: '100%' }}>
      <Steps.Root variant="progress" aria-label="Sign-up steps">
        {STEPS.map((each, index) => (
          <Steps.Item key={each.title} status={statusOf(index, step)}>
            {each.title}
          </Steps.Item>
        ))}
      </Steps.Root>

      <Form.Root {...form(0)} onSubmit={next(0)}>
        <Stack.Root gap="normal">
          {heading(0)}
          <Field.Group>
            <Label.Root htmlFor={ids.name}>Name</Label.Root>
            <Field.Root id={ids.name} name="name">
              <Field.TextInput required minLength={2} autoComplete="name" value={answers.name} onValueChange={set('name')} />
            </Field.Root>
            <ErrorMessage.Root />
          </Field.Group>
          <Field.Group>
            <Label.Root htmlFor={ids.email}>Work email</Label.Root>
            <Field.Root id={ids.email} name="email">
              <Field.TextInput type="email" required autoComplete="email" value={answers.email} onValueChange={set('email')} />
            </Field.Root>
            <ErrorMessage.Root />
          </Field.Group>
          {actions(0, <Button.Root type="submit">Next</Button.Root>)}
        </Stack.Root>
      </Form.Root>

      <Form.Root {...form(1)} onSubmit={next(1)}>
        <Stack.Root gap="normal">
          {heading(1)}
          <Field.Group>
            <Label.Root htmlFor={ids.workspace}>Workspace name</Label.Root>
            <Field.Root id={ids.workspace} name="workspace">
              <Field.TextInput required value={answers.workspace} onValueChange={set('workspace')} />
            </Field.Root>
            <ErrorMessage.Root />
          </Field.Group>
          <Fieldset.Root>
            <Fieldset.Legend>Plan</Fieldset.Legend>
            <RadioGroup.Root aria-label="Plan" name="plan" value={answers.plan || null} onValueChange={set('plan')}>
              <RadioGroup.Item value="team" required>
                Team
              </RadioGroup.Item>
              <RadioGroup.Item value="pro">Pro</RadioGroup.Item>
            </RadioGroup.Root>
            <ErrorMessage.Root />
          </Fieldset.Root>
          {actions(1, <Button.Root type="submit">Next</Button.Root>)}
        </Stack.Root>
      </Form.Root>

      <Form.Root {...form(2)} onSubmit={create}>
        <Stack.Root gap="normal">
          {heading(2)}
          <DataList.Root>
            <DataList.Item>
              <DataList.Term>Name</DataList.Term>
              <DataList.Details>{answers.name}</DataList.Details>
            </DataList.Item>
            <DataList.Item>
              <DataList.Term>Work email</DataList.Term>
              <DataList.Details>{answers.email}</DataList.Details>
            </DataList.Item>
            <DataList.Item>
              <DataList.Term>Workspace</DataList.Term>
              <DataList.Details>{answers.workspace}</DataList.Details>
            </DataList.Item>
            <DataList.Item>
              <DataList.Term>Plan</DataList.Term>
              <DataList.Details>{PLANS[answers.plan]}</DataList.Details>
            </DataList.Item>
          </DataList.Root>
          {failed ? <Alert.Root tone="critical">The workspace wasn't created. Check your connection and try again.</Alert.Root> : null}
          {actions(
            2,
            // aria-disabled, not disabled, so the button keeps focus while the request runs and ignores clicks.
            <Button.Root type="submit" aria-disabled={sending || undefined}>
              {sending ? 'Creating…' : 'Create workspace'}
            </Button.Root>,
          )}
        </Stack.Root>
      </Form.Root>
    </Stack.Root>
  );
}
