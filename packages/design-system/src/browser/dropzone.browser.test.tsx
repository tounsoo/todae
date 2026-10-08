import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useDropzone, type UseDropzoneOptions } from '../index';

afterEach(cleanup);

function Upload(options: UseDropzoneOptions) {
  const zone = useDropzone(options);
  return (
    <form data-testid="form">
      <label data-testid="zone" {...zone.getRootProps()}>
        Attachments <input name="files" data-testid="input" {...zone.getInputProps()} />
      </label>
    </form>
  );
}

function drop(target: Element, files: File[]) {
  const data = new DataTransfer();
  for (const file of files) data.items.add(file);
  const fire = (type: string) => target.dispatchEvent(new DragEvent(type, { bubbles: true, cancelable: true, dataTransfer: data }));
  return { enter: fire('dragenter'), over: fire('dragover'), drop: fire('drop') };
}

describe('useDropzone in a browser', () => {
  it('puts only accepted dropped files in the input, so the form submits them', () => {
    const onFiles = vi.fn();
    render(<Upload accept="image/*" multiple onFiles={onFiles} />);
    const png = new File(['png'], 'a.png', { type: 'image/png' });
    const txt = new File(['txt'], 'b.txt', { type: 'text/plain' });
    const result = drop(screen.getByTestId('zone'), [png, txt]);
    expect(result.over).toBe(false);
    expect(result.drop).toBe(false);
    expect(onFiles).toHaveBeenCalledWith([png], [{ file: txt, reasons: ['type'] }]);
    const input = screen.getByTestId('input') as HTMLInputElement;
    expect([...input.files!].map((f) => f.name)).toEqual(['a.png']);
    const form = new FormData(screen.getByTestId('form') as HTMLFormElement);
    expect(form.getAll('files').map((f) => (f as File).name)).toEqual(['a.png']);
  });

  it('puts only accepted picked files back in the input', () => {
    render(<Upload multiple maxSize={3} />);
    const input = screen.getByTestId('input') as HTMLInputElement;
    const picked = new DataTransfer();
    picked.items.add(new File(['png'], 'a.png', { type: 'image/png' }));
    picked.items.add(new File(['too big'], 'b.txt', { type: 'text/plain' }));
    input.files = picked.files;
    input.dispatchEvent(new Event('change', { bubbles: true }));
    expect([...input.files].map((f) => f.name)).toEqual(['a.png']);
  });

  it('skips dropped folders', () => {
    const onFiles = vi.fn();
    render(<Upload onFiles={onFiles} />);
    const png = new File(['png'], 'a.png', { type: 'image/png' });
    const folder = { kind: 'file', getAsFile: () => new File([], 'photos'), webkitGetAsEntry: () => ({ isDirectory: true }) };
    const file = { kind: 'file', getAsFile: () => png, webkitGetAsEntry: () => ({ isDirectory: false }) };
    const data = { types: ['Files'], items: [folder, file], files: [], dropEffect: 'none' };
    const event = new DragEvent('drop', { bubbles: true, cancelable: true });
    Object.defineProperty(event, 'dataTransfer', { value: data });
    screen.getByTestId('zone').dispatchEvent(event);
    expect(onFiles).toHaveBeenCalledWith([png], []);
    // A drop of only folders changes nothing: no callback, and the earlier file stays.
    onFiles.mockClear();
    const onlyFolder = new DragEvent('drop', { bubbles: true, cancelable: true });
    Object.defineProperty(onlyFolder, 'dataTransfer', { value: { ...data, items: [folder] } });
    screen.getByTestId('zone').dispatchEvent(onlyFolder);
    expect(onFiles).not.toHaveBeenCalled();
    const input = screen.getByTestId('input') as HTMLInputElement;
    expect([...input.files!].map((f) => f.name)).toEqual(['a.png']);
  });

  it('keeps the native input focusable, so the keyboard reaches the picker', () => {
    render(<Upload />);
    const input = screen.getByTestId('input') as HTMLInputElement;
    input.focus();
    expect(document.activeElement).toBe(input);
  });
});
