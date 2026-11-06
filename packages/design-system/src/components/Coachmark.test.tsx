import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { afterEach, describe, expect, expectTypeOf, it, vi } from 'vitest';
import * as api from '../index.js';
import { BottomSheet } from './BottomSheet.js';
import { Button } from './Button.js';
import { Coachmark, type CoachmarkCloseReason, type CoachmarkRootProps } from './Coachmark.js';
import { Dialog } from './Dialog.js';
import { Field } from './Field.js';
import { OptionList } from './OptionList.js';
import { Popover } from './Popover.js';
import { useCombobox } from '../hooks/useCombobox.js';
import { inertOutside } from '../overlay/inertOutside.js';
import { resetMatchMedia, setMatchMedia } from '../test/setup.js';

afterEach(() => {
  cleanup();
  resetMatchMedia();
});

function Harness({
  open: initial = true,
  onOpenChange,
  dismissOnBackdrop,
  children,
}: {
  open?: boolean;
  onOpenChange?: CoachmarkRootProps['onOpenChange'];
  dismissOnBackdrop?: boolean;
  children?: ReactNode;
}) {
  const target = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(initial);
  return (
    <>
      <main>
        <button type="button" data-testid="before">
          Before
        </button>
        <section>
          <button type="button" ref={target} onClick={() => setOpen(true)}>
            Export
          </button>
          <button type="button">Beside</button>
        </section>
      </main>
      <Coachmark.Root
        targetRef={target}
        open={open}
        dismissOnBackdrop={dismissOnBackdrop}
        onOpenChange={(next, reason) => {
          onOpenChange?.(next, reason);
          setOpen(next);
        }}
      >
        <Coachmark.Title>New: export</Coachmark.Title>
        <Coachmark.Description>Save the report as a file.</Coachmark.Description>
        <Coachmark.Footer>{children ?? <Coachmark.Close>Got it</Coachmark.Close>}</Coachmark.Footer>
      </Coachmark.Root>
    </>
  );
}

describe('Coachmark exports', () => {
  it('exports its parts and close reasons', () => {
    expect(api.Coachmark).toBe(Coachmark);
    expect(Object.keys(Coachmark)).toEqual(['Root', 'Title', 'Description', 'Footer', 'Close']);
    expectTypeOf<CoachmarkCloseReason>().toEqualTypeOf<'escape' | 'backdrop' | 'close-button'>();
    expectTypeOf<CoachmarkRootProps>().toHaveProperty('targetRef');
  });
});

