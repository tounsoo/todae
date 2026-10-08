import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Avatar } from './Avatar';
import { StrictMode } from 'react';

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

  describe('an image already complete when its effect runs', () => {
    let srcSets: string[] = [];
    let srcsetSets: string[] = [];
    function stub(naturalWidth: number) {
      srcSets = [];
      srcsetSets = [];
      vi.spyOn(HTMLImageElement.prototype, 'complete', 'get').mockReturnValue(true);
      vi.spyOn(HTMLImageElement.prototype, 'naturalWidth', 'get').mockReturnValue(naturalWidth);
      const src = Object.getOwnPropertyDescriptor(HTMLImageElement.prototype, 'src')!;
      vi.spyOn(HTMLImageElement.prototype, 'src', 'set').mockImplementation(function (this: HTMLImageElement, value) {
        srcSets.push(value);
        src.set!.call(this, value);
      });
      const srcset = Object.getOwnPropertyDescriptor(HTMLImageElement.prototype, 'srcset')!;
      vi.spyOn(HTMLImageElement.prototype, 'srcset', 'set').mockImplementation(function (this: HTMLImageElement, value) {
        srcsetSets.push(value);
        srcset.set!.call(this, value);
      });
    }
    afterEach(() => vi.restoreAllMocks());
    const tree = (src = 'ada.svg') => (
      <Avatar.Root label="Ada" data-testid="a">
        <Avatar.Image src={src} data-testid="img" />
        <Avatar.Fallback>AL</Avatar.Fallback>
      </Avatar.Root>
    );
    const status = () => screen.getByTestId('a').getAttribute('data-status');

    it('is loaded at once with a natural width, without loading again', () => {
      stub(64);
      render(tree());
      expect(status()).toBe('loaded');
      // Only React's own set when it creates the element.
      expect(srcSets).toEqual(['ada.svg']);
    });

    it('sets the source again when it has no width, and lets the image decide: an SVG loads', () => {
      stub(0);
      render(tree());
      expect(status()).toBe('loading');
      // React's set, then the one that loads it again.
      expect(srcSets).toEqual(['ada.svg', 'ada.svg']);
      fireEvent.load(screen.getByTestId('img'));
      expect(status()).toBe('loaded');
    });

    it('keeps the fallback when the image fails again', () => {
      stub(0);
      render(tree());
      fireEvent.error(screen.getByTestId('img'));
      expect(status()).toBe('error');
      expect(screen.getByText('AL')).toBeTruthy();
    });

    it('sets srcset again when there is no src', () => {
      stub(0);
      render(
        <Avatar.Root label="Ada" data-testid="a">
          <Avatar.Image srcSet="ada.png 1x, ada@2x.png 2x" />
        </Avatar.Root>,
      );
      expect(srcsetSets).toEqual(['ada.png 1x, ada@2x.png 2x', 'ada.png 1x, ada@2x.png 2x']);
      expect(status()).toBe('loading');
    });

    it('decides again from the element when src changes after an event', () => {
      stub(0);
      const { rerender } = render(tree('one.svg'));
      fireEvent.load(screen.getByTestId('img'));
      rerender(tree('two.svg'));
      expect(status()).toBe('loading');
      fireEvent.error(screen.getByTestId('img'));
      expect(status()).toBe('error');
    });

    it('waits for an event after a src change, even while the element still reports the old image', () => {
      // Some engines keep complete and naturalWidth from the old image until the new request starts.
      stub(64);
      const { rerender } = render(tree('one.png'));
      expect(status()).toBe('loaded');
      rerender(tree('two.png'));
      expect(status()).toBe('loading');
      expect(screen.getByText('AL')).toBeTruthy();
      fireEvent.load(screen.getByTestId('img'));
      expect(status()).toBe('loaded');
    });

    it('settles under StrictMode', () => {
      stub(0);
      render(<StrictMode>{tree()}</StrictMode>);
      expect(status()).toBe('loading');
      fireEvent.load(screen.getByTestId('img'));
      expect(status()).toBe('loaded');
    });
  });

  it('loads from srcSet alone, and does not throw where images cannot load', () => {
    // jsdom calls an image with no src complete with no width, and never loads it.
    render(
      <Avatar.Root label="Ada" data-testid="a">
        <Avatar.Image srcSet="ada.png 1x, ada@2x.png 2x" data-testid="img" />
      </Avatar.Root>,
    );
    expect(screen.getByTestId('a').getAttribute('data-status')).toBe('loading');
    fireEvent.load(screen.getByTestId('img'));
    expect(screen.getByTestId('a').getAttribute('data-status')).toBe('loaded');
  });

  it('throws outside Avatar.Root', () => {
    expect(() => render(<Avatar.Fallback>AL</Avatar.Fallback>)).toThrow(/inside Avatar.Root/);
  });
});
