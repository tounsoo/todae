import { render, screen, waitFor } from '@testing-library/react';
import { server, userEvent } from '@vitest/browser/context';
import { useRef, useState, type CSSProperties } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Button } from '../components/Button.js';
import { Coachmark, type CoachmarkCloseReason } from '../components/Coachmark.js';
import { Dialog } from '../components/Dialog.js';
import { Field } from '../components/Field.js';
import { OptionList } from '../components/OptionList.js';
import { useCombobox } from '../hooks/useCombobox.js';
import { emulateMedia } from '../test/media.js';
import { settle } from '../test/settle.js';

afterEach(async () => {
  await emulateMedia([]);
});

function Harness({ onTarget, onClose }: { onTarget?: () => void; onClose?: (reason: CoachmarkCloseReason) => void }) {
  const target = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  return (
    <div data-appearance="light" data-density="comfortable" style={{ padding: '4rem' }}>
      <Button.Root onClick={() => setOpen(true)}>Start tour</Button.Root>
      <Button.Root ref={target} variant="secondary" onClick={onTarget}>
        Export
      </Button.Root>
      <Coachmark.Root
        targetRef={target}
        open={open}
        onOpenChange={(next, reason) => {
          setOpen(next);
          if (!next) onClose?.(reason);
        }}
      >
        <Coachmark.Title>New: export</Coachmark.Title>
        <Coachmark.Description>Save the report as a file.</Coachmark.Description>
        <Coachmark.Footer>
          <Button.Root variant="secondary">Back</Button.Root>
          <Coachmark.Close variant="primary">Got it</Coachmark.Close>
        </Coachmark.Footer>
      </Coachmark.Root>
    </div>
  );
}

async function openTour() {
  await userEvent.click(screen.getByRole('button', { name: 'Start tour' }));
  await waitFor(() => expect(screen.getByRole('dialog', { name: 'New: export' }).matches(':popover-open')).toBe(true));
  await settle();
}

function scrim(): HTMLElement {
  return document.querySelector<HTMLElement>('[aria-hidden="true"][popover]')!;
}

// A slow, even slide, so a look partway finds it between the two targets.
const slowMove = {
  padding: '4rem',
  display: 'flex',
  gap: '12rem',
  ['--_todae-coachmark-motion-duration-move' as string]: '1s',
  ['--_todae-coachmark-motion-easing-move' as string]: 'linear',
} satisfies CSSProperties;

const frame = () => new Promise((resolve) => requestAnimationFrame(resolve));

function Tour() {
  const first = useRef<HTMLButtonElement>(null);
  const second = useRef<HTMLButtonElement>(null);
  const [step, setStep] = useState(0);
  return (
    <div data-appearance="light" data-density="comfortable" style={slowMove}>
      <Button.Root ref={first} variant="secondary">
        Filter
      </Button.Root>
      <Button.Root ref={second} variant="secondary">
        Export
      </Button.Root>
      <Coachmark.Root targetRef={step === 0 ? first : second} defaultOpen>
        <Coachmark.Title>{step === 0 ? 'Filter' : 'Export'}</Coachmark.Title>
        <Coachmark.Footer>
          <Button.Root variant="primary" onClick={() => setStep(1)}>
            Next
          </Button.Root>
        </Coachmark.Footer>
      </Coachmark.Root>
    </div>
  );
}