describe('Coachmark', () => {
  it('opens a named, described dialog beside the target, with no aria-modal', () => {
    render(<Harness />);
    const popup = screen.getByRole('dialog', { name: 'New: export' });
    expect(document.getElementById(popup.getAttribute('aria-describedby')!)?.textContent).toBe('Save the report as a file.');
    expect(popup.hasAttribute('aria-modal')).toBe(false);
    expect(popup.hasAttribute('data-popover-open')).toBe(true);
    const target = screen.getByRole('button', { name: 'Export' });
    const name = target.style.getPropertyValue('anchor-name');
    expect(name).toMatch(/^--todae-coachmark-/);
    expect(popup.style.getPropertyValue('position-anchor')).toBe(name);
  });

  it('mounts its content on the first open, and keeps its name and description after it closes', async () => {
    render(<Harness open={false} />);
    const popup = document.querySelector<HTMLElement>('[popover="manual"][role="dialog"]')!;
    expect(screen.queryByText('Save the report as a file.')).toBeNull();
    expect(popup.textContent).toBe('');
    // The name and description are on the popup as focus moves into it, though the parts mount in that commit.
    const atFocus: (string | null)[] = [];
    const onFocusIn = () => atFocus.push(popup.getAttribute('aria-labelledby'), popup.getAttribute('aria-describedby'));
    document.addEventListener('focusin', onFocusIn);
    fireEvent.click(screen.getByRole('button', { name: 'Export' }));
    document.removeEventListener('focusin', onFocusIn);
    expect(atFocus.length).toBeGreaterThan(0);
    expect(atFocus.slice(0, 2).every((id) => id !== null && document.getElementById(id) !== null)).toBe(true);
    expect(screen.getByRole('dialog', { name: 'New: export' })).toBe(popup);
    expect(document.getElementById(popup.getAttribute('aria-describedby')!)?.textContent).toBe('Save the report as a file.');
    fireEvent.click(screen.getByRole('button', { name: 'Got it' }));
    await waitFor(() => expect(popup.hasAttribute('data-popover-open')).toBe(false));
    expect(screen.getByRole('dialog', { name: 'New: export', hidden: true })).toBe(popup);
    expect(popup.getAttribute('aria-describedby')).not.toBeNull();
  });

  it('makes the page inert except the target, and lifts it on close', () => {
    render(<Harness />);
    const target = screen.getByRole('button', { name: 'Export' });
    expect(target.closest('[inert]')).toBeNull();
    expect(screen.getByTestId('before').hasAttribute('inert')).toBe(true);
    expect(screen.getByText('Beside').hasAttribute('inert')).toBe(true);
    expect(screen.getByRole('dialog').closest('[inert]')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Got it' }));
    expect(document.querySelectorAll('[inert]')).toHaveLength(0);
    // The anchor stays while it fades out, and goes with the coachmark.
    expect(target.style.getPropertyValue('anchor-name')).toMatch(/^--todae-coachmark-/);
  });

  it('takes its anchor off the target as it unmounts', () => {
    const { unmount } = render(<Harness />);
    const target = screen.getByRole('button', { name: 'Export' });
    unmount();
    expect(target.style.getPropertyValue('anchor-name')).toBe('');
  });

  it('moves the anchor, the inert page and lost focus with a tour step', () => {
    function Tour() {
      const one = useRef<HTMLButtonElement>(null);
      const two = useRef<HTMLButtonElement>(null);
      const [at, setAt] = useState(0);
      return (
        <>
          <button type="button" ref={one} onClick={() => setAt(1)}>
            One
          </button>
          <button type="button" ref={two}>
            Two
          </button>
          <Coachmark.Root targetRef={at === 0 ? one : two} defaultOpen>
            <Coachmark.Title>Step {at + 1}</Coachmark.Title>
            <Coachmark.Close>Got it</Coachmark.Close>
          </Coachmark.Root>
        </>
      );
    }
    render(<Tour />);
    const one = screen.getByRole('button', { name: 'One' });
    const two = screen.getByRole('button', { name: 'Two' });
    expect(two.hasAttribute('inert')).toBe(true);
    expect(one.hasAttribute('inert')).toBe(false);
    one.focus();
    fireEvent.click(one);
    const popup = screen.getByRole('dialog', { name: 'Step 2' });
    expect(one.hasAttribute('inert')).toBe(true);
    expect(two.hasAttribute('inert')).toBe(false);
    expect(one.style.getPropertyValue('anchor-name')).toBe('');
    expect(two.style.getPropertyValue('anchor-name')).toBe(popup.style.getPropertyValue('position-anchor'));
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Got it' }));
  });

  it.each([false, true])('marks the popup and the hole as moving for a tour step only, reduced motion %s', async (reduce) => {
    setMatchMedia('(prefers-reduced-motion: reduce)', reduce);
    function Tour() {
      const one = useRef<HTMLButtonElement>(null);
      const two = useRef<HTMLButtonElement>(null);
      const [at, setAt] = useState(0);
      return (
        <>
          <button type="button" ref={one} onClick={() => setAt(1)}>
            One
          </button>
          <button type="button" ref={two}>
            Two
          </button>
          <Coachmark.Root targetRef={at === 0 ? one : two} defaultOpen>
            <Coachmark.Title>Step {at + 1}</Coachmark.Title>
          </Coachmark.Root>
        </>
      );
    }
    render(<Tour />);
    const popup = screen.getByRole('dialog');
    const scrim = document.querySelector('[aria-hidden="true"][popover]')!;
    // Opening moves nothing.
    expect(popup.hasAttribute('data-todae-moving')).toBe(false);
    fireEvent.click(screen.getByRole('button', { name: 'One' }));
    expect(popup.hasAttribute('data-todae-moving')).toBe(!reduce);
    expect(scrim.hasAttribute('data-todae-moving')).toBe(!reduce);
    // With nothing running, as here, it ends once the slide would have started.
    await waitFor(() => expect(scrim.hasAttribute('data-todae-moving')).toBe(false));
    expect(popup.hasAttribute('data-todae-moving')).toBe(false);
  });

  it('keeps the target’s own popovers, such as its tooltip, usable', async () => {
    function WithTip() {
      const target = useRef<HTMLButtonElement>(null);
      const [tip, setTip] = useState(false);
      return (
        <>
          <span>
            <button type="button" ref={target} onClick={() => setTip(true)}>
              Export
            </button>
            {tip && <span popover="manual">Tip</span>}
          </span>
          <button type="button">Other</button>
          <Coachmark.Root targetRef={target} defaultOpen aria-label="Tip">
            <Coachmark.Close />
          </Coachmark.Root>
        </>
      );
    }
    render(<WithTip />);
    fireEvent.click(screen.getByRole('button', { name: 'Export' }));
    await act(async () => {});
    expect(screen.getByText('Tip', { selector: 'span' }).hasAttribute('inert')).toBe(false);
    expect(screen.getByText('Other').hasAttribute('inert')).toBe(true);
  });

  it('warns once in development when nothing names it', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    function Unnamed() {
      const target = useRef<HTMLButtonElement>(null);
      return (
        <>
          <button type="button" ref={target}>
            Export
          </button>
          <Coachmark.Root targetRef={target} defaultOpen>
            <Coachmark.Close />
          </Coachmark.Root>
        </>
      );
    }
    render(<Unnamed />);
    expect(warn.mock.calls.some(([message]) => String(message).includes('Coachmark.Root has no name'))).toBe(true);
    cleanup();
    warn.mockClear();
    render(<Harness />);
    expect(warn.mock.calls.some(([message]) => String(message).includes('no name'))).toBe(false);
    warn.mockRestore();
  });

  it('moves focus into the popup and back where it was on close', async () => {
    render(<Harness open={false} />);
    const target = screen.getByRole('button', { name: 'Export' });
    target.focus();
    fireEvent.click(target);
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Got it' }));
    fireEvent.click(screen.getByRole('button', { name: 'Got it' }));
    await act(async () => {});
    expect(document.activeElement).toBe(target);
  });

  it('cycles Tab through the popup and the target only', () => {
    render(
      <Harness>
        <button type="button">Back</button>
        <button type="button">Next</button>
      </Harness>,
    );
    const back = screen.getByRole('button', { name: 'Back' });
    const next = screen.getByRole('button', { name: 'Next' });
    const target = screen.getByRole('button', { name: 'Export' });
    expect(document.activeElement).toBe(back);
    fireEvent.keyDown(back, { key: 'Tab' });
    expect(document.activeElement).toBe(next);
    fireEvent.keyDown(next, { key: 'Tab' });
    expect(document.activeElement).toBe(target);
    fireEvent.keyDown(target, { key: 'Tab' });
    expect(document.activeElement).toBe(back);
    fireEvent.keyDown(back, { key: 'Tab', shiftKey: true });
    expect(document.activeElement).toBe(target);
  });

  it('closes on Escape and on its close part, with reasons', () => {
    const onOpenChange = vi.fn();
    const { unmount } = render(<Harness onOpenChange={onOpenChange} />);
    fireEvent.keyDown(document.activeElement ?? document.body, { key: 'Escape' });
    expect(onOpenChange).toHaveBeenLastCalledWith(false, 'escape');
    unmount();
    render(<Harness onOpenChange={onOpenChange} />);
    fireEvent.click(screen.getByRole('button', { name: 'Got it' }));
    expect(onOpenChange).toHaveBeenLastCalledWith(false, 'close-button');
  });

  it('leaves a press on the dim page alone unless dismissOnBackdrop is set', () => {
    const onOpenChange = vi.fn();
    const { unmount } = render(<Harness onOpenChange={onOpenChange} />);
    fireEvent.pointerDown(document.body);
    fireEvent.pointerDown(screen.getByRole('button', { name: 'Export' }));
    expect(onOpenChange).not.toHaveBeenCalled();
    unmount();
    render(<Harness onOpenChange={onOpenChange} dismissOnBackdrop />);
    fireEvent.pointerDown(screen.getByRole('button', { name: 'Export' }));
    fireEvent.pointerDown(screen.getByRole('dialog'));
    expect(onOpenChange).not.toHaveBeenCalled();
    fireEvent.pointerDown(document.body);
    expect(onOpenChange).toHaveBeenCalledWith(false, 'backdrop');
  });

  it('keeps what the target opens, by aria-controls, usable', () => {
    function WithMenu() {
      const target = useRef<HTMLButtonElement>(null);
      return (
        <>
          <button type="button" ref={target} aria-controls="menu">
            Menu
          </button>
          <div id="menu">
            <button type="button">Item</button>
          </div>
          <button type="button">Other</button>
          <Coachmark.Root targetRef={target} defaultOpen aria-label="Tip">
            <Coachmark.Close />
          </Coachmark.Root>
        </>
      );
    }
    render(<WithMenu />);
    expect(screen.getByText('Item').closest('[inert]')).toBeNull();
    expect(screen.getByText('Other').hasAttribute('inert')).toBe(true);
    expect(screen.getByRole('dialog', { name: 'Tip' })).toBeTruthy();
  });

  it('gives the hole the target’s corners, grown by its padding', () => {
    render(<Harness />);
    const scrim = document.querySelector<HTMLElement>('[aria-hidden="true"][popover="manual"]');
    expect(scrim?.style.borderTopLeftRadius).toContain('var(--_pad)');
  });
});

