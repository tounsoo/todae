import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { useEffect, useRef, useState } from 'react';
import { renderToString } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ErrorMessage, Field, Form, Label } from '../index.js';
import { mount, submit } from '../test/form.js';
import { Quantity, input, valueInput, type, key } from '../test/number.js';
import { resetWarnOnce } from './warnOnce.js';

afterEach(() => {
  cleanup();
  resetWarnOnce();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('Field.NumberInput in a form', () => {
  const entries = (form: HTMLElement) => [...new FormData(form as HTMLFormElement).entries()];

  it('sends the number as HTML writes it whatever the locale, from the value input', () => {
    for (const locale of ['en-US', 'de-DE', 'ko-KR', 'fr-FR', 'ar-EG']) {
      cleanup();
      render(
        <form data-testid="form">
          <Quantity initial={1234.5} locale={locale} />
        </form>,
      );
      expect(entries(screen.getByTestId('form')), locale).toEqual([['quantity', '1234.5']]);
    }
  });

  it('sends nothing for no number, and the text input never sends', () => {
    render(
      <form data-testid="form">
        <Quantity />
      </form>,
    );
    expect(entries(screen.getByTestId('form'))).toEqual([['quantity', '']]);
    expect(input().name).toBe('');
    expect(valueInput().name).toBe('quantity');
  });

  it('gives the name to a name prop, and goes without one beside a control that took the field name', () => {
    render(
      <form data-testid="form">
        <Field.Root aria-label="Price" name="price">
          <Field.NumberInput value={3} name="amount" />
        </Field.Root>
        <Field.Root aria-label="Both" name="both">
          <Field.TextInput value="x" onChange={() => undefined} />
          <Field.NumberInput value={3} />
        </Field.Root>
      </form>,
    );
    expect(entries(screen.getByTestId('form'))).toEqual([
      ['amount', '3'],
      ['both', 'x'],
    ]);
  });

  it('hands the value input the bounds, the step and required, with step any when there is none', () => {
    const { rerender } = render(<Quantity initial={3} min={1} max={9} step={2} required />);
    expect(valueInput().type).toBe('number');
    expect(valueInput().min).toBe('1');
    expect(valueInput().max).toBe('9');
    expect(valueInput().step).toBe('2');
    expect(valueInput().required).toBe(true);
    rerender(<Quantity initial={3} />);
    expect(valueInput().step).toBe('any');
    expect(valueInput().validity.valid).toBe(true);
  });

  it('is no tab stop and takes no press on the shell, only the text input does', () => {
    render(<Quantity initial={3} buttons />);
    const shell = input().parentElement!;
    fireEvent.mouseDown(shell);
    expect(document.activeElement).toBe(input());
    expect(valueInput().tabIndex).toBe(-1);
  });

  it('blocks a submit with no number when required, in Form.Root, and focuses the text input', async () => {
    const onSubmit = vi.fn((event: React.FormEvent) => event.preventDefault());
    await mount(
      <Form.Root data-testid="form" onSubmit={onSubmit}>
        <Field.Group>
          <Label.Root htmlFor="qty">Quantity</Label.Root>
          <Field.Root id="qty" name="quantity">
            <Field.NumberInput value={null} required />
          </Field.Root>
          <ErrorMessage.Root />
        </Field.Group>
      </Form.Root>,
    );
    await submit(screen.getByTestId('form'));
    expect(onSubmit).not.toHaveBeenCalled();
    expect(screen.getByText('This field is required')).toBeTruthy();
    expect(document.activeElement).toBe(input());
    expect(input().getAttribute('aria-invalid')).toBe('true');
    expect(input().getAttribute('aria-describedby')).toContain(screen.getByText('This field is required').id);
  });

  it("words the bounds in the field's own format", async () => {
    const bounds = async (locale: string, value: number, formatOptions?: Intl.NumberFormatOptions) => {
      cleanup();
      await mount(
        <Form.Root data-testid="form" onSubmit={(event) => event.preventDefault()}>
          <Field.Group>
            <Field.Root name="price" aria-label="Price">
              <Field.NumberInput value={value} min={1000} max={50000} locale={locale} formatOptions={formatOptions} />
            </Field.Root>
            <ErrorMessage.Root />
          </Field.Group>
        </Form.Root>,
      );
      await submit(screen.getByTestId('form'));
      return document.querySelector('[data-todae-error]')?.textContent;
    };
    expect(await bounds('de', 500)).toBe('Enter 1.000 or more');
    expect(await bounds('en', 60000)).toBe('Enter 50,000 or less');
    expect(await bounds('ko', 500, { style: 'currency', currency: 'KRW' })).toBe('Enter ₩1,000 or more');
    expect(await bounds('fr', 60000)).toBe('Enter 50 000 or less');
  });

  it('shows a value off its step as a step mismatch', async () => {
    await mount(
      <Form.Root data-testid="form" onSubmit={(event) => event.preventDefault()}>
        <Field.Group>
          <Field.Root name="price" aria-label="Price">
            <Field.NumberInput value={7} min={0} step={5} />
          </Field.Root>
          <ErrorMessage.Root />
        </Field.Group>
      </Form.Root>,
    );
    await submit(screen.getByTestId('form'));
    expect(document.querySelector('[data-todae-error]')?.textContent).toBe('Enter a value that fits the allowed steps');
  });

  it('counts a commit as an edit that hides the field server error, and typing alone does not', async () => {
    function Page() {
      const [value, setValue] = useState<number | null>(3);
      return (
        <Form.Root data-testid="form" errors={{ quantity: 'Only 2 left' }} onSubmit={(event) => event.preventDefault()}>
          <Field.Group>
            <Field.Root name="quantity" aria-label="Quantity">
              <Field.NumberInput value={value} onValueChange={setValue} locale="en" />
            </Field.Root>
            <ErrorMessage.Root />
          </Field.Group>
        </Form.Root>
      );
    }
    await mount(<Page />);
    expect(screen.getByText('Only 2 left')).toBeTruthy();
    await act(async () => type('2'));
    expect(screen.getByText('Only 2 left')).toBeTruthy();
    await act(async () => {
      fireEvent.blur(input());
    });
    expect(screen.queryByText('Only 2 left')).toBeNull();
  });

  it('holds the number Enter committed in the value input when the form is read', async () => {
    const seen: (string | null)[] = [];
    await mount(
      <Form.Root
        data-testid="form"
        onSubmit={(event) => {
          event.preventDefault();
          seen.push(new FormData(event.currentTarget).get('quantity') as string | null);
        }}
      >
        <Quantity locale="en" />
        <button type="submit">Send</button>
      </Form.Root>,
    );
    await act(async () => type('42'));
    await act(async () => {
      key('Enter');
    });
    await submit(screen.getByTestId('form'));
    expect(seen).toEqual(['42']);
  });
});

describe('Field.NumberInput and a submit with no blur', () => {
  function Page({ onSubmit }: { onSubmit: (event: React.FormEvent<HTMLFormElement>) => void }) {
    const [value, setValue] = useState<number | null>(3);
    return (
      <Form.Root data-testid="form" onSubmit={onSubmit}>
        <Field.Group>
          <Field.Root name="quantity" aria-label="Quantity">
            <Field.NumberInput value={value} onValueChange={setValue} locale="en" />
          </Field.Root>
          <ErrorMessage.Root />
        </Field.Group>
      </Form.Root>
    );
  }

  it('commits a readable text first, so the form sends what was typed', async () => {
    const seen: (string | null)[] = [];
    const onSubmit = (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      seen.push(new FormData(event.currentTarget).get('quantity') as string | null);
    };
    await mount(<Page onSubmit={onSubmit} />);
    await act(async () => type('7'));
    await act(async () => {
      (screen.getByTestId('form') as HTMLFormElement).requestSubmit();
    });
    expect(seen).toEqual(['7']);
    expect(input().value).toBe('7');
  });

  it('blocks a submit while the text is no number, even after a step', async () => {
    const onSubmit = vi.fn((event: React.FormEvent) => event.preventDefault());
    await mount(<Page onSubmit={onSubmit} />);
    await act(async () => type('abc'));
    await act(async () => key('ArrowUp'));
    await act(async () => {
      (screen.getByTestId('form') as HTMLFormElement).requestSubmit();
    });
    expect(onSubmit).not.toHaveBeenCalled();
    expect(input().value).toBe('abc');
    expect(input().getAttribute('aria-invalid')).toBe('true');
    expect(screen.getByText('Enter a valid value')).toBeTruthy();
  });
});

describe('Field.NumberInput with a text that is no number, in a form', () => {
  it('blocks a submit, shows the message and marks the input, until the text is a number', async () => {
    const onSubmit = vi.fn((event: React.FormEvent) => event.preventDefault());
    function Page() {
      const [value, setValue] = useState<number | null>(3);
      return (
        <Form.Root data-testid="form" onSubmit={onSubmit}>
          <Field.Group>
            <Field.Root name="quantity" aria-label="Quantity">
              <Field.NumberInput value={value} onValueChange={setValue} locale="en" />
            </Field.Root>
            <ErrorMessage.Root />
          </Field.Group>
        </Form.Root>
      );
    }
    await mount(<Page />);
    await act(async () => type('1,5'));
    await act(async () => {
      fireEvent.blur(input());
    });
    await submit(screen.getByTestId('form'));
    expect(onSubmit).not.toHaveBeenCalled();
    expect(screen.getByText('Enter a valid value')).toBeTruthy();
    expect(input().value).toBe('1,5');
    expect(input().getAttribute('aria-invalid')).toBe('true');
    await act(async () => type('15'));
    await act(async () => {
      key('Enter');
    });
    await submit(screen.getByTestId('form'));
    expect(onSubmit).toHaveBeenCalledOnce();
    expect(screen.queryByText('Enter a valid value')).toBeNull();
  });
});

describe('Field.NumberInput on the server', () => {
  it('renders the text in the locale, with the aria value', () => {
    const html = renderToString(
      <Field.Root aria-label="Quantity" name="quantity">
        <Field.NumberInput value={1234.5} locale="de" min={0} onValueChange={() => undefined} />
      </Field.Root>,
    );
    expect(html).toContain('value="1.234,5"');
    expect(html).toContain('role="spinbutton"');
    expect(html).toContain('aria-valuenow="1234.5"');
    expect(html).toContain('value="1234.5"');
  });
});

describe('Field.NumberInput and a submit from inside a commit phase', () => {
  it('sends the typed number when an effect submits the form, with no flushSync warning', () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const sent: (string | null)[] = [];
    const changed = vi.fn();
    function Page({ go }: { go: boolean }) {
      const [value, setValue] = useState<number | null>(3);
      const form = useRef<HTMLFormElement>(null);
      useEffect(() => {
        if (go) form.current?.requestSubmit();
      }, [go]);
      return (
        <form
          ref={form}
          onSubmit={(event) => {
            event.preventDefault();
            sent.push(new FormData(event.currentTarget).get('quantity') as string | null);
          }}
        >
          <Field.Root aria-label="Quantity" name="quantity">
            <Field.NumberInput
              value={value}
              locale="en"
              onValueChange={(next) => {
                changed(next);
                setValue(next);
              }}
            />
          </Field.Root>
        </form>
      );
    }
    const { rerender } = render(<Page go={false} />);
    type('7');
    act(() => rerender(<Page go />));
    expect(sent).toEqual(['7']);
    expect(changed).toHaveBeenCalledWith(7);
    expect(input().value).toBe('7');
    expect(error).not.toHaveBeenCalled();
  });
});

describe('Field.NumberInput in a form that validates natively', () => {
  function Page({ initial, max, onSubmit }: { initial: number | null; max?: number; onSubmit: (value: string | null) => void }) {
    const [value, setValue] = useState<number | null>(initial);
    return (
      <form
        data-testid="form"
        onSubmit={(event) => {
          event.preventDefault();
          onSubmit(new FormData(event.currentTarget).get('quantity') as string | null);
        }}
      >
        <Field.Root aria-label="Quantity" name="quantity">
          <Field.NumberInput value={value} max={max} required locale="en" onValueChange={setValue} />
        </Field.Root>
      </form>
    );
  }
  const requestSubmit = () => act(() => (screen.getByTestId('form') as HTMLFormElement).requestSubmit());

  it('commits a readable text when the check finds the stale empty value invalid, and the next submit carries it', () => {
    const onSubmit = vi.fn();
    render(<Page initial={null} onSubmit={onSubmit} />);
    type('7');
    requestSubmit();
    expect(onSubmit).not.toHaveBeenCalled();
    expect(input().value).toBe('7');
    expect(valueInput().value).toBe('7');
    requestSubmit();
    expect(onSubmit).toHaveBeenCalledWith('7');
  });

  it('commits a readable text when the stale value is out of range', () => {
    const onSubmit = vi.fn();
    render(<Page initial={500} max={100} onSubmit={onSubmit} />);
    type('50');
    requestSubmit();
    expect(onSubmit).not.toHaveBeenCalled();
    expect(valueInput().value).toBe('50');
    requestSubmit();
    expect(onSubmit).toHaveBeenCalledWith('50');
  });

  it('leaves a text that is no number as it is', () => {
    render(<Page initial={null} onSubmit={() => undefined} />);
    type('abc');
    requestSubmit();
    expect(input().value).toBe('abc');
    expect(valueInput().value).toBe('');
  });
});
