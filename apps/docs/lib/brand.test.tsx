import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { GET as touchIcon } from '../app/brand/mark-180.png/route';
import { GET as pngFavicon } from '../app/brand/mark-32.png/route';
import { GET as svgFavicon } from '../app/brand/mark.svg/route';
import { BrandMark, faviconSvg, RIDGE_MIN_SIZE } from './brand';
import { LOCALES } from './i18n/config';
import { localeMetadata } from './i18n/metadata';
import { appearanceColor } from './og/colors';

const ridge = (markup: string) => markup.includes('stroke=');

/** A PNG's width and height, from its IHDR chunk. */
async function pngSize(response: Response): Promise<[number, number]> {
  const bytes = new DataView(await response.arrayBuffer());
  expect(bytes.getUint32(0)).toBe(0x89504e47);
  return [bytes.getUint32(16), bytes.getUint32(20)];
}

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

  it('links the favicons and touch icon from every locale', () => {
    for (const locale of LOCALES) {
      expect(localeMetadata(locale).icons).toEqual({
        icon: [
          { url: '/brand/mark-32.png', sizes: '32x32', type: 'image/png' },
          { url: '/brand/mark.svg', type: 'image/svg+xml' },
        ],
        apple: '/brand/mark-180.png',
      });
    }
  });
});

describe('brand icon routes', () => {
  it('serves the SVG favicon in the site’s ink for each color scheme', async () => {
    const response = svgFavicon();
    expect(response.headers.get('content-type')).toBe('image/svg+xml');
    expect(await response.text()).toBe(
      faviconSvg({ light: appearanceColor('fg.default', 'light'), dark: appearanceColor('fg.default', 'dark') }),
    );
  });

  it('serves the PNG favicon and touch icon at their sizes', async () => {
    for (const [route, size] of [
      [pngFavicon, 32],
      [touchIcon, 180],
    ] as const) {
      const response = route();
      expect(response.headers.get('content-type')).toBe('image/png');
      expect(await pngSize(response)).toEqual([size, size]);
    }
  });
});
