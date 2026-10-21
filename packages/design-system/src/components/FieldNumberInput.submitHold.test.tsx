import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { Activity, Suspense, startTransition, use, useLayoutEffect, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
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
  it('sends the new number when onValueChange submits after ArrowUp', async () => {
    const log = newLog();
    render(<Auto log={log} />);
    await act(async () => key('ArrowUp'));
    expect(log.told).toEqual([6]);
    expect(log.sent).toEqual(['6']);
    expect(input().value).toBe('6');
  });

  it('sends the new number when onValueChange submits after PageUp', async () => {
    const log = newLog();
    render(<Auto log={log} largeStep={10} />);
    await act(async () => key('PageUp'));
    expect(log.told).toEqual([15]);
    expect(log.sent).toEqual(['15']);
  });

  it('sends the new number when onValueChange submits after an Increment click', async () => {
    const log = newLog();
    render(<Auto log={log} />);
    await act(async () => {
      fireEvent.click(button('Increase'), { detail: 0 });
    });
    expect(log.told).toEqual([6]);
    expect(log.sent).toEqual(['6']);
  });

  it('sends each number once for each tick of a held button', async () => {
    vi.useFakeTimers();
    const log = newLog();
    render(<Auto log={log} start={0} />);
    await act(async () => {
      fireEvent.pointerDown(button('Increase'), { button: 0 });
    });
    for (const ms of [400, 60, 60]) {
      await act(async () => {
        vi.advanceTimersByTime(ms);
      });
    }
    await act(async () => {
      fireEvent.pointerUp(button('Increase'));
    });
    expect(log.told).toEqual([1, 2, 3]);
    expect(log.sent).toEqual(['1', '2', '3']);
  });

  it('does not hold the next submit after a step the product refused', async () => {
    const log = newLog();
    render(<Auto log={log} accept={false} autoSubmit={false} />);
    await act(async () => key('ArrowUp'));
    expect(log.told).toEqual([6]);
    expect(input().value).toBe('5');
    await act(async () => form().requestSubmit());
    expect(log.sent).toEqual(['5']);
    await act(async () => form().requestSubmit());
    expect(log.sent).toEqual(['5', '5']);
  });

  it('does not hold a refused step that auto-submits, and does not swallow the next submit', async () => {
    const log = newLog();
    render(<Auto log={log} accept={false} />);
    await act(async () => key('ArrowUp'));
    expect(log.sent).toEqual(['5']);
    await act(async () => form().requestSubmit());
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
  it('commits the typed text on a submit, and sends it once', async () => {
    const host = document.createElement('div');
    document.body.appendChild(host);
    const container = document.createElement('div');
    host.attachShadow({ mode: 'open' }).appendChild(container);
    const log = newLog();
    const { unmount } = render(<Auto log={log} autoSubmit={false} />, { container });
    const field = container.querySelector<HTMLInputElement>('[role=spinbutton]')!;
    fireEvent.change(field, { target: { value: '9' } });
    await act(async () => container.querySelector('form')!.requestSubmit());
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
  function Filter({ sent }: { sent: (string | null)[] }) {
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
        <button type="submit">Go</button>
      </form>
    );
  }

  it('sends the committed number once its render is in the page, not when the Activity shows', async () => {
    const sent: (string | null)[] = [];
    render(<Filter sent={sent} />);
    await act(async () => {
      key('ArrowUp');
    });
    await act(async () => {});
    expect(sent).toEqual(['6']);
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Show' }));
    });
    await act(async () => {});
    expect(sent).toEqual(['6']);
  });

  it('sends the form even when the Activity never shows again', async () => {
    const sent: (string | null)[] = [];
    const { unmount } = render(<Filter sent={sent} />);
    await act(async () => {
      key('ArrowUp');
    });
    await act(async () => {});
    unmount();
    expect(sent).toEqual(['6']);
  });
});

