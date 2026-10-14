import { act, render, screen } from '@testing-library/react';
import { userEvent } from '@vitest/browser/context';
import { StrictMode, useState } from 'react';
import { flushSync } from 'react-dom';
import { createRoot } from 'react-dom/client';
import axe from 'axe-core';
import { describe, expect, it } from 'vitest';
import { Attachment } from '../index';

function Icon() {
  return (
    <svg data-testid="icon" viewBox="0 0 24 24" aria-hidden>
      <rect x="4" y="2" width="16" height="20" />
    </svg>
  );
}

function box(id: string): DOMRect {
  return screen.getByTestId(id).getBoundingClientRect();
}

describe('Attachment.Root in a browser', () => {
  it('puts the preview at the start and the remove button at the end, with the name and meta between', () => {
    render(
      <div data-appearance="light" data-density="comfortable">
        <Attachment.Root data-testid="root">
          <Attachment.Preview data-testid="preview">
            <Icon />
          </Attachment.Preview>
          <Attachment.Name data-testid="name">report.pdf</Attachment.Name>
          <Attachment.Meta data-testid="meta">1.2 MB</Attachment.Meta>
          <Attachment.Remove data-testid="remove" />
        </Attachment.Root>
      </div>,
    );
    const root = box('root');
    const preview = box('preview');
    const name = box('name');
    const meta = box('meta');
    const remove = box('remove');
    expect(preview.right).toBeLessThanOrEqual(name.left);
    expect(name.right).toBeLessThanOrEqual(remove.left);
    expect(meta.left).toBe(name.left);
    expect(meta.top).toBeGreaterThanOrEqual(name.bottom - 0.5);
    // The preview and the button sit beside both lines, inside the border.
    expect(preview.top).toBeGreaterThan(root.top);
    expect(remove.right).toBeLessThan(root.right);
    const style = getComputedStyle(screen.getByTestId('preview'));
    expect(style.inlineSize).toBe('40px');
    const icon = getComputedStyle(screen.getByTestId('icon'));
    expect(icon.inlineSize).toBe('20px');
  });

  it('leaves no gap where a preview or remove button is missing or hidden', () => {
    render(
      <div data-appearance="light" data-density="comfortable">
        <Attachment.Root data-testid="bare">
          <Attachment.Name data-testid="bare-name">notes.txt</Attachment.Name>
        </Attachment.Root>
        <Attachment.Root data-testid="hidden">
          <Attachment.Preview hidden>
            <Icon />
          </Attachment.Preview>
          <Attachment.Name data-testid="hidden-name">notes.txt</Attachment.Name>
          <Attachment.Remove hidden />
        </Attachment.Root>
      </div>,
    );
    for (const id of ['bare', 'hidden']) {
      const root = screen.getByTestId(id);
      const padding = parseFloat(getComputedStyle(root).paddingInlineStart);
      const border = parseFloat(getComputedStyle(root).borderInlineStartWidth);
      expect(box(`${id}-name`).left - box(id).left).toBeCloseTo(padding + border, 0);
      expect(box(id).right - box(`${id}-name`).right).toBeCloseTo(padding + border, 0);
    }
  });

  it('cuts a long name with an ellipsis inside its max width, keeping the button whole', () => {
    render(
      <div data-appearance="light" data-density="comfortable">
        <Attachment.Root data-testid="root">
          <Attachment.Name data-testid="name">{'a-very-long-file-name-that-goes-on-and-on-and-on.pdf'}</Attachment.Name>
          <Attachment.Remove data-testid="remove" />
        </Attachment.Root>
      </div>,
    );
    const name = screen.getByTestId('name');
    expect(name.scrollWidth).toBeGreaterThan(name.clientWidth);
    expect(getComputedStyle(name).textOverflow).toBe('ellipsis');
    expect(box('root').width).toBeLessThanOrEqual(256.5);
    expect(box('remove').right).toBeLessThan(box('root').right);
  });

  it('puts the upload bar under the name and meta, and marks an error in the border', () => {
    render(
      <div data-appearance="light" data-density="comfortable">
        <Attachment.Root data-testid="uploading" status="uploading">
          <Attachment.Name data-testid="name">photo.jpg</Attachment.Name>
          <Attachment.Meta data-testid="meta">Uploading</Attachment.Meta>
          <Attachment.Progress data-testid="progress" value={30} max={100} />
        </Attachment.Root>
        <Attachment.Root data-testid="error" status="error">
          <Attachment.Name>photo.jpg</Attachment.Name>
          <Attachment.Meta data-testid="error-meta">Upload failed</Attachment.Meta>
        </Attachment.Root>
      </div>,
    );
    expect(box('progress').top).toBeGreaterThan(box('meta').bottom);
    expect(box('progress').left).toBe(box('name').left);
    const ready = getComputedStyle(screen.getByTestId('uploading'));
    const error = getComputedStyle(screen.getByTestId('error'));
    expect(error.borderTopColor).not.toBe(ready.borderTopColor);
    expect(getComputedStyle(screen.getByTestId('error-meta')).color).not.toBe(getComputedStyle(screen.getByTestId('meta')).color);
  });

  it('moves focus to the next remove button when an attachment holding focus is removed, else the one before', async () => {
    function Files() {
      const [files, setFiles] = useState(['a.png', 'b.png', 'c.png']);
      return (
        <>
          <div>
            {files.map((file) => (
              <Attachment.Root key={file}>
                <Attachment.Name>{file}</Attachment.Name>
                <Attachment.Remove onClick={() => setFiles((all) => all.filter((f) => f !== file))} />
              </Attachment.Root>
            ))}
          </div>
          <div>
            <Attachment.Root>
              <Attachment.Name>elsewhere.png</Attachment.Name>
              <Attachment.Remove />
            </Attachment.Root>
          </div>
        </>
      );
    }
    render(<Files />);
    await userEvent.click(screen.getByRole('button', { name: 'Remove b.png' }));
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Remove c.png' }));
    await userEvent.click(screen.getByRole('button', { name: 'Remove c.png' }));
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Remove a.png' }));
    // The last one leaves focus to the product, rather than jumping to another group's files.
    await userEvent.click(screen.getByRole('button', { name: 'Remove a.png' }));
    expect(document.activeElement).not.toBe(screen.getByRole('button', { name: 'Remove elsewhere.png' }));
  });

  it('moves focus across the items of a list', async () => {
    function Files() {
      const [files, setFiles] = useState(['a.png', 'b.png']);
      return (
        <ul>
          {files.map((file) => (
            <li key={file}>
              <Attachment.Root>
                <Attachment.Name>{file}</Attachment.Name>
                <Attachment.Remove onClick={() => setFiles((all) => all.filter((f) => f !== file))} />
              </Attachment.Root>
            </li>
          ))}
        </ul>
      );
    }
    render(<Files />);
    await userEvent.click(screen.getByRole('button', { name: 'Remove a.png' }));
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Remove b.png' }));
  });

  it('leaves focus where the product moves it in its own click handler', async () => {
    function Files({ start }: { start: string[] }) {
      const [files, setFiles] = useState(start);
      return (
        <div>
          <div>
            {files.map((file) => (
              <Attachment.Root key={file}>
                <Attachment.Name>{file}</Attachment.Name>
                <Attachment.Remove
                  onClick={() => {
                    setFiles((all) => all.filter((f) => f !== file));
                    document.getElementById('message')!.focus();
                  }}
                />
              </Attachment.Root>
            ))}
          </div>
          <input id="message" aria-label="Message" />
        </div>
      );
    }
    const { unmount } = render(<Files start={['a.png']} />);
    await userEvent.click(screen.getByRole('button', { name: 'Remove a.png' }));
    expect(document.activeElement).toBe(screen.getByRole('textbox', { name: 'Message' }));
    unmount();
    render(<Files start={['a.png', 'b.png']} />);
    await userEvent.click(screen.getByRole('button', { name: 'Remove a.png' }));
    expect(document.activeElement).toBe(screen.getByRole('textbox', { name: 'Message' }));
  });

  it('hands focus on after a removal flushed inside the click handler, and not after preventDefault', async () => {
    function Files({ prevent }: { prevent?: boolean }) {
      const [files, setFiles] = useState(['a.png', 'b.png']);
      return (
        <div>
          {files.map((file) => (
            <Attachment.Root key={file}>
              <Attachment.Name>{file}</Attachment.Name>
              <Attachment.Remove
                onClick={(event) => {
                  if (prevent) {
                    event.preventDefault();
                    setFiles((all) => all.filter((f) => f !== file));
                  } else {
                    flushSync(() => setFiles((all) => all.filter((f) => f !== file)));
                  }
                }}
              />
            </Attachment.Root>
          ))}
        </div>
      );
    }
    const { unmount } = render(<Files />);
    await userEvent.click(screen.getByRole('button', { name: 'Remove a.png' }));
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Remove b.png' }));
    unmount();
    render(<Files prevent />);
    await userEvent.click(screen.getByRole('button', { name: 'Remove a.png' }));
    // preventDefault() turns off Todae's own part of the press, as on other parts.
    expect(document.activeElement).not.toBe(screen.getByRole('button', { name: 'Remove b.png' }));
  });

  it('moves focus past a neighbor that cannot take it', async () => {
    function Files() {
      const [files, setFiles] = useState(['a.png', 'b.png', 'c.png']);
      return (
        <div>
          {files.map((file) => (
            <Attachment.Root key={file} style={file === 'c.png' ? { visibility: 'hidden' } : undefined}>
              <Attachment.Name>{file}</Attachment.Name>
              <Attachment.Remove onClick={() => setFiles((all) => all.filter((f) => f !== file))} />
            </Attachment.Root>
          ))}
        </div>
      );
    }
    render(<Files />);
    await userEvent.click(screen.getByRole('button', { name: 'Remove b.png' }));
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Remove a.png' }));
  });

  it('moves no focus when an attachment holding it unmounts without a remove press', async () => {
    function Files({ keys, strict }: { keys: string[]; strict?: boolean }) {
      const list = (
        <div>
          {keys.map((key, index) => (
            <Attachment.Root key={key}>
              <Attachment.Name>{`file-${index}.png`}</Attachment.Name>
              <Attachment.Remove autoFocus={strict && index === keys.length - 1} />
            </Attachment.Root>
          ))}
        </div>
      );
      return strict ? <StrictMode>{list}</StrictMode> : list;
    }
    // A new key once an upload finishes remounts the attachment.
    const { rerender, unmount } = render(<Files keys={['tmp-0', 'b']} />);
    const first = screen.getByRole('button', { name: 'Remove file-0.png' });
    act(() => first.focus());
    rerender(<Files keys={['srv-0', 'b']} />);
    expect(document.activeElement).not.toBe(screen.getByRole('button', { name: 'Remove file-1.png' }));
    unmount();
    // StrictMode mounts, unmounts and mounts again: focus stays on the new file.
    render(<Files strict keys={['a', 'b']} />);
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Remove file-1.png' }));
  });

  it('reads focus in the shadow root that holds it', async () => {
    const host = document.createElement('div');
    document.body.append(host);
    const shadow = host.attachShadow({ mode: 'open' });
    const mount = document.createElement('div');
    shadow.append(mount);
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
    const root = createRoot(mount);
    act(() => root.render(<Files />));
    const a = shadow.querySelector<HTMLButtonElement>('[aria-label="Remove a.png"]')!;
    act(() => a.focus());
    act(() => a.click());
    expect(shadow.activeElement).toBe(shadow.querySelector('[aria-label="Remove b.png"]'));
    act(() => root.unmount());
    host.remove();
  });

  it('closes up the rows of a missing meta line', () => {
    render(
      <div data-appearance="light" data-density="comfortable">
        <Attachment.Root data-testid="no-meta">
          <Attachment.Preview data-testid="preview">
            <Icon />
          </Attachment.Preview>
          <Attachment.Name data-testid="name">notes.txt</Attachment.Name>
          <Attachment.Remove data-testid="remove" />
        </Attachment.Root>
        <Attachment.Root data-testid="bar" status="uploading">
          <Attachment.Preview data-testid="bar-preview">
            <Icon />
          </Attachment.Preview>
          <Attachment.Name data-testid="bar-name">notes.txt</Attachment.Name>
          <Attachment.Progress data-testid="bar-progress" value={1} max={2} />
        </Attachment.Root>
      </div>,
    );
    const middle = (r: DOMRect) => r.top + r.height / 2;
    expect(middle(box('name'))).toBeCloseTo(middle(box('preview')), 0);
    expect(middle(box('remove'))).toBeCloseTo(middle(box('preview')), 0);
    // The bar sits under the name, inside the preview's height.
    expect(box('bar-progress').top).toBeGreaterThan(box('bar-name').bottom - 0.5);
    expect(box('bar-progress').bottom).toBeLessThanOrEqual(box('bar-preview').bottom + 0.5);
  });

  it('covers the preview with the img of a picture, cropped to it', () => {
    const src =
      'data:image/svg+xml,' +
      encodeURIComponent(
        '<svg xmlns="http://www.w3.org/2000/svg" width="400" height="200"><rect width="400" height="200" fill="teal"/></svg>',
      );
    render(
      <div data-appearance="light" data-density="comfortable">
        <Attachment.Root>
          <Attachment.Preview data-testid="preview">
            <picture>
              <img data-testid="img" src={src} width={400} height={200} alt="" />
            </picture>
          </Attachment.Preview>
          <Attachment.Name>wide.svg</Attachment.Name>
        </Attachment.Root>
      </div>,
    );
    expect(box('img').width).toBeCloseTo(box('preview').width, 0);
    expect(box('img').height).toBeCloseTo(box('preview').height, 0);
  });

  it('keeps a list item as narrow as an attachment with a long name', () => {
    render(
      <div data-appearance="light" data-density="comfortable">
        <ul style={{ display: 'flex', flexWrap: 'wrap', listStyle: 'none', padding: 0 }}>
          <li data-testid="item">
            <Attachment.Root data-testid="root">
              <Attachment.Name>{'a-very-long-file-name-that-goes-on-and-on-and-on.pdf'}</Attachment.Name>
            </Attachment.Root>
          </li>
        </ul>
      </div>,
    );
    expect(box('item').width).toBeCloseTo(box('root').width, 0);
  });

  it('leaves focus alone when an attachment without focus is removed', async () => {
    function Files({ files }: { files: string[] }) {
      return (
        <div>
          {files.map((file) => (
            <Attachment.Root key={file}>
              <Attachment.Name>{file}</Attachment.Name>
              <Attachment.Remove />
            </Attachment.Root>
          ))}
          <input aria-label="Message" />
        </div>
      );
    }
    const { rerender } = render(<Files files={['a.png', 'b.png']} />);
    const input = screen.getByRole('textbox', { name: 'Message' });
    act(() => input.focus());
    rerender(<Files files={['b.png']} />);
    expect(document.activeElement).toBe(input);
  });

  it('passes axe', async () => {
    render(
      <main data-appearance="light" data-density="comfortable">
        <Attachment.Root status="uploading">
          <Attachment.Preview>
            <Icon />
          </Attachment.Preview>
          <Attachment.Name>photo.jpg</Attachment.Name>
          <Attachment.Meta>Uploading</Attachment.Meta>
          <Attachment.Progress value={30} max={100} />
          <Attachment.Remove />
        </Attachment.Root>
      </main>,
    );
    const results = await axe.run(document.body, { rules: { 'color-contrast': { enabled: false } } });
    expect(results.violations).toEqual([]);
  });
});
