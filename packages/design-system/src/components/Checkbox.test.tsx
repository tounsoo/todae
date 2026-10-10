import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { afterEach, describe, expect, expectTypeOf, it, vi } from 'vitest';
import { Checkbox, type CheckboxProps } from './Checkbox';
import * as api from '../index';

const css = readFileSync(join(dirname(fileURLToPath(import.meta.url)), 'selection.module.css'), 'utf8');

afterEach(cleanup);

describe('Checkbox exports', () => {
  it('is a top-level primitive', () => {
    expect(api.Checkbox).toBe(Checkbox);
    expectTypeOf<CheckboxProps>().toHaveProperty('children');
    expectTypeOf<CheckboxProps>().toHaveProperty('checked');
  });
});

describe('Checkbox', () => {
  it('toggles when the visible label is clicked', () => {
    render(<Checkbox name="terms">I accept the terms</Checkbox>);
    const input = screen.getByRole('checkbox', { name: 'I accept the terms' });
    expect(input).toHaveProperty('checked', false);
    fireEvent.click(screen.getByText('I accept the terms'));
    expect(input).toHaveProperty('checked', true);
  });

  it('is uncontrolled from defaultChecked', () => {
    render(<Checkbox defaultChecked>Remember this device</Checkbox>);
    expect(screen.getByRole('checkbox')).toHaveProperty('checked', true);
    fireEvent.click(screen.getByRole('checkbox'));
    expect(screen.getByRole('checkbox')).toHaveProperty('checked', false);
  });

  it('is controlled from checked and fires onCheckedChange', () => {
    function Harness() {
      const [checked, setChecked] = useState(false);
      return (
        <Checkbox checked={checked} onCheckedChange={setChecked}>
          Weekly digest
        </Checkbox>
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
      <Checkbox checked={false} onCheckedChange={onCheckedChange}>
        Locked
      </Checkbox>,
    );
    fireEvent.click(screen.getByRole('checkbox'));
    expect(screen.getByRole('checkbox')).toHaveProperty('checked', false);
    expect(onCheckedChange).toHaveBeenCalledWith(true);
  });

  it('sets aria-invalid when invalid', () => {
    render(<Checkbox invalid>Accept</Checkbox>);
    expect(screen.getByRole('checkbox').getAttribute('aria-invalid')).toBe('true');
  });

  it('forwards aria-describedby onto the input', () => {
    render(
      <Checkbox aria-describedby="terms-error">I accept the terms</Checkbox>,
    );
    expect(screen.getByRole('checkbox').getAttribute('aria-describedby')).toBe('terms-error');
  });

  it('is a native checkbox a form can collect', () => {
    render(
      <form>
        <Checkbox name="terms" value="yes" defaultChecked>
          I accept the terms
        </Checkbox>
      </form>,
    );
    const input = screen.getByRole('checkbox');
    expect(input).toHaveProperty('type', 'checkbox');
    expect(input).toHaveProperty('name', 'terms');
    expect(input).toHaveProperty('value', 'yes');
  });

  it('shows the check glyph in the indicator only while checked', () => {
    expect(css).toMatch(/\.indicator > :is\(svg, img\) \{[^}]*visibility: hidden;/);
    expect(css).toMatch(/\.input:checked \+ \.indicator > :is\(svg, img\) \{\s*visibility: visible;/);
    expect(css).toMatch(/data-control='switch'[\s\S]*translateX/);
  });
});