describe('a Suspense boundary that hides the input, and a submit that comes meanwhile', () => {
  // The product answers the commit by suspending, so the boundary keeps the old page, and the held submit waits.
  function Gate({ promise }: { promise: Promise<void> }) {
    use(promise);
    return null;
  }

  function Hidden({ sent, removable = false }: { sent: (string | null)[]; removable?: boolean }) {
    const [value, setValue] = useState<number | null>(5);
    const [gate, setGate] = useState<Promise<void> | null>(null);
    const [shown, setShown] = useState(true);
    return (
      <form
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
          sent.push(new FormData(event.currentTarget).get('q') as string | null);
        }}
      >
        <Suspense fallback={<p>loading</p>}>
          {shown ? (
            <Field.Root aria-label="Q" name="q">
              <Field.NumberInput
                value={value}
                locale="en"
                onValueChange={(next) => {
                  setValue(next);
                  setGate(new Promise<void>((resolve) => (release = resolve)));
                }}
              />
            </Field.Root>
          ) : null}
          {gate ? <Gate promise={gate} /> : null}
        </Suspense>
        <button type="submit">Go</button>
        {removable ? (
          <button type="button" onClick={() => setShown(false)}>
            Remove
          </button>
        ) : null}
      </form>
    );
  }
  let release = () => {};

  it('sends the held submit once the input is removed before it shows', async () => {
    const sent: (string | null)[] = [];
    render(<Hidden sent={sent} removable />);
    type('7');
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Go' }));
    });
    expect(sent).toEqual([]);
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Remove' }));
    });
    await act(async () => {
      release();
      await new Promise((resolve) => setTimeout(resolve, 20));
    });
    expect(screen.queryByRole('spinbutton')).toBeNull();
    expect(sent).toEqual([null]);
  });

  it('folds another submit of the form into the held one, so the form sends the committed number once', async () => {
    const sent: (string | null)[] = [];
    render(<Hidden sent={sent} />);
    type('7');
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Go' }));
    });
    expect(sent).toEqual([]);
    // The page still shows the old render, and this submit joins the held one instead of sending it.
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Go' }));
    });
    expect(sent).toEqual([]);
    await act(async () => {
      release();
      await new Promise((resolve) => setTimeout(resolve, 20));
    });
    expect(sent).toEqual(['7']);
    expect(input().value).toBe('7');
  });
});

describe('a held submit while the render of its commit is pending', () => {
  // The render that answers the commit suspends and never resolves, so the boundary keeps the old page.
  const never = new Promise<void>(() => {});
  function Gate({ on }: { on: boolean }) {
    if (on) use(never);
    return null;
  }

  it('waits: every later submit of the form is folded and nothing is sent until the render arrives', async () => {
    const sent: (string | null)[] = [];
    function Page() {
      const [value, setValue] = useState<number | null>(5);
      return (
        <form
          noValidate
          data-testid="form"
          onSubmit={(event) => {
            event.preventDefault();
            sent.push(new FormData(event.currentTarget).get('q') as string | null);
          }}
        >
          <Suspense fallback={<p>loading</p>}>
            <Gate on={value === 6} />
            <Field.Root aria-label="Q" name="q">
              <Field.NumberInput value={value} locale="en" onValueChange={setValue} />
            </Field.Root>
          </Suspense>
          <button type="submit">Go</button>
        </form>
      );
    }
    render(<Page />);
    type('6');
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Go' }));
    });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Go' }));
      (screen.getByTestId('form') as HTMLFormElement).requestSubmit();
      await new Promise((resolve) => setTimeout(resolve, 50));
    });
    expect(sent).toEqual([]);
  });
});

