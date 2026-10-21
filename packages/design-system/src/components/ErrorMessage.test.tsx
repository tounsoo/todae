import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, expectTypeOf, it, vi } from 'vitest';
import { ErrorMessage, resetMisuseLog, type ErrorMessageRootProps } from './ErrorMessage.js';
import * as api from '../index.js';

const css = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), 'ErrorMessage.module.css'),
  'utf8',
);

afterEach(cleanup);
beforeEach(resetMisuseLog);

describe('ErrorMessage exports', () => {
  it('is a top-level primitive', () => {
    expect(api.ErrorMessage).toBe(ErrorMessage);
    expectTypeOf<ErrorMessageRootProps>().toHaveProperty('id');
    expectTypeOf<ErrorMessageRootProps['id']>().toEqualTypeOf<string | undefined>();
  });
});

describe('ErrorMessage', () => {
  it('renders a span with the required id and no alert role', () => {
    const { container } = render(<ErrorMessage.Root id="email-error">Enter an email.</ErrorMessage.Root>);
    const message = container.querySelector('#email-error');
    expect(message?.tagName).toBe('SPAN');
    expect(message?.getAttribute('role')).toBeNull();
    expect(message?.getAttribute('aria-live')).toBeNull();
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('does not set aria-invalid on itself', () => {
    const { container } = render(<ErrorMessage.Root id="email-error">Enter an email.</ErrorMessage.Root>);
    expect(container.querySelector('#email-error')?.getAttribute('aria-invalid')).toBeNull();
  });

  it('owns control-to-message spacing and tightens after Description', () => {
    expect(css).toMatch(/margin-block-start:\s*var\(--todae-field-label-gap\)/);
    expect(css).toMatch(/margin-block-end:\s*0/);
    expect(css).toMatch(/line-height:\s*var\(--todae-field-error-leading\)/);
    expect(css).toMatch(
      /\[data-todae-description\]\)\s*\+\s*\.error[\s\S]*margin-block-start:\s*var\(--todae-field-messages-gap\)/,
    );
  });

  it('marks itself for the sibling rule', () => {
    const { container } = render(<ErrorMessage.Root id="email-error">Enter an email.</ErrorMessage.Root>);
    expect(container.querySelector('#email-error')?.getAttribute('data-todae-error')).toBe('');
  });
});

describe('ErrorMessage misuse', () => {
  it('logs once, however often it renders, for no id outside a scope', () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const { rerender } = render(<ErrorMessage.Root />);
    rerender(<ErrorMessage.Root />);
    rerender(<ErrorMessage.Root className="again" />);
    expect(error).toHaveBeenCalledTimes(1);
    error.mockRestore();
  });

  it('logs the function-child message alone for an id with a function child', () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    // @ts-expect-error a function child needs a validation scope, so no id
    render(<ErrorMessage.Root id="x">{() => 'nope'}</ErrorMessage.Root>);
    expect(error).toHaveBeenCalledTimes(1);
    expect(String(error.mock.calls[0]![0])).toContain('function child');
    error.mockRestore();
  });

  it('logs only the missing-scope message for no id and a function child outside a scope', () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    render(<ErrorMessage.Root>{() => 'nope'}</ErrorMessage.Root>);
    expect(error).toHaveBeenCalledTimes(1);
    expect(String(error.mock.calls[0]![0])).toContain('must render inside');
    error.mockRestore();
  });

  it('types a function child only without an id', () => {
    expectTypeOf<{ id: string; children: () => string }>().not.toExtend<ErrorMessageRootProps>();
    expectTypeOf<{ children: () => string }>().toExtend<ErrorMessageRootProps>();
    expectTypeOf<{ id: string; children: string }>().toExtend<ErrorMessageRootProps>();
  });

  it('logs a message once for the page, however many messages hit it', () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const { unmount } = render(<ErrorMessage.Root />);
    unmount();
    render(
      <>
        <ErrorMessage.Root />
        <ErrorMessage.Root />
      </>,
    );
    expect(error).toHaveBeenCalledTimes(1);
    error.mockRestore();
  });

  it('types an id that may be undefined with plain children, and a function child only without one', () => {
    expectTypeOf<{ id: string | undefined; children: string }>().toExtend<ErrorMessageRootProps>();
    expectTypeOf<{ id: string | undefined; children: () => string }>().not.toExtend<ErrorMessageRootProps>();
    expectTypeOf<{ className: string }>().toExtend<ErrorMessageRootProps>();
  });
});
