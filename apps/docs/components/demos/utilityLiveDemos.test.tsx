// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import StatusFilter from '../../examples/utilities/use-controlled-state/StatusFilter';
import ImageDrop from '../../examples/utilities/use-dropzone/ImageDrop';
import SearchShortcut from '../../examples/utilities/use-hotkey/SearchShortcut';

describe('utility live demos', () => {
  it('runs the hotkey from the document and from the button', () => {
    render(<SearchShortcut />);
    expect(screen.getByText('Press Alt+T')).toBeTruthy();
    fireEvent.keyDown(document, { key: 't', code: 'KeyT' });
    expect(screen.getByText('Press Alt+T')).toBeTruthy();
    fireEvent.keyDown(document, { key: 't', code: 'KeyT', altKey: true });
    expect(screen.getByText('Search is open')).toBeTruthy();
  });

  it('opens from the button when the key is not pressed', () => {
    render(<SearchShortcut />);
    fireEvent.click(screen.getByRole('button', { name: 'Search' }));
    expect(screen.getByText('Search is open')).toBeTruthy();
  });

  it('lists a chosen image', () => {
    render(<ImageDrop />);
    expect(screen.getByText('No images yet')).toBeTruthy();
    const input = screen.getByLabelText('Drop images here, or choose them');
    const file = new File(['hello'], 'cat.png', { type: 'image/png' });
    fireEvent.change(input, { target: { files: [file] } });
    expect(screen.getByText('cat.png')).toBeTruthy();
  });

  it('skips onChange when the next value is the one on screen, and lets the parent own the controlled value', () => {
    render(<StatusFilter />);
    const [setFree, setHeld] = screen.getAllByRole('button', { name: 'Set open' });
    expect(setFree).toBeTruthy();
    expect(setHeld).toBeTruthy();
    if (!setFree || !setHeld) return;
    expect(screen.getByText('Uncontrolled. Changes 0.')).toBeTruthy();
    expect(screen.getByText('Controlled. Parent holds all. Changes 0.')).toBeTruthy();

    fireEvent.click(setFree!);
    expect(screen.getByText('Uncontrolled. Changes 1.')).toBeTruthy();
    fireEvent.click(setFree!);
    expect(screen.getByText('Uncontrolled. Changes 1.')).toBeTruthy();

    fireEvent.click(setHeld!);
    expect(screen.getByText('Controlled. Parent holds open. Changes 1.')).toBeTruthy();
    fireEvent.click(setHeld!);
    expect(screen.getByText('Controlled. Parent holds open. Changes 1.')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Reset parent' }));
    expect(screen.getByText('Controlled. Parent holds all. Changes 1.')).toBeTruthy();
  });
});