describe('a held submit is sent after the commit, from one watcher', () => {
  it('lets a product read the DOM, refs and layout effects of the whole layout commit in its onSubmit', async () => {
    const seen: { value: string | null; note: string | null; mirrored: number | null }[] = [];
    function Page() {
      const [value, setValue] = useState<number | null>(5);
      const form = useRef<HTMLFormElement>(null);
      const note = useRef<HTMLInputElement>(null);
      const mirrored = useRef(value);
      useLayoutEffect(() => {
        mirrored.current = value;
      });
      return (
        <form
          ref={form}
          noValidate
          onSubmit={(event) => {
            event.preventDefault();
            seen.push({ value: new FormData(event.currentTarget).get('q') as string | null, note: note.current?.name ?? null, mirrored: mirrored.current });
          }}
        >
          <Field.Root aria-label="Q" name="q">
            <Field.NumberInput
              value={value}
              locale="en"
              onValueChange={(next) => {
                setValue(next);
                form.current?.requestSubmit();
              }}
            />
          </Field.Root>
          {value !== null && value > 5 ? <input ref={note} name="note" defaultValue="x" /> : null}
        </form>
      );
    }
    render(<Page />);
    await act(async () => key('ArrowUp'));
    expect(seen).toEqual([{ value: '6', note: 'note', mirrored: 6 }]);
  });

  it('lets a product call flushSync in its onSubmit', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    let banner: string | null = null;
    const sent: (string | null)[] = [];
    function Page() {
      const [value, setValue] = useState<number | null>(5);
      const [pending, setPending] = useState(false);
      const form = useRef<HTMLFormElement>(null);
      return (
        <form
          ref={form}
          noValidate
          onSubmit={(event) => {
            event.preventDefault();
            flushSync(() => setPending(true));
            banner = document.querySelector('[data-banner]')?.textContent ?? null;
            sent.push(new FormData(event.currentTarget).get('q') as string | null);
          }}
        >
          {pending ? <p data-banner>sending</p> : null}
          <Field.Root aria-label="Q" name="q">
            <Field.NumberInput
              value={value}
              locale="en"
              onValueChange={(next) => {
                setValue(next);
                form.current?.requestSubmit();
              }}
            />
          </Field.Root>
        </form>
      );
    }
    render(<Page />);
    await act(async () => key('ArrowUp'));
    expect(error).not.toHaveBeenCalled();
    expect(banner).toBe('sending');
    expect(sent).toEqual(['6']);
  });

  it('folds a second submit in the same task into the held one, so the form sends once', async () => {
    const log = newLog();
    render(<Auto log={log} autoSubmit={false} />);
    type('7');
    await act(async () => {
      form().requestSubmit();
      form().requestSubmit();
    });
    expect(log.told).toEqual([7]);
    expect(log.sent).toEqual(['7']);
  });

  it('keeps the newest submitter of the folded submits', async () => {
    const submitters: (string | null)[] = [];
    function Page() {
      const [value, setValue] = useState<number | null>(5);
      return (
        <form
          data-testid="form"
          noValidate
          onSubmit={(event) => {
            event.preventDefault();
            submitters.push((event.nativeEvent as SubmitEvent).submitter?.textContent ?? null);
          }}
        >
          <Field.Root aria-label="Q" name="q">
            <Field.NumberInput value={value} locale="en" onValueChange={setValue} />
          </Field.Root>
          <button type="submit">First</button>
          <button type="submit">Second</button>
        </form>
      );
    }
    render(<Page />);
    type('7');
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'First' }));
      fireEvent.click(screen.getByRole('button', { name: 'Second' }));
    });
    expect(submitters).toEqual(['Second']);
  });

  it('sends once when an Activity hides the input on the step that submits and another submit lands in the same task', async () => {
    const sent: (string | null)[] = [];
    function Page() {
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
          <button type="submit">Go</button>
        </form>
      );
    }
    render(<Page />);
    // Synchronous acts: the hide and the second submit land before any microtask.
    act(() => key('ArrowUp'));
    act(() => {
      fireEvent.click(screen.getByRole('button', { name: 'Go' }));
    });
    await act(async () => {});
    await act(async () => {});
    expect(sent).toEqual(['6']);
  });
});
