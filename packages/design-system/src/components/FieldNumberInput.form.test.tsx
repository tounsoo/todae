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
  it('sends the number the product accepted when an effect submits the form, with no React warning', () => {
    const error = vi.spyOn(console, 'error');
    const sent: (string | null)[] = [];
    const told: (number | null)[] = [];
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
                told.push(next);
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
    expect(told).toEqual([7]);
    expect(error).not.toHaveBeenCalled();
  });
});

describe('Field.NumberInput and a submit that a commit starts', () => {
  // A filter form that submits on each change.
  function Auto({ log, sent, onBlur }: { log: (number | null)[]; sent: (string | null)[]; onBlur?: boolean }) {
    const [value, setValue] = useState<number | null>(5);
    const form = useRef<HTMLFormElement>(null);
    return (
      <form
        ref={form}
        noValidate
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
              log.push(next);
              setValue(next);
              if (!onBlur) form.current?.requestSubmit();
            }}
            onBlur={onBlur ? () => form.current?.requestSubmit() : undefined}
          />
        </Field.Root>
      </form>
    );
  }

  it('commits once and sends once when onValueChange submits, after a step from a draft', () => {
    const log: (number | null)[] = [];
    const sent: (string | null)[] = [];
    render(<Auto log={log} sent={sent} />);
    type('7');
    act(() => key('ArrowUp'));
    expect(log).toEqual([8]);
    expect(input().value).toBe('8');
    expect(sent).toEqual(['8']);
  });

  it('commits once and sends once when onValueChange submits on blur', () => {
    const log: (number | null)[] = [];
    const sent: (string | null)[] = [];
    render(<Auto log={log} sent={sent} />);
    input().focus();
    type('7');
    act(() => input().blur());
    expect(log).toEqual([7]);
    expect(sent).toEqual(['7']);
  });

  it('commits once and sends once when an onBlur prop submits', () => {
    const log: (number | null)[] = [];
    const sent: (string | null)[] = [];
    render(<Auto log={log} sent={sent} onBlur />);
    input().focus();
    type('7');
    act(() => input().blur());
    expect(log).toEqual([7]);
    expect(sent).toEqual(['7']);
  });
});

describe('Field.NumberInput and a form that is not there at mount', () => {
  it('commits a typed text on a submit of a form that mounts after the input, named by the form attribute', async () => {
    const sent: (string | null)[] = [];
    const told: (number | null)[] = [];
    let show = () => {};
    function Page() {
      const [value, setValue] = useState<number | null>(50);
      const [on, setOn] = useState(false);
      show = () => setOn(true);
      return (
        <>
          <Field.Root name="quantity" aria-label="Quantity">
            <Field.NumberInput
              value={value}
              form="late"
              locale="en"
              onValueChange={(next) => {
                told.push(next);
                setValue(next);
              }}
            />
          </Field.Root>
          {on ? (
            <form
              id="late"
              onSubmit={(event) => {
                event.preventDefault();
                sent.push(new FormData(event.currentTarget).get('quantity') as string | null);
              }}
            />
          ) : null}
        </>
      );
    }
    render(<Page />);
    await act(async () => show());
    type('70');
    act(() => (document.getElementById('late') as HTMLFormElement).requestSubmit());
    expect(sent).toEqual(['70']);
    expect(told).toEqual([70]);
  });
});

describe('Field.NumberInput with two drafts in one form', () => {
  it('commits both before the one send', () => {
    const sent: Record<string, FormDataEntryValue>[] = [];
    const told: string[] = [];
    function Page() {
      const [a, setA] = useState<number | null>(1);
      const [b, setB] = useState<number | null>(2);
      return (
        <form
          data-testid="form"
          onSubmit={(event) => {
            event.preventDefault();
            sent.push(Object.fromEntries(new FormData(event.currentTarget)));
          }}
        >
          <Field.Root aria-label="A" name="a">
            <Field.NumberInput value={a} locale="en" onValueChange={(next) => (told.push(`a${next}`), setA(next))} />
          </Field.Root>
          <Field.Root aria-label="B" name="b">
            <Field.NumberInput value={b} locale="en" onValueChange={(next) => (told.push(`b${next}`), setB(next))} />
          </Field.Root>
        </form>
      );
    }
    render(<Page />);
    const [first, second] = screen.getAllByRole('spinbutton') as HTMLInputElement[];
    fireEvent.change(first!, { target: { value: '8' } });
    fireEvent.change(second!, { target: { value: '9' } });
    act(() => (screen.getByTestId('form') as HTMLFormElement).requestSubmit());
    expect(sent).toEqual([{ a: '8', b: '9' }]);
    expect(told.sort()).toEqual(['a8', 'b9']);
  });
});

