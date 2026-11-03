import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { createRef, useState } from 'react';
import { afterEach, describe, expect, expectTypeOf, it, vi } from 'vitest';
import { Checkbox, type CheckboxRootProps } from './Checkbox.js';
import * as api from '../index.js';
import { Field } from './Field.js';
import { Form } from './Form.js';
import { mount, reset } from '../test/form.js';

const css = readFileSync(join(dirname(fileURLToPath(import.meta.url)), 'selection.module.css'), 'utf8');

afterEach(cleanup);

describe('Checkbox exports', () => {
  it('is a top-level primitive', () => {
    expect(api.Checkbox).toBe(Checkbox);
    expectTypeOf<CheckboxRootProps>().toHaveProperty('children');
    expectTypeOf<CheckboxRootProps>().toHaveProperty('checked');
  });
});

describe('Checkbox', () => {
  it('toggles when the visible label is clicked', () => {
    render(<Checkbox.Root name="terms">I accept the terms</Checkbox.Root>);
    const input = screen.getByRole('checkbox', { name: 'I accept the terms' });
    expect(input).toHaveProperty('checked', false);
    fireEvent.click(screen.getByText('I accept the terms'));
    expect(input).toHaveProperty('checked', true);
  });

  it('is uncontrolled from defaultChecked', () => {
    render(<Checkbox.Root defaultChecked>Remember this device</Checkbox.Root>);
    expect(screen.getByRole('checkbox')).toHaveProperty('checked', true);
    fireEvent.click(screen.getByRole('checkbox'));
    expect(screen.getByRole('checkbox')).toHaveProperty('checked', false);
  });

  it('is controlled from checked and fires onCheckedChange', () => {
    function Harness() {
      const [checked, setChecked] = useState(false);
      return (
        <Checkbox.Root checked={checked} onCheckedChange={setChecked}>
          Weekly digest
        </Checkbox.Root>
      );
    }
    render(<Harness />);
    const input = screen.getByRole('checkbox');
    expect(input).toHaveProperty('checked', false);
    fireEvent.click(input);
    expect(input).toHaveProperty('checked', true);
  });

  it('does not mutate checked without the caller', () => {
    const onCheckedChange = vi.fn();
    render(
      <Checkbox.Root checked={false} onCheckedChange={onCheckedChange}>
        Locked
      </Checkbox.Root>,
    );
    fireEvent.click(screen.getByRole('checkbox'));
    expect(screen.getByRole('checkbox')).toHaveProperty('checked', false);
    expect(onCheckedChange).toHaveBeenCalledWith(true);
  });

  it('sets aria-invalid when invalid', () => {
    render(<Checkbox.Root invalid>Accept</Checkbox.Root>);
    expect(screen.getByRole('checkbox').getAttribute('aria-invalid')).toBe('true');
  });

  it('forwards aria-describedby onto the input', () => {
    render(
      <Checkbox.Root aria-describedby="terms-error">I accept the terms</Checkbox.Root>,
    );
    expect(screen.getByRole('checkbox').getAttribute('aria-describedby')).toBe('terms-error');
  });

  it('is a native checkbox a form can collect', () => {
    render(
      <form>
        <Checkbox.Root name="terms" value="yes" defaultChecked>
          I accept the terms
        </Checkbox.Root>
      </form>,
    );
    const input = screen.getByRole('checkbox');
    expect(input).toHaveProperty('type', 'checkbox');
    expect(input).toHaveProperty('name', 'terms');
    expect(input).toHaveProperty('value', 'yes');
  });

  it('shows the check glyph in the indicator only while checked', () => {
    // On the wrapper, so a text glyph hides too, not just an svg.
    expect(css).toMatch(/\.glyph \{[^}]*visibility: hidden/);
    expect(css).toMatch(/\.input:checked \+ \.indicator > \.glyph \{[^}]*visibility: visible/);
    expect(css).toMatch(/data-control='switch'[\s\S]*translateX/);
  });
});

describe('Checkbox indeterminate', () => {
  it('sets the input property and data-indeterminate, and shows the dash glyph in place of the check', () => {
    const { container } = render(<Checkbox.Root indeterminate>Select all</Checkbox.Root>);
    const input = screen.getByRole('checkbox') as HTMLInputElement;
    expect(input.indeterminate).toBe(true);
    expect(container.querySelector('label')?.hasAttribute('data-indeterminate')).toBe(true);
    expect(container.querySelectorAll('[data-todae-glyph] path')).toHaveLength(1);
    expect(container.querySelector('[data-todae-glyph] path')?.getAttribute('d')).toBe('M4 8h8');
  });

  it('puts the property back when a click clears it under control', () => {
    function Harness() {
      const [checked, setChecked] = useState(false);
      return (
        <Checkbox.Root checked={checked} onCheckedChange={setChecked} indeterminate>
          Select all
        </Checkbox.Root>
      );
    }
    render(<Harness />);
    const input = screen.getByRole('checkbox') as HTMLInputElement;
    fireEvent.click(input);
    expect(input.checked).toBe(true);
    expect(input.indeterminate).toBe(true);
  });

  it('puts the property back when the change is not accepted', () => {
    render(
      <Checkbox.Root checked={false} indeterminate>
        Select all
      </Checkbox.Root>,
    );
    const input = screen.getByRole('checkbox') as HTMLInputElement;
    fireEvent.click(input);
    expect(input.indeterminate).toBe(true);
  });

  it('clears the property when indeterminate goes away, and leaves a plain checkbox alone', () => {
    const { rerender } = render(<Checkbox.Root indeterminate>Select all</Checkbox.Root>);
    rerender(<Checkbox.Root>Select all</Checkbox.Root>);
    expect((screen.getByRole('checkbox') as HTMLInputElement).indeterminate).toBe(false);
    expect(document.querySelector('[data-indeterminate]')).toBeNull();
  });

  it('keeps a consumer ref on the input', () => {
    const ref = createRef<HTMLInputElement>();
    render(<Checkbox.Root ref={ref} indeterminate>Select all</Checkbox.Root>);
    expect(ref.current).toBe(screen.getByRole('checkbox'));
  });
});

