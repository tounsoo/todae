import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { Activity, Suspense, startTransition, use, useRef, useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Field } from '../index.js';
import { button, input, key, type } from '../test/number.js';
import { resetWarnOnce } from './warnOnce.js';

afterEach(() => {
  cleanup();
  resetWarnOnce();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

type Log = { told: (number | null)[]; sent: (string | null)[] };
const newLog = (): Log => ({ told: [], sent: [] });

// A filter form that submits on each change. `accept` false is a product that refuses the number and changes nothing.
function Auto({
  log,
  accept = true,
  autoSubmit = true,
  transition = false,
  unmountAt,
  start = 5,
  step,
  largeStep,
}: {
  log: Log;
  accept?: boolean;
  autoSubmit?: boolean;
  transition?: boolean;
  unmountAt?: number;
  start?: number;
  step?: number;
  largeStep?: number;
}) {
  const [value, setValue] = useState<number | null>(start);
  const form = useRef<HTMLFormElement>(null);
  return (
    <form
      ref={form}
      data-testid="form"
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        log.sent.push(new FormData(event.currentTarget).get('quantity') as string | null);
      }}
    >
      {unmountAt !== undefined && value === unmountAt ? (
        <p>gone</p>
      ) : (
        <Field.Root aria-label="Quantity" name="quantity">
          <Field.Decrement />
          <Field.NumberInput
            value={value}
            locale="en"
            step={step}
            largeStep={largeStep}
            onValueChange={(next) => {
              log.told.push(next);
              if (accept) {
                if (transition) startTransition(() => setValue(next));
                else setValue(next);
              }
              if (autoSubmit) form.current?.requestSubmit();
            }}
          />
          <Field.Increment />
        </Field.Root>
      )}
      <button type="submit">Send</button>
    </form>
  );
}

const form = () => screen.getByTestId('form') as HTMLFormElement;

describe('a submit and a commit that has no draft', () => {
  it('sends the new number when onValueChange submits after ArrowUp', () => {
    const log = newLog();
    render(<Auto log={log} />);
    act(() => key('ArrowUp'));
    expect(log.told).toEqual([6]);
    expect(log.sent).toEqual(['6']);
    expect(input().value).toBe('6');
  });

  it('sends the new number when onValueChange submits after PageUp', () => {
    const log = newLog();
    render(<Auto log={log} largeStep={10} />);
    act(() => key('PageUp'));
    expect(log.told).toEqual([15]);
    expect(log.sent).toEqual(['15']);
  });

  it('sends the new number when onValueChange submits after an Increment click', () => {
    const log = newLog();
    render(<Auto log={log} />);
    act(() => {
      fireEvent.click(button('Increase'), { detail: 0 });
    });
    expect(log.told).toEqual([6]);
    expect(log.sent).toEqual(['6']);
  });

  it('sends each number once for each tick of a held button', () => {
    vi.useFakeTimers();
    const log = newLog();
    render(<Auto log={log} start={0} />);
    act(() => {
      fireEvent.pointerDown(button('Increase'), { button: 0 });
    });
    for (const ms of [400, 60, 60]) {
      act(() => {
        vi.advanceTimersByTime(ms);
      });
    }
    act(() => {
      fireEvent.pointerUp(button('Increase'));
    });
    expect(log.told).toEqual([1, 2, 3]);
    expect(log.sent).toEqual(['1', '2', '3']);
  });

  it('does not hold the next submit after a step the product refused', () => {
    const log = newLog();
    render(<Auto log={log} accept={false} autoSubmit={false} />);
    act(() => key('ArrowUp'));
    expect(log.told).toEqual([6]);
    expect(input().value).toBe('5');
    act(() => form().requestSubmit());
    expect(log.sent).toEqual(['5']);
    act(() => form().requestSubmit());
    expect(log.sent).toEqual(['5', '5']);
  });

  it('does not hold a refused step that auto-submits, and does not swallow the next submit', () => {
    const log = newLog();
    render(<Auto log={log} accept={false} />);
    act(() => key('ArrowUp'));
    expect(log.sent).toEqual(['5']);
    act(() => form().requestSubmit());
    expect(log.sent).toEqual(['5', '5']);
  });
});

