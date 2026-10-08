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

  it('keeps the native input focusable, so the keyboard reaches the picker', () => {
    render(<Upload />);
    const input = screen.getByTestId('input') as HTMLInputElement;
    input.focus();
    expect(document.activeElement).toBe(input);
  });
});
