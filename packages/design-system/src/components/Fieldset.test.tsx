import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { Checkbox } from './Checkbox';
import { ErrorMessage } from './ErrorMessage';
import { Field } from './Field';
import { Fieldset } from './Fieldset';
import { RadioGroup } from './Radio';
import { Switch } from './Switch';

afterEach(cleanup);

const noop = () => undefined;

describe('Fieldset', () => {
  it('names the group with its legend', () => {
    render(
      <Fieldset.Root>
        <Fieldset.Legend>Notifications</Fieldset.Legend>
        <Checkbox.Root>Email</Checkbox.Root>
      </Fieldset.Root>,
    );
    expect(screen.getByRole('group', { name: 'Notifications' }).tagName).toBe('FIELDSET');
  });

  it('disables the controls inside natively and marks Todae controls disabled', () => {
    render(
      <Fieldset.Root disabled data-testid="set">
        <Fieldset.Legend>Notifications</Fieldset.Legend>
        <Checkbox.Root>Email</Checkbox.Root>
        <Switch.Root>Push</Switch.Root>
      </Fieldset.Root>,
    );
    const set = screen.getByTestId('set') as HTMLFieldSetElement;
    expect(set.disabled).toBe(true);
    expect(set.hasAttribute('data-disabled')).toBe(true);
    for (const input of [screen.getByRole('checkbox'), screen.getByRole('switch')]) {
      expect(input).toHaveProperty('disabled', true);
      expect(input.closest('label')!.hasAttribute('data-disabled')).toBe(true);
    }
  });

  it('marks the controls inside invalid and keeps its error in aria-describedby', () => {
    render(
      <Fieldset.Root invalid aria-describedby="err" data-testid="set">
        <Fieldset.Legend>Topics</Fieldset.Legend>
        <Checkbox.Root>News</Checkbox.Root>
        <ErrorMessage.Root id="err">Pick one</ErrorMessage.Root>
      </Fieldset.Root>,
    );
    const set = screen.getByTestId('set');
    expect(set.getAttribute('aria-describedby')).toBe('err');
    expect(set.hasAttribute('aria-invalid')).toBe(false);
    expect(set.hasAttribute('data-invalid')).toBe(true);
    expect(screen.getByRole('checkbox').getAttribute('aria-invalid')).toBe('true');
  });

  it('carries its state into a RadioGroup and a Field', () => {
    render(
      <Fieldset.Root disabled invalid>
        <Fieldset.Legend>Plan</Fieldset.Legend>
        <RadioGroup.Root aria-label="Size">
          <RadioGroup.Item value="s">Small</RadioGroup.Item>
        </RadioGroup.Root>
        <Field.Root aria-label="Note" data-testid="shell">
          <Field.TextInput value="" onChange={noop} />
        </Field.Root>
      </Fieldset.Root>,
    );
    const group = screen.getByRole('radiogroup');
    expect(group.getAttribute('aria-disabled')).toBe('true');
    expect(group.getAttribute('aria-invalid')).toBe('true');
    expect(screen.getByRole('radio').getAttribute('aria-invalid')).toBe('true');
    const shell = screen.getByTestId('shell');
    expect(shell.hasAttribute('data-disabled')).toBe(true);
    expect(shell.hasAttribute('data-invalid')).toBe(true);
    const input = screen.getByRole('textbox');
    expect(input).toHaveProperty('disabled', true);
    expect(input.getAttribute('aria-invalid')).toBe('true');
  });

  it('passes an outer fieldset state to an inner one', () => {
    render(
      <Fieldset.Root disabled>
        <Fieldset.Legend>Outer</Fieldset.Legend>
        <Fieldset.Root data-testid="inner">
          <Fieldset.Legend>Inner</Fieldset.Legend>
          <Checkbox.Root>Item</Checkbox.Root>
        </Fieldset.Root>
      </Fieldset.Root>,
    );
    expect(screen.getByTestId('inner').hasAttribute('data-disabled')).toBe(true);
    expect(screen.getByTestId('inner').hasAttribute('disabled')).toBe(false);
    expect(screen.getByRole('checkbox').closest('label')!.hasAttribute('data-disabled')).toBe(true);
  });

  it('keeps a control in the legend enabled, as natively, unless an outer fieldset is disabled', () => {
    render(
      <>
        <Fieldset.Root disabled>
          <Fieldset.Legend>
            <Switch.Root>Enable alerts</Switch.Root>
          </Fieldset.Legend>
          <Checkbox.Root>Email</Checkbox.Root>
        </Fieldset.Root>
        <Fieldset.Root disabled>
          <Fieldset.Legend>Outer</Fieldset.Legend>
          <Fieldset.Root>
            <Fieldset.Legend>
              <Switch.Root>Nested toggle</Switch.Root>
            </Fieldset.Legend>
          </Fieldset.Root>
        </Fieldset.Root>
      </>,
    );
    const toggle = screen.getByRole('switch', { name: 'Enable alerts' });
    expect(toggle.hasAttribute('disabled')).toBe(false);
    expect(toggle.closest('label')!.hasAttribute('data-disabled')).toBe(false);
    expect(screen.getByRole('checkbox').hasAttribute('disabled')).toBe(true);
    const nested = screen.getByRole('switch', { name: 'Nested toggle' });
    expect(nested.closest('label')!.hasAttribute('data-disabled')).toBe(true);
  });

  it('lets a control inside an invalid fieldset opt out with invalid={false}', () => {
    render(
      <Fieldset.Root invalid>
        <Fieldset.Legend>Address</Fieldset.Legend>
        <Field.Root aria-label="Street" invalid={false}>
          <Field.TextInput value="1 Main St" onChange={noop} />
        </Field.Root>
        <Field.Root aria-label="Postcode">
          <Field.TextInput value="?" onChange={noop} />
        </Field.Root>
      </Fieldset.Root>,
    );
    const [street, postcode] = screen.getAllByRole('textbox');
    expect(street!.hasAttribute('aria-invalid')).toBe(false);
    expect(postcode!.getAttribute('aria-invalid')).toBe('true');
  });

  it('exempts only the first legend child, as natively', () => {
    render(
      <Fieldset.Root disabled>
        <div>
          <Fieldset.Legend>
            <Switch.Root>Wrapped</Switch.Root>
          </Fieldset.Legend>
        </div>
      </Fieldset.Root>,
    );
    const toggle = screen.getByRole('switch', { name: 'Wrapped' });
    expect(toggle.hasAttribute('disabled')).toBe(true);
    expect(toggle.closest('label')!.hasAttribute('data-disabled')).toBe(true);
  });

  it('moves the exemption to a legend added before the first one', () => {
    function Form({ intro }: { intro: boolean }) {
      return (
        <Fieldset.Root disabled>
          {intro ? <Fieldset.Legend>Intro</Fieldset.Legend> : null}
          <Fieldset.Legend>
            <Switch.Root>Toggle</Switch.Root>
          </Fieldset.Legend>
        </Fieldset.Root>
      );
    }
    const { rerender } = render(<Form intro={false} />);
    const label = () => screen.getByRole('switch').closest('label')!;
    expect(label().hasAttribute('data-disabled')).toBe(false);
    rerender(<Form intro />);
    expect(label().hasAttribute('data-disabled')).toBe(true);
  });

  it('keeps a control in the legend out of the fieldset invalid state', () => {
    render(
      <Fieldset.Root invalid>
        <Fieldset.Legend>
          <Checkbox.Root>Select all</Checkbox.Root>
        </Fieldset.Legend>
        <Checkbox.Root>Item</Checkbox.Root>
      </Fieldset.Root>,
    );
    expect(screen.getByRole('checkbox', { name: 'Select all' }).hasAttribute('aria-invalid')).toBe(false);
    expect(screen.getByRole('checkbox', { name: 'Item' }).getAttribute('aria-invalid')).toBe('true');
  });

  it('leaves controls outside a fieldset alone', () => {
    render(<Checkbox.Root>Alone</Checkbox.Root>);
    const box = screen.getByRole('checkbox');
    expect(box).toHaveProperty('disabled', false);
    expect(box.hasAttribute('aria-invalid')).toBe(false);
  });
});
