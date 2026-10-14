import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { StringsProvider } from '../providers/StringsProvider';
import { Attachment } from './Attachment';

afterEach(cleanup);

describe('Attachment', () => {
  it('is a group named by its file name, with a remove button that names the file', () => {
    render(
      <Attachment.Root>
        <Attachment.Name>report.pdf</Attachment.Name>
        <Attachment.Meta>1.2 MB</Attachment.Meta>
        <Attachment.Remove />
      </Attachment.Root>,
    );
    expect(screen.getByRole('group', { name: 'report.pdf' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Remove report.pdf' })).toBeTruthy();
  });

  it('follows a new file name, and leaves the group unnamed without one', () => {
    const { rerender } = render(
      <Attachment.Root>
        <Attachment.Name>a.png</Attachment.Name>
        <Attachment.Remove />
      </Attachment.Root>,
    );
    rerender(
      <Attachment.Root>
        <Attachment.Name>b.png</Attachment.Name>
        <Attachment.Remove />
      </Attachment.Root>,
    );
    expect(screen.getByRole('group', { name: 'b.png' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Remove b.png' })).toBeTruthy();
    rerender(
      <Attachment.Root>
        <Attachment.Remove />
      </Attachment.Root>,
    );
    expect(screen.getByRole('group').hasAttribute('aria-labelledby')).toBe(false);
    expect(screen.getByRole('button', { name: 'Remove' })).toBeTruthy();
  });

  it('takes the remove name from StringsProvider, and its own aria-label or text first', () => {
    render(
      <StringsProvider strings={{ removeAttachment: (name) => `${name} 제거` }}>
        <Attachment.Root>
          <Attachment.Name>a.png</Attachment.Name>
          <Attachment.Remove />
        </Attachment.Root>
        <Attachment.Root>
          <Attachment.Name>b.png</Attachment.Name>
          <Attachment.Remove aria-label="Delete b" />
        </Attachment.Root>
        <Attachment.Root>
          <Attachment.Name>c.png</Attachment.Name>
          <Attachment.Remove>Discard</Attachment.Remove>
        </Attachment.Root>
      </StringsProvider>,
    );
    expect(screen.getByRole('button', { name: 'a.png 제거' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Delete b' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Discard' }).hasAttribute('aria-label')).toBe(false);
  });

  it('names its progress bar by the file name unless it has a name', () => {
    render(
      <>
        <Attachment.Root status="uploading">
          <Attachment.Name>a.png</Attachment.Name>
          <Attachment.Progress value={40} max={100} />
        </Attachment.Root>
        <Attachment.Root status="uploading">
          <Attachment.Name>b.png</Attachment.Name>
          <Attachment.Progress value={40} max={100} aria-label="Uploading b.png" />
        </Attachment.Root>
      </>,
    );
    expect(screen.getByRole('progressbar', { name: 'a.png' })).toBeTruthy();
    const named = screen.getByRole('progressbar', { name: 'Uploading b.png' });
    expect(named.hasAttribute('aria-labelledby')).toBe(false);
  });

  it('keeps its default names with an id of your own on the name, or an aria-labelledby left undefined', () => {
    render(
      <Attachment.Root status="uploading" aria-labelledby={undefined}>
        <Attachment.Name id="file-1-name">a.png</Attachment.Name>
        <Attachment.Progress value={1} max={2} aria-labelledby={undefined} />
      </Attachment.Root>,
    );
    expect(screen.getByRole('group', { name: 'a.png' }).getAttribute('aria-labelledby')).toBe('file-1-name');
    expect(screen.getByRole('progressbar', { name: 'a.png' })).toBeTruthy();
  });

  it('takes an aria-label of its own over the file name', () => {
    render(
      <Attachment.Root aria-label="Photo, failed">
        <Attachment.Name>a.png</Attachment.Name>
      </Attachment.Root>,
    );
    const group = screen.getByRole('group', { name: 'Photo, failed' });
    expect(group.hasAttribute('aria-labelledby')).toBe(false);
  });

  it('hands focus on after a remove press where elements have no checkVisibility', () => {
    function Files() {
      const [files, setFiles] = useState(['a.png', 'b.png']);
      return (
        <div>
          {files.map((file) => (
            <Attachment.Root key={file}>
              <Attachment.Name>{file}</Attachment.Name>
              <Attachment.Remove onClick={() => setFiles((all) => all.filter((f) => f !== file))} />
            </Attachment.Root>
          ))}
        </div>
      );
    }
    render(<Files />);
    expect('checkVisibility' in HTMLElement.prototype).toBe(false);
    const a = screen.getByRole('button', { name: 'Remove a.png' });
    a.focus();
    fireEvent.click(a);
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Remove b.png' }));
  });

  it('shows its status to CSS', () => {
    render(
      <>
        <Attachment.Root data-testid="ready" />
        <Attachment.Root data-testid="error" status="error" />
      </>,
    );
    expect(screen.getByTestId('ready').getAttribute('data-status')).toBe('ready');
    expect(screen.getByTestId('error').getAttribute('data-status')).toBe('error');
  });

  it('throws for a part outside Attachment.Root', () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => render(<Attachment.Remove />)).toThrow('Attachment.Remove must be rendered inside Attachment.Root');
    error.mockRestore();
  });
});
