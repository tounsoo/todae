// What one more copy of a part adds to the page: the observers and page-wide
// listeners it shares with every other copy, and the layout reads it batches.
// Each test renders a few copies and many, and expects the same count.
import { act, cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Button, Checkbox, Disclosure, Field, Toolbar } from '../index.js';
import { shownDecimals } from './numberText.js';

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

// Counts the MutationObservers built while `run` renders.
function mutationObserversBuilt(run: () => void): number {
  let built = 0;
  const Real = MutationObserver;
  vi.stubGlobal(
    'MutationObserver',
    class extends Real {
      constructor(callback: MutationCallback) {
        super(callback);
        built++;
      }
    },
  );
  run();
  vi.unstubAllGlobals();
  return built;
}

function listenersAdded(target: EventTarget, type: string, run: () => void): number {
  const add = vi.spyOn(target, 'addEventListener');
  run();
  const count = add.mock.calls.filter(([own]) => own === type).length;
  add.mockRestore();
  return count;
}

function NumberInputs({ count }: { count: number }) {
  return (
    <form>
      {Array.from({ length: count }, (_, index) => (
        <Field.Root key={index} aria-label={`Amount ${index}`}>
          <Field.Decrement />
          <Field.NumberInput value={1} onValueChange={() => undefined} />
          <Field.Increment />
        </Field.Root>
      ))}
    </form>
  );
}

describe('a page of many copies', () => {
  it('number inputs with step buttons share their MutationObservers and form listeners', () => {
    const few = mutationObserversBuilt(() => render(<NumberInputs count={2} />));
    cleanup();
    const many = mutationObserversBuilt(() => render(<NumberInputs count={40} />));
    expect(many).toBe(few);
    cleanup();
    expect(listenersAdded(document, 'reset', () => render(<NumberInputs count={40} />))).toBe(1);
    cleanup();
    expect(listenersAdded(document, 'submit', () => render(<NumberInputs count={40} />))).toBe(1);
  });

  it('checkboxes share one reset listener', () => {
    const boxes = (count: number) => (
      <form>
        {Array.from({ length: count }, (_, index) => (
          <Checkbox.Root key={index} name={`box-${index}`}>
            Box {index}
          </Checkbox.Root>
        ))}
      </form>
    );
    expect(listenersAdded(document, 'reset', () => render(boxes(50)))).toBe(1);
  });

  it('toolbars share one window keydown listener', () => {
    const bars = (count: number) =>
      Array.from({ length: count }, (_, index) => (
        <Toolbar.Root key={index} aria-label={`Row ${index}`}>
          <Button.Root>Edit</Button.Root>
        </Toolbar.Root>
      ));
    expect(listenersAdded(window, 'keydown', () => render(<>{bars(30)}</>))).toBe(1);
  });

  it('disclosures share their MutationObserver', () => {
    const list = (count: number) =>
      Array.from({ length: count }, (_, index) => (
        <Disclosure.Root key={index}>
          <Disclosure.Summary>Question {index}</Disclosure.Summary>
          Answer
        </Disclosure.Root>
      ));
    const few = mutationObserversBuilt(() => render(<>{list(2)}</>));
    cleanup();
    expect(mutationObserversBuilt(() => render(<>{list(40)}</>))).toBe(few);
  });

  it('unrelated changes to the page cost the number inputs no label lookups', async () => {
    render(
      <>
        {Array.from({ length: 30 }, (_, index) => (
          <Field.Root key={index} aria-labelledby={`amount-${index}`}>
            <span id={`amount-${index}`}>Amount {index}</span>
            <Field.NumberInput value={1} onValueChange={() => undefined} />
            <Field.Increment />
          </Field.Root>
        ))}
      </>,
    );
    const contains = vi.spyOn(Node.prototype, 'contains');
    const host = document.body.appendChild(document.createElement('div'));
    await act(async () => {
      for (let i = 0; i < 100; i++) host.appendChild(document.createElement('p')).textContent = `row ${i}`;
    });
    // Every record is checked by walking up from its target, not against each input.
    expect(contains.mock.calls.length).toBeLessThan(30);
    // And the label is still followed.
    expect(document.querySelector('[role="spinbutton"]')?.getAttribute('aria-labelledby')).toBe('amount-0');
    host.remove();
  });
});

describe('a highlighted textarea', () => {
  it('reads every textarea style before it writes any layer, and once per mount', async () => {
    const events: (CSSStyleDeclaration | 'read')[] = [];
    const read = window.getComputedStyle.bind(window);
    vi.spyOn(window, 'getComputedStyle').mockImplementation((element, pseudo) => {
      if (element instanceof HTMLTextAreaElement) events.push('read');
      return read(element, pseudo);
    });
    const set = CSSStyleDeclaration.prototype.setProperty;
    vi.spyOn(CSSStyleDeclaration.prototype, 'setProperty').mockImplementation(function (this: CSSStyleDeclaration, ...args) {
      events.push(this);
      return set.apply(this, args);
    });
    const { container } = await act(async () =>
      render(
        <>
          {Array.from({ length: 5 }, (_, index) => (
            <Field.Root key={index} aria-label={`Message ${index}`}>
              <Field.Textarea value="hi @ada" onChange={() => undefined} highlights={[{ start: 3, end: 7 }]} />
            </Field.Root>
          ))}
        </>,
      ),
    );
    const layers = new Set([...container.querySelectorAll<HTMLElement>('[aria-hidden="true"][translate="no"]')].map((layer) => layer.style));
    expect(layers.size).toBe(5);
    // Only the layers' own style writes, apart from the browser's computed styles.
    const order = events.filter((event) => event === 'read' || layers.has(event)).map((event) => (event === 'read' ? 'read' : 'write'));
    expect(order.filter((event) => event === 'read')).toHaveLength(5);
    // The five reads, then the writes, with no read after a write.
    expect(order.indexOf('write')).toBe(5);
    expect(order.lastIndexOf('read')).toBe(4);
  });
});

describe('shownDecimals', () => {
  it('asks Intl for the resolved options once per format', () => {
    const resolved = vi.spyOn(Intl.NumberFormat.prototype, 'resolvedOptions');
    const options = { locale: 'de', formatOptions: { maximumFractionDigits: 2 } };
    for (let i = 0; i < 10; i++) expect(shownDecimals(options)).toBe(2);
    expect(shownDecimals({ locale: 'de', formatOptions: { maximumFractionDigits: 2 } })).toBe(2);
    expect(resolved).toHaveBeenCalledTimes(1);
    expect(shownDecimals({ locale: 'de', formatOptions: { style: 'percent', maximumFractionDigits: 1 } })).toBe(3);
  });
});
