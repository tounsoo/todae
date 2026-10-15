import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { BrandMark, faviconSvg, RIDGE_MIN_SIZE } from './brand';
import { localeMetadata } from './i18n/metadata';

const ridge = (markup: string) => markup.includes('stroke=');

describe('brand mark', () => {
  it('cuts the ridge line only when it has a background and room for it', () => {
    expect(ridge(renderToStaticMarkup(<BrandMark size={52} background="#fff" />))).toBe(true);
    expect(ridge(renderToStaticMarkup(<BrandMark size={RIDGE_MIN_SIZE - 1} background="#fff" />))).toBe(false);
    expect(ridge(renderToStaticMarkup(<BrandMark size={52} />))).toBe(false);
  });

  it('draws the favicon in each color scheme without the ridge line', () => {
    const svg = faviconSvg({ light: '#111111', dark: '#eeeeee' });
    expect(svg).toContain('xmlns="http://www.w3.org/2000/svg"');
    expect(svg).toMatch(/\*\{fill:#111111\}@media \(prefers-color-scheme:dark\)\{\*\{fill:#eeeeee\}\}/);
    expect(ridge(svg)).toBe(false);
  });

  it('draws the same shapes in the favicon as on the page', () => {
    const shapes = (markup: string) => markup.match(/<(rect|path) [^>]*?(?=\/?>)/g)!.map((tag) => tag.replace(/\s+/g, ' '));
    expect(shapes(faviconSvg({ light: '#000', dark: '#fff' }))).toEqual(shapes(renderToStaticMarkup(<BrandMark size={16} />)));
  });

  it('links the favicon and touch icon from every locale', () => {
    for (const locale of ['en', 'ko'] as const) {
      expect(localeMetadata(locale).icons).toEqual({
        icon: { url: '/brand/icon.svg', type: 'image/svg+xml' },
        apple: '/brand/apple-icon.png',
      });
    }
  });
});
