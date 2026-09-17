import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, expectTypeOf, it, vi } from 'vitest';
import { TextField, type TextFieldInputProps } from './TextField';

afterEach(cleanup);

describe('TextField', () => {
  it('wires id, disabled, and invalid onto one input and the shell', () => {
    const { container } = render(
      <TextField id="name" disabled invalid>
        <TextField.Input value="" onChange={() => undefined} />
      </TextField>,
    );
    const input = container.querySelector('input');
    expect(input).toHaveProperty('id', 'name');
    expect(input).toHaveProperty('disabled', true);
    expect(input?.getAttribute('aria-invalid')).toBe('true');
    expect(container.querySelector('[data-disabled]')).not.toBeNull();
    expect(container.querySelector('[data-invalid]')).not.toBeNull();
    expect(container.querySelectorAll('input')).toHaveLength(1);
  });

  it('renders prefix and suffix as text, not HTML', () => {
    const { container } = render(
      <TextField>
        <TextField.Prefix>{'<img onerror>'}</TextField.Prefix>
        <TextField.Input value="1" onChange={() => undefined} />
        <TextField.Suffix>.00</TextField.Suffix>
      </TextField>,
    );
    expect(screen.getByText('<img onerror>')).toBeTruthy();
    expect(container.querySelector('img')).toBeNull();
    expect(screen.getByText('.00')).toBeTruthy();
  });

  it('hides decorative icons and leaves interactive ones named', () => {
    render(
      <TextField>
        <TextField.IconStart>
          <span>search</span>
        </TextField.IconStart>
        <TextField.Input value="" onChange={() => undefined} />
        <TextField.IconEnd interactive>
          <button type="button">Clear</button>
        </TextField.IconEnd>
      </TextField>,
    );
    expect(screen.getByText('search').parentElement?.getAttribute('aria-hidden')).toBe('true');
    expect(screen.getByRole('button', { name: 'Clear' }).parentElement?.getAttribute('aria-hidden')).toBeNull();
  });

  it('focuses the input from chrome, not from adornment buttons', () => {
    render(
      <TextField>
        <TextField.Prefix>USD</TextField.Prefix>
        <TextField.Input value="" onChange={() => undefined} />
        <TextField.IconEnd interactive>
          <button type="button">Clear</button>
        </TextField.IconEnd>
      </TextField>,
    );
    const input = screen.getByRole('textbox');
    fireEvent.mouseDown(screen.getByText('USD'));
    expect(document.activeElement).toBe(input);
    screen.getByRole('button', { name: 'Clear' }).focus();
    fireEvent.mouseDown(screen.getByRole('button', { name: 'Clear' }));
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Clear' }));
  });

  it('stays controlled', () => {
    const onChange = vi.fn();
    render(
      <TextField>
        <TextField.Input value="kept" onChange={onChange} />
      </TextField>,
    );
    const input = screen.getByRole('textbox');
    expect(input).toHaveProperty('value', 'kept');
    fireEvent.change(input, { target: { value: 'next' } });
    expect(onChange).toHaveBeenCalled();
    expect(input).toHaveProperty('value', 'kept');
  });

  it('rejects file at the type level', () => {
    expectTypeOf<TextFieldInputProps['type']>().extract<'file'>().toBeNever();
    expectTypeOf<NonNullable<TextFieldInputProps['type']>>().toEqualTypeOf<
      'text' | 'search' | 'email' | 'url' | 'tel' | 'password'
    >();
  });
});