describe('inertOutside', () => {
  it('leaves an inert the page set, marks siblings added later, and unmarks only its own', async () => {
    document.body.innerHTML = '<div id="a" inert></div><div id="b"></div><div><p id="keep"></p><p id="near"></p></div>';
    const keep = document.getElementById('keep')!;
    const release = inertOutside(() => [keep]);
    expect(document.getElementById('b')!.hasAttribute('inert')).toBe(true);
    expect(document.getElementById('near')!.hasAttribute('inert')).toBe(true);
    const late = document.createElement('p');
    keep.parentElement!.append(late);
    await new Promise((resolve) => setTimeout(resolve));
    expect(late.hasAttribute('inert')).toBe(true);
    release();
    expect(document.getElementById('a')!.hasAttribute('inert')).toBe(true);
    expect(document.getElementById('b')!.hasAttribute('inert')).toBe(false);
    expect(late.hasAttribute('inert')).toBe(false);
    document.body.innerHTML = '';
  });

  it('leaves a closed or modal dialog usable wherever it sits, also one added later', async () => {
    document.body.innerHTML = [
      '<dialog id="settings"><button>Save</button></dialog>',
      '<div id="layer"><span id="near"></span><dialog id="wrapped"></dialog></div>',
      '<dialog id="modal" open aria-modal="true"></dialog>',
      '<dialog id="chat" open><button>Send</button></dialog>',
      '<p id="keep"></p>',
    ].join('');
    const keep = document.getElementById('keep')!;
    const release = inertOutside(() => [keep]);
    const inert = (id: string) => document.getElementById(id)!.hasAttribute('inert');
    expect(inert('settings')).toBe(false);
    expect(inert('layer')).toBe(false);
    expect(inert('near')).toBe(true);
    expect(inert('wrapped')).toBe(false);
    expect(inert('modal')).toBe(false);
    // An open dialog that isn't modal is part of the page.
    expect(inert('chat')).toBe(true);
    const late = document.createElement('dialog');
    const lateLayer = document.createElement('div');
    lateLayer.append(document.createElement('dialog'));
    document.body.append(late, lateLayer);
    await new Promise((resolve) => setTimeout(resolve));
    expect(late.hasAttribute('inert')).toBe(false);
    expect(lateLayer.hasAttribute('inert')).toBe(false);
    release();
    document.body.innerHTML = '';
  });

  it('dims the rest of a modal dialog that holds the kept element', () => {
    document.body.innerHTML = '<dialog open aria-modal="true"><p id="keep"></p><p id="other"></p></dialog>';
    const release = inertOutside(() => [document.getElementById('keep')!]);
    expect(document.getElementById('other')!.hasAttribute('inert')).toBe(true);
    release();
    document.body.innerHTML = '';
  });

  it('keeps guest layers usable', () => {
    document.body.innerHTML = '<div id="toast" data-todae-guest-layer></div><p id="keep"></p>';
    const release = inertOutside(() => [document.getElementById('keep')!]);
    expect(document.getElementById('toast')!.hasAttribute('inert')).toBe(false);
    release();
    document.body.innerHTML = '';
  });

  it('reaches a kept element in a shadow root', () => {
    document.body.innerHTML = '<div id="host"></div><p id="other"></p>';
    const host = document.getElementById('host')!;
    const root = host.attachShadow({ mode: 'open' });
    root.innerHTML = '<button id="keep"></button><button id="near"></button>';
    const release = inertOutside(() => [root.getElementById('keep')!]);
    expect(host.hasAttribute('inert')).toBe(false);
    expect(root.getElementById('near')!.hasAttribute('inert')).toBe(true);
    expect(document.getElementById('other')!.hasAttribute('inert')).toBe(true);
    release();
    expect(root.getElementById('near')!.hasAttribute('inert')).toBe(false);
    document.body.innerHTML = '';
  });
});

