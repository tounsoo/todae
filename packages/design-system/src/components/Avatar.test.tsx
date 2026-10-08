import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Avatar } from './Avatar';

afterEach(cleanup);

describe('Avatar', () => {
  it('is one image named by label, whichever part shows', () => {
    render(
      <Avatar.Root label="Ada Lovelace" data-testid="a">
        <Avatar.Image src="ada.png" data-testid="img" />
        <Avatar.Fallback>AL</Avatar.Fallback>
      </Avatar.Root>,
    );
    const root = screen.getByTestId('a');
    expect(root.getAttribute('role')).toBe('img');
    expect(root.getAttribute('aria-label')).toBe('Ada Lovelace');
    expect(root.hasAttribute('aria-hidden')).toBe(false);
    expect(screen.getByTestId('img').getAttribute('alt')).toBe('');
    expect(screen.getByRole('img', { name: 'Ada Lovelace' })).toBe(root);
  });

  it('is hidden from assistive technology without a label', () => {
    render(
      <Avatar.Root data-testid="a">
        <Avatar.Fallback>AL</Avatar.Fallback>
      </Avatar.Root>,
    );
    const root = screen.getByTestId('a');
    expect(root.getAttribute('aria-hidden')).toBe('true');
    expect(root.getAttribute('role')).toBeNull();
  });

  it('shows the fallback until the image loads, then drops it', () => {
    render(
      <Avatar.Root label="Ada" data-testid="a">
        <Avatar.Image src="ada.png" data-testid="img" />
        <Avatar.Fallback>AL</Avatar.Fallback>
      </Avatar.Root>,
    );
    expect(screen.getByTestId('a').getAttribute('data-status')).toBe('loading');
    expect(screen.getByText('AL')).toBeTruthy();
    fireEvent.load(screen.getByTestId('img'));
    expect(screen.getByTestId('a').getAttribute('data-status')).toBe('loaded');
    expect(screen.queryByText('AL')).toBeNull();
  });

  it('keeps the fallback when the image fails or has no src', () => {
    const { rerender } = render(
      <Avatar.Root label="Ada" data-testid="a">
        <Avatar.Image src="broken.png" data-testid="img" />
        <Avatar.Fallback>AL</Avatar.Fallback>
      </Avatar.Root>,
    );
    fireEvent.error(screen.getByTestId('img'));
    expect(screen.getByTestId('a').getAttribute('data-status')).toBe('error');
    expect(screen.getByText('AL')).toBeTruthy();
    rerender(
      <Avatar.Root label="Ada" data-testid="a">
        <Avatar.Image src="" data-testid="img" />
        <Avatar.Fallback>AL</Avatar.Fallback>
      </Avatar.Root>,
    );
    expect(screen.getByTestId('a').getAttribute('data-status')).toBe('error');
    expect(screen.getByTestId('img').hasAttribute('src')).toBe(false);
  });

  it('starts over when src changes', () => {
    const tree = (src: string) => (
      <Avatar.Root label="Ada" data-testid="a">
        <Avatar.Image src={src} data-testid="img" />
        <Avatar.Fallback>AL</Avatar.Fallback>
      </Avatar.Root>
    );
    const { rerender } = render(tree('one.png'));
    fireEvent.load(screen.getByTestId('img'));
    expect(screen.queryByText('AL')).toBeNull();
    rerender(tree('two.png'));
    expect(screen.getByTestId('a').getAttribute('data-status')).toBe('loading');
    expect(screen.getByText('AL')).toBeTruthy();
  });

  it('shows only the fallback with no image, and goes back to it when the image is removed', () => {
    const { rerender } = render(
      <Avatar.Root label="Ada" data-testid="a">
        <Avatar.Image src="ada.png" data-testid="img" />
        <Avatar.Fallback>AL</Avatar.Fallback>
      </Avatar.Root>,
    );
    fireEvent.load(screen.getByTestId('img'));
    rerender(
      <Avatar.Root label="Ada" data-testid="a">
        <Avatar.Fallback>AL</Avatar.Fallback>
      </Avatar.Root>,
    );
    expect(screen.getByTestId('a').getAttribute('data-status')).toBe('idle');
    expect(screen.getByText('AL')).toBeTruthy();
  });

  it('calls the caller handlers too, and takes a size', () => {
    let loaded = 0;
    render(
      <Avatar.Root size="lg" data-testid="a">
        <Avatar.Image src="ada.png" data-testid="img" onLoad={() => loaded++} />
      </Avatar.Root>,
    );
    fireEvent.load(screen.getByTestId('img'));
    expect(loaded).toBe(1);
    expect(screen.getByTestId('a').getAttribute('data-size')).toBe('lg');
  });

  it('reads an image that finished before its handlers were attached, without a load event', async () => {
    // A cached image during hydration: complete already, and no load event follows.
    const complete = vi.spyOn(HTMLImageElement.prototype, 'complete', 'get').mockReturnValue(true);
    const decode = vi.fn(() => Promise.resolve());
    HTMLImageElement.prototype.decode = decode;
    try {
      render(
        <Avatar.Root label="Ada" data-testid="a">
          <Avatar.Image src="ada.svg" />
          <Avatar.Fallback>AL</Avatar.Fallback>
        </Avatar.Root>,
      );
      await waitFor(() => expect(screen.getByTestId('a').getAttribute('data-status')).toBe('loaded'));
      expect(decode).toHaveBeenCalled();
      cleanup();
      decode.mockImplementation(() => Promise.reject(new Error('broken')));
      render(
        <Avatar.Root label="Ada" data-testid="a">
          <Avatar.Image src="broken.png" />
          <Avatar.Fallback>AL</Avatar.Fallback>
        </Avatar.Root>,
      );
      await waitFor(() => expect(screen.getByTestId('a').getAttribute('data-status')).toBe('error'));
    } finally {
      complete.mockRestore();
      delete (HTMLImageElement.prototype as Partial<HTMLImageElement>).decode;
    }
  });

  it('loads from srcSet alone', () => {
    // jsdom calls an image with no src complete; a browser waits for the srcset pick.
    HTMLImageElement.prototype.decode = () => new Promise(() => undefined);
    try {
      render(
        <Avatar.Root label="Ada" data-testid="a">
          <Avatar.Image srcSet="ada.png 1x, ada@2x.png 2x" data-testid="img" />
        </Avatar.Root>,
      );
      expect(screen.getByTestId('a').getAttribute('data-status')).toBe('loading');
      fireEvent.load(screen.getByTestId('img'));
      expect(screen.getByTestId('a').getAttribute('data-status')).toBe('loaded');
    } finally {
      delete (HTMLImageElement.prototype as Partial<HTMLImageElement>).decode;
    }
  });

  it('throws outside Avatar.Root', () => {
    expect(() => render(<Avatar.Fallback>AL</Avatar.Fallback>)).toThrow(/inside Avatar.Root/);
  });
});
