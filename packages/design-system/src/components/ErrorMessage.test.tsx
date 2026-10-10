import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, expectTypeOf, it } from 'vitest';
import { ErrorMessage, type ErrorMessageProps } from './ErrorMessage';
import * as api from '../index';

const css = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), 'ErrorMessage.module.css'),
  'utf8',
);

afterEach(cleanup);

describe('ErrorMessage exports', () => {
  it('is a top-level primitive', () => {
    expect(api.ErrorMessage).toBe(ErrorMessage);
    expectTypeOf<ErrorMessageProps>().toHaveProperty('id');
    expectTypeOf<ErrorMessageProps['id']>().toEqualTypeOf<string>();
  });
});

describe('ErrorMessage', () => {
  it('renders a span with the required id and no alert role', () => {
    const { container } = render(<ErrorMessage id="email-error">Enter an email.</ErrorMessage>);
    const message = container.querySelector('#email-error');
    expect(message?.tagName).toBe('SPAN');
    expect(message?.getAttribute('role')).toBeNull();
    expect(message?.getAttribute('aria-live')).toBeNull();
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('does not set aria-invalid on itself', () => {
    const { container } = render(<ErrorMessage id="email-error">Enter an email.</ErrorMessage>);
    expect(container.querySelector('#email-error')?.getAttribute('aria-invalid')).toBeNull();
  });

  it('owns control-to-message spacing and tightens after Description', () => {
    expect(css).toMatch(/margin-block-start:\s*var\(--todae-field-label-gap\)/);
    expect(css).toMatch(/margin-block-end:\s*0/);
    expect(css).toMatch(/line-height:\s*1\.4/);
    expect(css).toMatch(
      /\[data-todae-description\]\)\s*\+\s*\.error[\s\S]*margin-block-start:\s*var\(--todae-field-messages-gap\)/,
    );
  });

  it('marks itself for the sibling rule', () => {
    const { container } = render(<ErrorMessage id="email-error">Enter an email.</ErrorMessage>);
    expect(container.querySelector('#email-error')?.getAttribute('data-todae-error')).toBe('');
  });
});
