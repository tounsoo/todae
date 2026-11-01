// @vitest-environment jsdom
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { codeBlocks } from '../../lib/mdxAst';
import { StatusFilter } from './ControlledValueDemo';
import { ImageDrop } from './DropzoneDemo';
import { SearchShortcut } from './HotkeyDemo';

const read = (path: string) => readFileSync(join(process.cwd(), path), 'utf8');

/** The demo module readers can copy, without the Next client directive. */
function moduleSource(file: string): string {
  const source = read(file);
  const prefix = "'use client';\n\n";
  expect(source.startsWith(prefix), file).toBe(true);
  return source.slice(prefix.length).replace(/\n$/, '');
}

function fences(page: string): string[] {
  return codeBlocks(read(page)).code.map((source) => source.split('\n').slice(1, -1).join('\n'));
}

describe('utility live demos', () => {
  it.each([
    ['components/demos/HotkeyDemo.tsx', 'app/(en)/utilities/use-hotkey/page.mdx', 'app/ko/utilities/use-hotkey/page.mdx'],
    ['components/demos/DropzoneDemo.tsx', 'app/(en)/utilities/use-dropzone/page.mdx', 'app/ko/utilities/use-dropzone/page.mdx'],
    [
      'components/demos/ControlledValueDemo.tsx',
      'app/(en)/utilities/use-controlled-value/page.mdx',
      'app/ko/utilities/use-controlled-value/page.mdx',
    ],
  ])('%s is the snippet on the English and Korean pages', (file, en, ko) => {
    const source = moduleSource(file);
    expect(fences(en)).toContain(source);
    expect(fences(ko)).toContain(source);
  });

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
