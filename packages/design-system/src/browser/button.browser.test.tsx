import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { userEvent } from '@vitest/browser/context';
import { afterEach, describe, expect, it } from 'vitest';
import { Button } from '../index.js';

afterEach(cleanup);

const openTip = () => document.querySelector<HTMLElement>('[role="tooltip"]:popover-open');

describe('Button.Root auto-tip', () => {
  // Button watches no attribute around it: its label is a shrink-to-fit flex
  // item, so a class that widens the label past its room also resizes it.
  it('shows the full label once a class around the button cuts it', async () => {
    const label = 'Save every archived thread';
    const sheet = document.createElement('style');
    sheet.textContent = '.selected button { font-weight: 700; letter-spacing: 0.05em; }';
    document.head.append(sheet);
    const row = (selected: boolean, width: string | number) => (
      <div className={selected ? 'selected' : undefined} style={{ inlineSize: width }}>
        <Button.Root variant="secondary">{label}</Button.Root>
      </div>
    );
    const probe = render(row(false, '40rem'));
    const regularWidth = screen.getByRole('button').getBoundingClientRect().width;
    probe.rerender(row(true, '40rem'));
    const boldWidth = screen.getByRole('button').getBoundingClientRect().width;
    probe.unmount();
    expect(regularWidth).toBeLessThan(boldWidth);

    const { rerender } = render(row(false, Math.ceil((regularWidth + boldWidth) / 2)));
    const button = screen.getByRole('button');
    await userEvent.hover(button);
    await new Promise((resolve) => setTimeout(resolve, 600));
    expect(openTip()).toBeNull();
    await userEvent.unhover(button);

    rerender(row(true, Math.ceil((regularWidth + boldWidth) / 2)));
    await userEvent.hover(button);
    await waitFor(() => expect(openTip()?.textContent).toBe(label));
    await userEvent.unhover(button);
    sheet.remove();
  });
});