describe('Checkbox after a form reset', () => {
  const box = () => screen.getByRole('checkbox') as HTMLInputElement;
  const shownChecked = () => box().closest('label')!.hasAttribute('data-checked');

  it('goes back to defaultChecked, reports it, and reports the next tick', async () => {
    const onCheckedChange = vi.fn();
    render(
      <form>
        <Checkbox.Root onCheckedChange={onCheckedChange}>Weekly digest</Checkbox.Root>
      </form>,
    );
    fireEvent.click(box());
    await reset(box().form!);
    expect(box().checked).toBe(false);
    expect(shownChecked()).toBe(false);
    fireEvent.click(box());
    expect(shownChecked()).toBe(true);
    expect(onCheckedChange.mock.calls).toEqual([[true], [false], [true]]);
  });

  it('follows the reset when a reset handler renders the box again first', async () => {
    const onCheckedChange = vi.fn();
    function Harness() {
      const [resets, setResets] = useState(0);
      return (
        <form onReset={() => setResets((count) => count + 1)}>
          <Checkbox.Root defaultChecked onCheckedChange={onCheckedChange}>
            Weekly digest {resets}
          </Checkbox.Root>
        </form>
      );
    }
    render(<Harness />);
    fireEvent.click(box());
    await reset(box().form!);
    expect(box().checked).toBe(true);
    expect(shownChecked()).toBe(true);
    expect(onCheckedChange.mock.calls).toEqual([[false], [true]]);
  });

  it('follows the reset in a Field.Group inside Form.Root', async () => {
    const onCheckedChange = vi.fn();
    await mount(
      <Form.Root>
        <Field.Group>
          <Checkbox.Root name="terms" defaultChecked onCheckedChange={onCheckedChange}>
            I accept the terms
          </Checkbox.Root>
        </Field.Group>
      </Form.Root>,
    );
    fireEvent.click(box());
    await reset(box().form!);
    expect(box().checked).toBe(true);
    expect(shownChecked()).toBe(true);
    expect(onCheckedChange.mock.calls).toEqual([[false], [true]]);
  });

  it('keeps the value a controlled owner sets in its own reset handler', async () => {
    const onCheckedChange = vi.fn();
    function Harness() {
      const [checked, setChecked] = useState(false);
      return (
        <form onReset={() => setChecked(true)}>
          <Checkbox.Root
            checked={checked}
            onCheckedChange={(next) => {
              onCheckedChange(next);
              setChecked(next);
            }}
          >
            Weekly digest
          </Checkbox.Root>
        </form>
      );
    }
    render(<Harness />);
    await reset(box().form!);
    expect(box().checked).toBe(true);
    expect(shownChecked()).toBe(true);
    expect(onCheckedChange).not.toHaveBeenCalled();
    fireEvent.click(box());
    expect(onCheckedChange.mock.calls).toEqual([[false]]);
  });

  it('keeps its state when a handler cancels the reset', async () => {
    const onCheckedChange = vi.fn();
    render(
      <form onReset={(event) => event.preventDefault()}>
        <Checkbox.Root onCheckedChange={onCheckedChange}>Weekly digest</Checkbox.Root>
      </form>,
    );
    fireEvent.click(box());
    await reset(box().form!);
    expect(box().checked).toBe(true);
    expect(shownChecked()).toBe(true);
    expect(onCheckedChange.mock.calls).toEqual([[true]]);
  });

  it('tells a controlled owner, who can follow the reset', async () => {
    function Harness() {
      const [checked, setChecked] = useState(false);
      return (
        <form>
          <Checkbox.Root checked={checked} onCheckedChange={setChecked}>
            Weekly digest
          </Checkbox.Root>
        </form>
      );
    }
    render(<Harness />);
    fireEvent.click(box());
    await reset(box().form!);
    expect(box().checked).toBe(false);
    expect(shownChecked()).toBe(false);
  });

  it('shows a controlled value again when the owner turns the reset down or has no callback', async () => {
    const onCheckedChange = vi.fn();
    const { rerender } = render(
      <form>
        <Checkbox.Root checked={false} onCheckedChange={onCheckedChange}>
          Weekly digest
        </Checkbox.Root>
      </form>,
    );
    rerender(
      <form>
        <Checkbox.Root checked onCheckedChange={onCheckedChange}>
          Weekly digest
        </Checkbox.Root>
      </form>,
    );
    await reset(box().form!);
    expect(onCheckedChange.mock.calls).toEqual([[false]]);
    expect(box().checked).toBe(true);
    rerender(
      <form>
        <Checkbox.Root checked>Weekly digest</Checkbox.Root>
      </form>,
    );
    await reset(box().form!);
    expect(box().checked).toBe(true);
    expect(shownChecked()).toBe(true);
  });
});
