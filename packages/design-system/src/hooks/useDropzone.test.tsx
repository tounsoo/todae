import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import * as api from '../index';
import { acceptsFile, useDropzone, type UseDropzoneOptions } from './useDropzone';

afterEach(cleanup);

function Zone(options: UseDropzoneOptions) {
  const zone = useDropzone(options);
  return (
    <label data-testid="zone" {...zone.getRootProps()}>
      Upload <input data-testid="input" {...zone.getInputProps()} />
      <output data-testid="dragging">{String(zone.dragging)}</output>
    </label>
  );
}

const file = (name: string, type: string, size = 10) => new File(['x'.repeat(size)], name, { type });
const drag = (files: File[], types = ['Files']) => ({ dataTransfer: { files, types, dropEffect: 'none' } });

describe('acceptsFile', () => {
  it('matches extensions by name, and wildcards and exact types by MIME type', () => {
    const pdf = { name: 'Report.PDF', type: 'application/pdf' };
    const png = { name: 'a.png', type: 'image/png' };
    expect(acceptsFile(pdf, undefined)).toBe(true);
    expect(acceptsFile(pdf, '')).toBe(true);
    expect(acceptsFile(pdf, '.pdf')).toBe(true);
    expect(acceptsFile(png, 'image/*')).toBe(true);
    expect(acceptsFile(png, ' .pdf , image/png ')).toBe(true);
    expect(acceptsFile(pdf, 'image/*')).toBe(false);
    expect(acceptsFile({ name: 'a.svg', type: 'image/svg+xml' }, 'image/png')).toBe(false);
  });
});

describe('useDropzone', () => {
  it('is exported from the package', () => {
    expect(api.useDropzone).toBe(useDropzone);
  });

  it('wires the native input', () => {
    render(<Zone accept="image/*" multiple disabled />);
    const input = screen.getByTestId('input') as HTMLInputElement;
    expect(input.type).toBe('file');
    expect(input.accept).toBe('image/*');
    expect(input.multiple).toBe(true);
    expect(input.disabled).toBe(true);
  });

  it('sorts dropped files into accepted and rejected, with every reason', () => {
    const onFiles = vi.fn();
    render(<Zone accept=".pdf" multiple maxFiles={1} maxSize={100} minSize={5} onFiles={onFiles} />);
    const ok = file('a.pdf', 'application/pdf');
    const extra = file('b.pdf', 'application/pdf');
    const wrong = file('c.png', 'image/png', 200);
    const tiny = file('d.pdf', 'application/pdf', 1);
    fireEvent.drop(screen.getByTestId('zone'), drag([ok, wrong, extra, tiny]));
    expect(onFiles).toHaveBeenCalledOnce();
    const [accepted, rejected] = onFiles.mock.calls[0]!;
    expect(accepted).toEqual([ok]);
    expect(rejected).toEqual([
      { file: wrong, reasons: ['type', 'too-large'] },
      { file: extra, reasons: ['too-many'] },
      { file: tiny, reasons: ['too-small'] },
    ]);
  });

  it('takes one file unless multiple is set', () => {
    const onFiles = vi.fn();
    render(<Zone maxFiles={5} onFiles={onFiles} />);
    const [a, b] = [file('a.txt', 'text/plain'), file('b.txt', 'text/plain')];
    fireEvent.drop(screen.getByTestId('zone'), drag([a, b]));
    expect(onFiles).toHaveBeenCalledWith([a], [{ file: b, reasons: ['too-many'] }]);
  });

  it('checks files picked through the input', () => {
    const onFiles = vi.fn();
    render(<Zone accept="image/*" onFiles={onFiles} />);
    const wrong = file('a.txt', 'text/plain');
    fireEvent.change(screen.getByTestId('input'), { target: { files: [wrong] } });
    expect(onFiles).toHaveBeenCalledWith([], [{ file: wrong, reasons: ['type'] }]);
  });

  it('shows dragging across child elements and clears it on leave or drop', () => {
    render(<Zone />);
    const zone = screen.getByTestId('zone');
    const dragging = () => screen.getByTestId('dragging').textContent;
    fireEvent.dragEnter(zone, drag([]));
    fireEvent.dragEnter(screen.getByTestId('input'), drag([]));
    fireEvent.dragLeave(zone, drag([]));
    expect(dragging()).toBe('true');
    expect(zone.hasAttribute('data-dragging')).toBe(true);
    fireEvent.dragLeave(screen.getByTestId('input'), drag([]));
    expect(dragging()).toBe('false');
    expect(zone.hasAttribute('data-dragging')).toBe(false);
    fireEvent.dragEnter(zone, drag([]));
    fireEvent.drop(zone, drag([]));
    expect(dragging()).toBe('false');
  });

  it('reports an empty pick, so app state follows a cleared input', () => {
    const onFiles = vi.fn();
    render(<Zone onFiles={onFiles} />);
    fireEvent.change(screen.getByTestId('input'), { target: { files: [] } });
    expect(onFiles).toHaveBeenCalledWith([], []);
  });

  it('ends a drag that was entered while enabled after the zone is disabled', () => {
    const { rerender } = render(<Zone />);
    fireEvent.dragEnter(screen.getByTestId('zone'), drag([]));
    rerender(<Zone disabled />);
    fireEvent.dragLeave(screen.getByTestId('zone'), drag([]));
    rerender(<Zone />);
    expect(screen.getByTestId('dragging').textContent).toBe('false');
    expect(screen.getByTestId('zone').hasAttribute('data-dragging')).toBe(false);
  });

  it('ignores drags that carry no files', () => {
    const onFiles = vi.fn();
    render(<Zone onFiles={onFiles} />);
    const zone = screen.getByTestId('zone');
    const enter = fireEvent.dragEnter(zone, drag([], ['text/plain']));
    expect(enter).toBe(true);
    expect(screen.getByTestId('dragging').textContent).toBe('false');
    fireEvent.drop(zone, drag([], ['text/plain']));
    expect(onFiles).not.toHaveBeenCalled();
  });

  it('leaves the drop effect to the browser while enabled', () => {
    render(<Zone />);
    const over = { dataTransfer: { files: [], types: ['Files'], effectAllowed: 'move', dropEffect: 'move' } };
    expect(fireEvent.dragOver(screen.getByTestId('zone'), over)).toBe(false);
    expect(over.dataTransfer.dropEffect).toBe('move');
  });

  it('refuses drops while disabled', () => {
    const onFiles = vi.fn();
    render(<Zone disabled onFiles={onFiles} />);
    const zone = screen.getByTestId('zone');
    const over = drag([]);
    fireEvent.dragEnter(zone, over);
    expect(fireEvent.dragOver(zone, over)).toBe(false);
    expect(over.dataTransfer.dropEffect).toBe('none');
    expect(screen.getByTestId('dragging').textContent).toBe('false');
    act(() => {
      fireEvent.drop(zone, drag([file('a.txt', 'text/plain')]));
    });
    expect(onFiles).not.toHaveBeenCalled();
  });
});
