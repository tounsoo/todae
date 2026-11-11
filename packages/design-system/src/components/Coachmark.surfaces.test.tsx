import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { useRef, useState, type RefObject } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { usePopover } from '../hooks/usePopover.js';
import { useCombobox } from '../hooks/useCombobox.js';
import { Field } from './Field.js';
import { OptionList } from './OptionList.js';
import { Coachmark } from './Coachmark.js';
import { Popover } from './Popover.js';

afterEach(cleanup);

describe('Coachmark whose target sits in a shadow root inside the surface it controls into', () => {
  it('keeps the rest of that surface inert', async () => {
    function Tour() {
      const popover = usePopover({ open: true, onOpenChange: () => {} });
      const targetRef = useRef<HTMLElement | null>(null) as RefObject<HTMLElement | null>;
      const [tour, setTour] = useState(false);
      return (
        <>
          <button type="button" {...popover.getTriggerProps()}>
            Panel
          </button>
          <Popover.Root {...popover.getPopoverProps()} arrows={false} role="dialog" aria-label="Panel">
            {/* A web component whose own button opens the region beside it. */}
            <span
              ref={(host) => {
                if (!host || host.shadowRoot) return;
                const button = host.attachShadow({ mode: 'open' }).appendChild(document.createElement('button'));
                button.textContent = 'Expand';
                button.setAttribute('aria-controls', 'region');
                targetRef.current = button;
              }}
            />
            <div id="region">Details</div>
            <button type="button">Delete everything</button>
          </Popover.Root>
          <button type="button" onClick={() => setTour(true)}>
            Start tour
          </button>
          <Coachmark.Root targetRef={targetRef} open={tour} onOpenChange={() => setTour(false)} aria-label="Expand">
            <Coachmark.Title>Open the details</Coachmark.Title>
          </Coachmark.Root>
        </>
      );
    }
    render(<Tour />);
    await act(async () => {
      screen.getByText('Start tour').click();
    });
    await act(async () => {});
    // The target and what it controls stay usable; the popover's other content does not.
    expect(screen.getByText('Details').closest('[inert]')).toBeNull();
    expect(screen.getByText('Delete everything').closest('[inert]')).not.toBeNull();
  });
});

describe('Coachmark rendered inside the popover its target opens', () => {
  it('keeps the listbox usable', async () => {
    // A tip shown from inside the dropdown, pointing at the field that opened it.
    function Tip() {
      const cb = useCombobox({ options: [{ value: 'react', label: 'React' }], presentation: 'popover' });
      const input = cb.getInputProps();
      return (
        <>
          <Field.Root {...cb.getAnchorProps()} aria-label="Framework">
            <Field.TextInput {...input} />
          </Field.Root>
          <Popover.Root {...cb.getPopoverProps()}>
            <div>
              <OptionList.Root {...cb.getListboxProps()}>
                {cb.items.map((item) => (
                  <OptionList.Option key={item.id} {...cb.getOptionProps(item)} />
                ))}
              </OptionList.Root>
            </div>
            <Coachmark.Root targetRef={input.ref} defaultOpen aria-label="Tip">
              <Coachmark.Title>Type to filter</Coachmark.Title>
            </Coachmark.Root>
          </Popover.Root>
        </>
      );
    }
    render(<Tip />);
    fireEvent.focus(screen.getByRole('combobox'));
    await act(async () => {});
    await act(async () => {});
    expect(screen.getByRole('listbox', { hidden: true }).closest('[inert]')).toBeNull();
  });
});