describe('Coachmark on a closed combobox', () => {
  function TourOnCombobox() {
    const cb = useCombobox({ options: [{ value: 'react', label: 'React' }, { value: 'vue', label: 'Vue' }], presentation: 'popover' });
    const input = cb.getInputProps();
    return (
      <>
        <section>
          <label {...cb.getLabelProps()}>Framework</label>
          <Field.Root {...cb.getAnchorProps()}>
            <Field.TextInput {...input} />
          </Field.Root>
        </section>
        <div data-testid="layer">
          <Popover.Root {...cb.getPopoverProps()}>
            <OptionList.Root {...cb.getListboxProps()}>
              {cb.items.map((item) => (
                <OptionList.Option key={item.id} {...cb.getOptionProps(item)} />
              ))}
            </OptionList.Root>
          </Popover.Root>
        </div>
        <Coachmark.Root targetRef={input.ref} defaultOpen aria-label="Try it">
          <Coachmark.Title>Pick a framework</Coachmark.Title>
        </Coachmark.Root>
      </>
    );
  }

  it('keeps the listbox usable when the combobox first opens beside it', async () => {
    render(<TourOnCombobox />);
    expect(screen.getByTestId('layer').hasAttribute('inert')).toBe(true);
    fireEvent.focus(screen.getByRole('combobox'));
    // The listbox mounts as the popover first opens, and the combobox names it then.
    await act(async () => {});
    expect(screen.getByRole('listbox').closest('[inert]')).toBeNull();
  });

  it('keeps what sits beside the listbox in its popover readable', async () => {
    function EmptyTour() {
      const cb = useCombobox({
        options: [{ value: 'react', label: 'React' }],
        presentation: 'popover',
        defaultInputValue: 'zz',
      });
      const input = cb.getInputProps();
      return (
        <>
          <Field.Root {...cb.getAnchorProps()} aria-label="Framework">
            <Field.TextInput {...input} />
          </Field.Root>
          <div>
            <Popover.Root {...cb.getPopoverProps()}>
              <p role="status">{cb.isEmpty ? 'No matches' : ''}</p>
              <OptionList.Root {...cb.getListboxProps()} hidden={cb.isEmpty}>
                {cb.items.map((item) => (
                  <OptionList.Option key={item.id} {...cb.getOptionProps(item)} />
                ))}
              </OptionList.Root>
            </Popover.Root>
          </div>
          <Coachmark.Root targetRef={input.ref} defaultOpen aria-label="Try it">
            <Coachmark.Title>Pick a framework</Coachmark.Title>
          </Coachmark.Root>
        </>
      );
    }
    render(<EmptyTour />);
    fireEvent.focus(screen.getByRole('combobox'));
    await act(async () => {});
    expect(screen.getByText('No matches').closest('[inert]')).toBeNull();
  });

  it('keeps the search field of a sheet the target opens usable', async () => {
    function SheetTour() {
      const cb = useCombobox({ options: [{ value: 'react', label: 'React' }], presentation: 'sheet' });
      const ref = useRef<HTMLButtonElement>(null);
      return (
        <>
          <label {...cb.getLabelProps()}>Framework</label>
          <Button.Root {...cb.getTriggerProps({ ref })} data-testid="choose">
            Choose
          </Button.Root>
          <BottomSheet.Root {...cb.getSheetProps()}>
            <BottomSheet.Body>
              <Field.Root id={cb.ids.input} aria-label="Framework">
                <Field.TextInput {...cb.getInputProps()} data-testid="search" />
              </Field.Root>
              <OptionList.Root {...cb.getListboxProps()}>
                {cb.items.map((item) => (
                  <OptionList.Option key={item.id} {...cb.getOptionProps(item)} />
                ))}
              </OptionList.Root>
            </BottomSheet.Body>
          </BottomSheet.Root>
          <Coachmark.Root targetRef={ref} defaultOpen aria-label="Try it">
            <Coachmark.Title>Pick a framework</Coachmark.Title>
          </Coachmark.Root>
        </>
      );
    }
    render(<SheetTour />);
    await act(async () => {});
    fireEvent.click(screen.getByTestId('choose'));
    await act(async () => {});
    expect(screen.getByRole('listbox', { hidden: true }).closest('[inert]')).toBeNull();
    expect(screen.getByTestId('search').closest('[inert]')).toBeNull();
    expect(document.querySelector('[data-todae-sheet-drag-handle]')?.closest('[inert]')).toBeNull();
  });

  it.each(['beside the trigger', 'in a wrapper', 'in a portal'] as const)(
    'lets the search field of a dialog the target opens take focus as it opens, %s',
    async (where) => {
      // Where focus lands, and whether that field was usable then: jsdom moves
      // focus into an inert element, which a browser does not.
      const landed: { inert: boolean }[] = [];
      const portal = document.createElement('div');
      document.body.append(portal);
      function DialogTour() {
        const cb = useCombobox({ options: [{ value: 'react', label: 'React' }], presentation: 'dialog' });
        const ref = useRef<HTMLButtonElement>(null);
        const dialog = (
          <Dialog.Root {...cb.getDialogProps()}>
            <Field.Root id={cb.ids.input} aria-label="Framework">
              <Field.TextInput
                {...cb.getInputProps()}
                data-testid="search"
                onFocus={(event) => landed.push({ inert: event.currentTarget.closest('[inert]') !== null })}
              />
            </Field.Root>
            <OptionList.Root {...cb.getListboxProps()}>
              {cb.items.map((item) => (
                <OptionList.Option key={item.id} {...cb.getOptionProps(item)} />
              ))}
            </OptionList.Root>
          </Dialog.Root>
        );
        return (
          <>
            <label {...cb.getLabelProps()}>Framework</label>
            <Button.Root {...cb.getTriggerProps({ ref })} data-testid="choose">
              Choose
            </Button.Root>
            {where === 'beside the trigger' ? dialog : null}
            {where === 'in a wrapper' ? (
              <div>
                <span data-testid="beside" />
                {dialog}
              </div>
            ) : null}
            {where === 'in a portal' ? createPortal(dialog, portal) : null}
            <Coachmark.Root targetRef={ref} defaultOpen aria-label="Try it">
              <Coachmark.Title>Pick a framework</Coachmark.Title>
            </Coachmark.Root>
          </>
        );
      }
      render(<DialogTour />);
      await act(async () => {});
      if (where === 'in a wrapper') expect(screen.getByTestId('beside').closest('[inert]')).not.toBeNull();
      fireEvent.click(screen.getByTestId('choose'));
      await act(async () => {});
      expect(document.activeElement).toBe(screen.getByTestId('search'));
      expect(landed).toEqual([{ inert: false }]);
      portal.remove();
    },
  );
});

