'use client';

import {
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
import { useId, useRef, useState, type ReactNode, type SubmitEvent } from 'react';
import { flushSync } from 'react-dom';

type Answers = { name: string; email: string; workspace: string; plan: string };
type Name = keyof Answers;

const EMPTY: Answers = { name: '', email: '', workspace: '', plan: '' };

// Each step and the controls it holds, so a reply's errors go back to the step that asks for them.
const STEPS: readonly { title: string; fields: readonly Name[] }[] = [
  { title: 'Account', fields: ['name', 'email'] },
  { title: 'Workspace', fields: ['workspace', 'plan'] },
  { title: 'Review', fields: [] },
];

const PLANS: Record<string, string> = { team: 'Team', pro: 'Pro' };

function statusOf(index: number, step: number): StepsStatus {
  if (index < step) return 'done';
  return index === step ? 'current' : 'pending';
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
  const [errors, setErrors] = useState<FormErrors[]>(() => STEPS.map(() => ({})));
  const [sending, setSending] = useState(false);
  const [created, setCreated] = useState(false);
  const headings = useRef<(HTMLHeadingElement | null)[]>([]);
  const createdHeading = useRef<HTMLHeadingElement>(null);

  const set = (name: Name) => (value: string) => setAnswers((current) => ({ ...current, [name]: value }));

  // Shows a step and moves focus to its heading, which a screen reader reads as the new step.
  const show = (index: number) => {
    flushSync(() => setStep(index));
    headings.current[index]?.focus();
  };

  // A step's form calls this only when every control in it is valid.
  const next = (index: number) => (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();
    // Moving on is a send: clear this step's server errors, as Form.Root asks.
    setErrors((current) => current.map((each, at) => (at === index ? {} : each)));
    show(index + 1);
  };

  const create = async (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (sending) return;
    setSending(true);
    setErrors(STEPS.map(() => ({})));
    const reply = await createWorkspace(answers);
    setSending(false);
    const first = STEPS.findIndex((each) => each.fields.some((name) => reply[name]));
    if (first === -1) {
      flushSync(() => setCreated(true));
      createdHeading.current?.focus();
      return;
    }
    // Each step's form takes its own errors. The first step's form is still waiting on a reply from its
    // Next, so as it shows again it moves focus to the control with the error, not to the heading.
    setErrors(STEPS.map((each) => Object.fromEntries(each.fields.filter((name) => reply[name]).map((name) => [name, reply[name]!]))));
    setStep(first);
  };

  const restart = () => {
    flushSync(() => {
      setAnswers(EMPTY);
      setErrors(STEPS.map(() => ({})));
      setCreated(false);
      setStep(0);
    });
    headings.current[0]?.focus();
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

  const heading = (index: number) => (
    <Text.Root
      as="h3"
      id={`${headingId}-step-${index}`}
      ref={(element: HTMLElement | null) => {
        headings.current[index] = element as HTMLHeadingElement | null;
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
        <Button.Root type="button" variant="secondary" onClick={() => show(index - 1)}>
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

      {/* Every step's form stays mounted, so its values and its wait for a reply survive while it is hidden. */}
      <Form.Root hidden={step !== 0} aria-labelledby={`${headingId}-step-0`} errors={errors[0]} onSubmit={next(0)}>
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

      <Form.Root hidden={step !== 1} aria-labelledby={`${headingId}-step-1`} errors={errors[1]} onSubmit={next(1)}>
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

      <Form.Root hidden={step !== 2} aria-labelledby={`${headingId}-step-2`} onSubmit={create}>
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
          {actions(
            2,
            // aria-disabled, not disabled, so the button keeps focus while the request runs.
            <Button.Root type="submit" aria-disabled={sending || undefined}>
              {sending ? 'Creating…' : 'Create workspace'}
            </Button.Root>,
          )}
        </Stack.Root>
      </Form.Root>
    </Stack.Root>
  );
}