describe('Field.NumberInput in a form that validates natively', () => {
  function Page({
    initial,
    max,
    adopt = true,
    onSubmit,
    onCommit,
  }: {
    initial: number | null;
    max?: number;
    adopt?: boolean;
    onSubmit: (value: string | null) => void;
    onCommit?: (value: number | null) => void;
  }) {
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
          <Field.NumberInput
            value={value}
            max={max}
            required
            locale="en"
            onValueChange={(next) => {
              onCommit?.(next);
              if (adopt) setValue(next);
            }}
          />
        </Field.Root>
        <button type="submit">Send</button>
        <button type="submit" formNoValidate>
          Send anyway
        </button>
      </form>
    );
  }
  const form = () => screen.getByTestId('form') as HTMLFormElement;
  const requestSubmit = (submitter?: HTMLElement) => act(() => form().requestSubmit(submitter));

  it('sends the number the product accepted, not the one it refused', () => {
    const onSubmit = vi.fn();
    render(<Page initial={50} max={100} adopt={false} onSubmit={onSubmit} />);
    type('70');
    requestSubmit();
    expect(onSubmit).toHaveBeenCalledWith('50');
    expect(input().value).toBe('50');
  });

  it('sends the typed number from a submit with no blur, committing it once', () => {
    const onSubmit = vi.fn();
    const onCommit = vi.fn();
    render(<Page initial={3} onSubmit={onSubmit} onCommit={onCommit} />);
    type('7');
    requestSubmit();
    expect(onSubmit).toHaveBeenCalledWith('7');
    expect(onCommit.mock.calls).toEqual([[7]]);
  });

  it('does not send a cleared required text as empty, and reports it', () => {
    const onSubmit = vi.fn();
    render(<Page initial={7} onSubmit={onSubmit} />);
    const invalid = vi.fn();
    valueInput().addEventListener('invalid', invalid);
    type('');
    requestSubmit();
    expect(onSubmit).not.toHaveBeenCalled();
    expect(invalid).toHaveBeenCalled();
    expect(input().value).toBe('');
  });

  it('documented limit: a requestSubmit with focus in the text is blocked on the last committed number when that is invalid, and nothing is committed', () => {
    const onSubmit = vi.fn();
    const onCommit = vi.fn();
    render(<Page initial={null} onSubmit={onSubmit} onCommit={onCommit} />);
    type('7');
    requestSubmit();
    expect(onSubmit).not.toHaveBeenCalled();
    expect(onCommit).not.toHaveBeenCalled();
    expect(input().value).toBe('7');
  });

  it('is not committed by a validity check from product code', () => {
    const onCommit = vi.fn();
    render(<Page initial={null} onSubmit={() => undefined} onCommit={onCommit} />);
    input().focus();
    type('5');
    form().checkValidity();
    form().reportValidity();
    expect(onCommit).not.toHaveBeenCalled();
    expect(input().value).toBe('5');
  });

  it('leaves a text that is no number as it is', () => {
    render(<Page initial={null} onSubmit={() => undefined} />);
    type('abc');
    requestSubmit();
    expect(input().value).toBe('abc');
    expect(valueInput().value).toBe('');
  });
});

describe('Field.NumberInput in Form.Root and a submit', () => {
  it('commits a cleared required text once, and the form blocks it', async () => {
    const onSubmit = vi.fn((event: React.FormEvent) => event.preventDefault());
    const onCommit = vi.fn();
    function Page() {
      const [value, setValue] = useState<number | null>(5);
      return (
        <Form.Root data-testid="form" onSubmit={onSubmit}>
          <Field.Group>
            <Field.Root name="quantity" aria-label="Quantity">
              <Field.NumberInput
                value={value}
                required
                onValueChange={(next) => {
                  onCommit(next);
                  setValue(next);
                }}
              />
            </Field.Root>
            <ErrorMessage.Root />
          </Field.Group>
        </Form.Root>
      );
    }
    await mount(<Page />);
    await act(async () => type(''));
    await act(async () => {
      (screen.getByTestId('form') as HTMLFormElement).requestSubmit();
    });
    expect(onCommit.mock.calls).toEqual([[null]]);
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('flags a half-typed text the submit could not read, and blocks the submit', async () => {
    const onSubmit = vi.fn((event: React.FormEvent) => event.preventDefault());
    function Page() {
      const [value, setValue] = useState<number | null>(null);
      return (
        <Form.Root data-testid="form" onSubmit={onSubmit}>
          <Field.Root name="quantity" aria-label="Amount">
            <Field.NumberInput value={value} locale="de" onValueChange={setValue} />
          </Field.Root>
        </Form.Root>
      );
    }
    await mount(<Page />);
    await act(async () => type('1.'));
    expect(input().getAttribute('aria-invalid')).toBeNull();
    await act(async () => {
      (screen.getByTestId('form') as HTMLFormElement).requestSubmit();
    });
    expect(onSubmit).not.toHaveBeenCalled();
    expect(input().getAttribute('aria-invalid')).toBe('true');
  });
});

describe('an unreadable draft and a submitter that turns validation off', () => {
  it('is never sent as the old number: the submit is cancelled, the text kept and flagged', async () => {
    const sent: (string | null)[] = [];
    const told: (number | null)[] = [];
    function Page() {
      const [value, setValue] = useState<number | null>(5);
      return (
        <Form.Root
          onSubmit={(event) => {
            event.preventDefault();
            sent.push(new FormData(event.currentTarget).get('a') as string | null);
          }}
        >
          <Field.Root aria-label="A" name="a">
            <Field.NumberInput
              value={value}
              locale="en"
              onValueChange={(next) => {
                told.push(next);
                setValue(next);
              }}
            />
          </Field.Root>
          <button type="submit" formNoValidate>
            Skip check
          </button>
        </Form.Root>
      );
    }
    render(<Page />);
    type('7,,');
    fireEvent.click(screen.getByRole('button', { name: 'Skip check' }));
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    expect(sent).toEqual([]);
    expect(told).toEqual([]);
    expect(input().value).toBe('7,,');
    expect(input().getAttribute('aria-invalid')).toBe('true');
  });
});
