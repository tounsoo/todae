import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { userEvent } from '@vitest/browser/context';
import axe from 'axe-core';
import { useState, type ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Button, ErrorMessage, Field, Fieldset, Form, Label, RadioGroup } from '../index.js';

afterEach(cleanup);

function Text({ id, label, ...rest }: { id: string; label: string; required?: boolean; type?: 'email' }) {
  const [value, setValue] = useState('');
  return (
    <Field.Group>
      <Label.Root htmlFor={id}>{label}</Label.Root>
      <Field.Root id={id} name={id}>
        <Field.TextInput {...rest} value={value} onValueChange={setValue} />
      </Field.Root>
      <ErrorMessage.Root />
    </Field.Group>
  );
}

function Page({ summary, children }: { summary?: boolean; children?: ReactNode }) {
  return (
    <main data-appearance="light" data-density="comfortable">
      <Form.Root onSubmit={(event) => event.preventDefault()}>
        {summary ? <Form.Summary /> : null}
        <Text id="name" label="Name" />
        <Text id="email" label="Work email" type="email" required />
        <Text id="role" label="Role" required />
        {children}
        <Button.Root type="submit">Create account</Button.Root>
      </Form.Root>
    </main>
  );
}

const submit = () => userEvent.click(screen.getByRole('button', { name: 'Create account' }));

describe('Form in a browser', () => {
  it('does not let the browser show its own bubble, and does not submit an invalid form', async () => {
    const onSubmit = vi.fn((event: { preventDefault: () => void }) => event.preventDefault());
    render(
      <Form.Root onSubmit={onSubmit}>
        <Text id="email" label="Work email" type="email" required />
        <Button.Root type="submit">Send</Button.Root>
      </Form.Root>,
    );
    await userEvent.click(screen.getByRole('button', { name: 'Send' }));
    expect(onSubmit).not.toHaveBeenCalled();
    expect(screen.getByText('This field is required')).toBeTruthy();
  });

  it('moves focus to the first invalid control on a failed submit when there is no summary', async () => {
    render(<Page />);
    await submit();
    await waitFor(() => expect(document.activeElement).toBe(screen.getByLabelText('Work email')));
  });

  it('passes axe with the summary and every problem showing', async () => {
    render(
      <Page summary>
        <Fieldset.Root>
          <Fieldset.Legend>Plan</Fieldset.Legend>
          <RadioGroup.Root aria-label="Plan" name="plan">
            <RadioGroup.Item value="team" required>
              Team
            </RadioGroup.Item>
          </RadioGroup.Root>
          <ErrorMessage.Root />
        </Fieldset.Root>
      </Page>,
    );
    await submit();
    await screen.findByRole('group', { name: '3 problems to fix' });
    // Its color-contrast rule is WCAG 2; Todae checks contrast with APCA when tokens build.
    const result = await axe.run(document.body, { rules: { 'color-contrast': { enabled: false } } });
    expect(result.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`)).toEqual([]);
  });

  it('moves focus to the summary on a failed submit, which lists the problems in order', async () => {
    render(<Page summary />);
    await submit();
    const summary = await screen.findByRole('group', { name: '2 problems to fix' });
    await waitFor(() => expect(document.activeElement).toBe(summary));
    expect([...summary.querySelectorAll('a')].map((a) => a.textContent)).toEqual(['Work email', 'Role']);
  });

  it('focuses the control from a summary link, with the keyboard too', async () => {
    render(<Page summary />);
    await submit();
    await screen.findByRole('group', { name: '2 problems to fix' });
    await userEvent.click(screen.getByRole('link', { name: 'Role' }));
    expect(document.activeElement).toBe(screen.getByLabelText('Role'));

    await submit();
    await screen.findByRole('group', { name: '2 problems to fix' });
    await userEvent.keyboard('{Tab}');
    expect(document.activeElement).toBe(screen.getByRole('link', { name: 'Work email' }));
    await userEvent.keyboard('{Enter}');
    expect(document.activeElement).toBe(screen.getByLabelText('Work email'));
  });

  it('shows a field problem after typing and tabbing away, and clears it live', async () => {
    render(<Page />);
    await userEvent.click(screen.getByLabelText('Work email'));
    await userEvent.keyboard('ben');
    expect(screen.queryByText('Enter an email address')).toBeNull();
    await userEvent.keyboard('{Tab}');
    expect(await screen.findByText('Enter an email address')).toBeTruthy();
    expect(screen.getByLabelText('Work email').getAttribute('aria-invalid')).toBe('true');
    await userEvent.click(screen.getByLabelText('Work email'));
    await userEvent.keyboard('{End}@example.com');
    await waitFor(() => expect(screen.queryByText('Enter an email address')).toBeNull());
  });

  it('lists the error id in the control aria-describedby, and the page has that element', async () => {
    render(<Page />);
    await submit();
    const id = screen.getByLabelText('Work email').getAttribute('aria-describedby')!;
    expect(document.getElementById(id)?.textContent).toBe('This field is required');
  });

  it('checks a group of radios as one, naming the fieldset in the summary', async () => {
    render(
      <div data-appearance="light" data-density="comfortable">
        <Form.Root onSubmit={(event) => event.preventDefault()}>
          <Form.Summary />
          <Fieldset.Root>
            <Fieldset.Legend>Plan</Fieldset.Legend>
            <RadioGroup.Root aria-label="Plan" name="plan">
              <RadioGroup.Item value="team" required>
                Team
              </RadioGroup.Item>
              <RadioGroup.Item value="pro">Pro</RadioGroup.Item>
            </RadioGroup.Root>
            <ErrorMessage.Root />
          </Fieldset.Root>
          <Button.Root type="submit">Go</Button.Root>
        </Form.Root>
      </div>,
    );
    await userEvent.click(screen.getByRole('button', { name: 'Go' }));
    const summary = await screen.findByRole('group', { name: '1 problem to fix' });
    expect(summary.querySelector('a')?.textContent).toBe('Plan');
    await userEvent.click(screen.getByRole('link', { name: 'Plan' }));
    expect(document.activeElement).toBe(screen.getByLabelText('Team'));
    await userEvent.click(screen.getByLabelText('Pro'));
    await waitFor(() => expect(screen.queryByRole('group', { name: '1 problem to fix' })).toBeNull());
  });
});