describe('Coachmark in a browser', () => {
  it('cuts the hole around the target, with room for its focus ring, and shows the popup in front', async () => {
    render(<Harness />);
    await openTour();
    const target = screen.getByRole('button', { name: 'Export' }).getBoundingClientRect();
    const hole = scrim().getBoundingClientRect();
    // coachmark.cutout.padding and the focus ring's room are both 4px in the base theme.
    expect(hole.left).toBeCloseTo(target.left - 4, 0);
    expect(hole.top).toBeCloseTo(target.top - 4, 0);
    expect(hole.width).toBeCloseTo(target.width + 8, 0);
    expect(hole.height).toBeCloseTo(target.height + 8, 0);
    const popup = screen.getByRole('dialog');
    const box = popup.getBoundingClientRect();
    expect(popup.contains(document.elementFromPoint(box.left + box.width / 2, box.top + box.height / 2))).toBe(true);
  });

  it('keeps the target pressable through the dim page, and the rest inert', async () => {
    const onTarget = vi.fn();
    render(<Harness onTarget={onTarget} />);
    await openTour();
    await userEvent.click(screen.getByRole('button', { name: 'Export' }));
    expect(onTarget).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('button', { name: 'Start tour', hidden: true }).closest('[inert]')).not.toBeNull();
  });

  async function openTourAndStep() {
    render(<Tour />);
    await waitFor(() => expect(screen.getByRole('dialog', { name: 'Filter' }).matches(':popover-open')).toBe(true));
    await settle();
    const before = { hole: scrim().getBoundingClientRect().left, popup: screen.getByRole('dialog').getBoundingClientRect().left };
    await userEvent.click(screen.getByRole('button', { name: 'Next' }));
    await frame();
    await frame();
    return before;
  }

  function expectAtExport() {
    const target = screen.getByRole('button', { name: 'Export' }).getBoundingClientRect();
    // coachmark.cutout.padding and the focus ring's room are both 4px in the base theme.
    expect(scrim().getBoundingClientRect().left).toBeCloseTo(target.left - 4, 0);
    expect(screen.getByRole('dialog', { name: 'Export' }).getBoundingClientRect().left).toBeCloseTo(target.left, 0);
  }

  it("slides the hole and the popup to a tour's next target, then stops", async () => {
    const before = await openTourAndStep();
    // WebKit and Firefox move them at once, as they do the Tabs indicator; motion only has to
    // work in Chrome (ARCHITECTURE "Motion"). All three end at the new target.
    if (server.browser === 'chromium') {
      const target = screen.getByRole('button', { name: 'Export' }).getBoundingClientRect();
      expect(scrim().hasAttribute('data-todae-moving')).toBe(true);
      const hole = scrim().getBoundingClientRect().left;
      const popup = screen.getByRole('dialog').getBoundingClientRect().left;
      expect(hole).toBeGreaterThan(before.hole + 1);
      expect(hole).toBeLessThan(target.left - 5);
      expect(popup).toBeGreaterThan(before.popup + 1);
      expect(popup).toBeLessThan(target.left - 1);
    }
    await settle();
    expectAtExport();
    expect(scrim().hasAttribute('data-todae-moving')).toBe(false);
    expect(screen.getByRole('dialog').hasAttribute('data-todae-moving')).toBe(false);
  });

  it('moves them at once under reduced motion', async () => {
    await emulateMedia([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
    await openTourAndStep();
    expect(scrim().hasAttribute('data-todae-moving')).toBe(false);
    expectAtExport();
  });

  it('moves focus in, cycles Tab between the popup and the target, and returns focus on Escape', async () => {
    const onClose = vi.fn();
    render(<Harness onClose={onClose} />);
    await openTour();
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Back' }));
    await userEvent.keyboard('{Tab}');
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Got it' }));
    await userEvent.keyboard('{Tab}');
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Export' }));
    await userEvent.keyboard('{Tab}');
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Back' }));
    await userEvent.keyboard('{Escape}');
    await waitFor(() => expect(onClose).toHaveBeenCalledWith('escape'));
    await waitFor(() => expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Start tour' })));
    // The page is usable again at once; the popup and the hole stay inert only while they fade out.
    expect(document.querySelector('[inert]:not([popover])')).toBeNull();
    await settle();
    expect(scrim().matches(':popover-open')).toBe(false);
    expect(document.querySelector('[inert]')).toBeNull();
  });
});

function DialogComboboxTour({ wrapped = false }: { wrapped?: boolean }) {
  const cb = useCombobox({
    options: [
      { value: 'react', label: 'React' },
      { value: 'vue', label: 'Vue' },
    ],
    presentation: 'dialog',
  });
  const ref = useRef<HTMLButtonElement>(null);
  const dialog = (
    <Dialog.Root {...cb.getDialogProps()}>
      <Field.Root id={cb.ids.input} aria-label="Search frameworks">
        <Field.TextInput {...cb.getInputProps()} />
      </Field.Root>
      <OptionList.Root {...cb.getListboxProps({ 'aria-label': 'Frameworks' })}>
        {cb.items.map((item) => (
          <OptionList.Option key={item.id} {...cb.getOptionProps(item)} />
        ))}
      </OptionList.Root>
    </Dialog.Root>
  );
  return (
    <div data-appearance="light" data-density="comfortable" style={{ padding: '4rem' }}>
      <label {...cb.getLabelProps()}>Framework</label>
      <Button.Root {...cb.getTriggerProps({ ref })} variant="secondary">
        Choose
      </Button.Root>
      {wrapped ? (
        <div>
          <span>Beside the dialog</span>
          {dialog}
        </div>
      ) : (
        dialog
      )}
      <Coachmark.Root targetRef={ref} defaultOpen dismissOnBackdrop>
        <Coachmark.Title>Pick a framework</Coachmark.Title>
      </Coachmark.Root>
    </div>
  );
}

describe('Coachmark on the trigger of a combobox that opens in a dialog', () => {
  it.each([false, true])('moves focus into the dialog as it opens, and the search field takes typing (wrapped: %s)', async (wrapped) => {
    render(<DialogComboboxTour wrapped={wrapped} />);
    const coachmark = await screen.findByRole('dialog', { name: 'Pick a framework' });
    await waitFor(() => expect(coachmark.matches(':popover-open')).toBe(true));
    await settle();
    // The trigger is named by its label and itself; testing-library's name for it
    // drops its own text in real browsers, so find it by that text.
    await userEvent.click(screen.getByText('Choose'));
    const search = await screen.findByRole('combobox');
    await waitFor(() => expect(document.activeElement).toBe(search));
    await userEvent.keyboard('vu');
    await waitFor(() => expect(screen.getAllByRole('option').map((option) => option.textContent)).toEqual(['Vue']));
    // A press in the dialog isn't a press on the dim page.
    await userEvent.click(search);
    expect(coachmark.matches(':popover-open')).toBe(true);
  });
});