describe('a held submit and a commit that takes the input out of the page', () => {
  it('sends the form when the number the commit gave swaps the input out', async () => {
    const log = newLog();
    render(<Auto log={log} autoSubmit={false} unmountAt={7} />);
    type('7');
    await act(async () => {
      form().requestSubmit();
    });
    expect(screen.queryByRole('spinbutton')).toBeNull();
    expect(log.told).toEqual([7]);
    expect(log.sent).toEqual([null]);
  });

  it('sends the form when an auto-submit in a step comes with the swap', async () => {
    const log = newLog();
    render(<Auto log={log} unmountAt={6} />);
    await act(async () => {
      key('ArrowUp');
    });
    expect(screen.queryByRole('spinbutton')).toBeNull();
    expect(log.sent).toEqual([null]);
  });
});

describe('a form in a shadow root', () => {
  it('commits the typed text on a submit, and sends it once', () => {
    const host = document.createElement('div');
    document.body.appendChild(host);
    const container = document.createElement('div');
    host.attachShadow({ mode: 'open' }).appendChild(container);
    const log = newLog();
    const { unmount } = render(<Auto log={log} autoSubmit={false} />, { container });
    const field = container.querySelector<HTMLInputElement>('[role=spinbutton]')!;
    fireEvent.change(field, { target: { value: '9' } });
    act(() => container.querySelector('form')!.requestSubmit());
    expect(log.told).toEqual([9]);
    expect(log.sent).toEqual(['9']);
    unmount();
    host.remove();
  });
});

describe('the documented limit: the product sets its value in a transition', () => {
  // The held submit goes out after the render that answers the commit, which a transition does not give.
  it('sends the number the form held before the transition lands', async () => {
    const log = newLog();
    render(<Auto log={log} transition />);
    input().focus();
    type('7');
    await act(async () => {
      input().blur();
    });
    expect(log.told).toEqual([7]);
    expect(log.sent).toEqual(['5']);
    expect(input().value).toBe('7');
  });
});

describe('a Suspense boundary that hides the input while the form holds a submit', () => {
  it('sends the committed number once, when the boundary shows it again', async () => {
    let release!: () => void;
    const gate = new Promise<void>((resolve) => (release = resolve));
    function Results({ value }: { value: number | null }) {
      if (value === 6) use(gate);
      return <p>results for {value}</p>;
    }
    const sent: (string | null)[] = [];
    const told: (number | null)[] = [];
    function Filter() {
      const [value, setValue] = useState<number | null>(5);
      const form = useRef<HTMLFormElement>(null);
      return (
        <form
          ref={form}
          noValidate
          onSubmit={(event) => {
            event.preventDefault();
            sent.push(new FormData(event.currentTarget).get('q') as string | null);
          }}
        >
          <Suspense fallback={<p>loading</p>}>
            <Field.Root aria-label="Q" name="q">
              <Field.NumberInput
                value={value}
                locale="en"
                onValueChange={(next) => {
                  told.push(next);
                  setValue(next);
                  form.current?.requestSubmit();
                }}
              />
            </Field.Root>
            <Results value={value} />
          </Suspense>
        </form>
      );
    }
    render(<Filter />);
    await act(async () => {
      key('ArrowUp');
    });
    expect(told).toEqual([6]);
    expect(sent).toEqual([]);
    await act(async () => {
      release();
      await gate;
    });
    await act(async () => {});
    expect(sent).toEqual(['6']);
    expect(screen.getByText('results for 6')).toBeTruthy();
  });
});

describe('an Activity that hides the input while the form holds a submit', () => {
  it('sends the committed number once, when the Activity shows again', async () => {
    const sent: (string | null)[] = [];
    function Filter() {
      const [value, setValue] = useState<number | null>(5);
      const [hidden, setHidden] = useState(false);
      const form = useRef<HTMLFormElement>(null);
      return (
        <form
          ref={form}
          noValidate
          onSubmit={(event) => {
            event.preventDefault();
            sent.push(new FormData(event.currentTarget).get('q') as string | null);
          }}
        >
          <Activity mode={hidden ? 'hidden' : 'visible'}>
            <Field.Root aria-label="Q" name="q">
              <Field.NumberInput
                value={value}
                locale="en"
                onValueChange={(next) => {
                  setValue(next);
                  setHidden(true);
                  form.current?.requestSubmit();
                }}
              />
            </Field.Root>
          </Activity>
          <button type="button" onClick={() => setHidden(false)}>
            Show
          </button>
        </form>
      );
    }
    render(<Filter />);
    await act(async () => {
      key('ArrowUp');
    });
    await act(async () => {});
    expect(sent).toEqual([]);
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Show' }));
    });
    await act(async () => {});
    expect(sent).toEqual(['6']);
  });
});