describe('Coachmark on a button that opens a dialog', () => {
  it('leaves the dialog usable, though the button names nothing it controls', async () => {
    const onOpenChange = vi.fn();
    function SettingsTour() {
      const ref = useRef<HTMLButtonElement>(null);
      const [open, setOpen] = useState(false);
      return (
        <>
          <Button.Root ref={ref} onClick={() => setOpen(true)}>
            Settings
          </Button.Root>
          <Dialog.Root open={open} onOpenChange={setOpen} aria-label="Settings">
            <Field.Root aria-label="Name">
              <Field.TextInput value="" onValueChange={() => {}} data-testid="name" />
            </Field.Root>
          </Dialog.Root>
          <dialog open aria-label="Chat">
            <button type="button">Send</button>
          </dialog>
          <Coachmark.Root targetRef={ref} defaultOpen dismissOnBackdrop onOpenChange={onOpenChange} aria-label="Settings moved">
            <Coachmark.Title>Settings moved here</Coachmark.Title>
          </Coachmark.Root>
        </>
      );
    }
    render(<SettingsTour />);
    await act(async () => {});
    // The page's own open dialog that isn't modal is dimmed with the page.
    expect(screen.getByRole('button', { name: 'Send', hidden: true }).closest('[inert]')).not.toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Settings' }));
    await act(async () => {});
    expect(screen.getByTestId('name').closest('[inert]')).toBeNull();
    expect(document.activeElement).toBe(screen.getByTestId('name'));
    // A press in the dialog the target opened isn't a press on the dim page.
    fireEvent.pointerDown(screen.getByTestId('name'));
    expect(onOpenChange).not.toHaveBeenCalled();
  });
});
