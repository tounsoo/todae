import { describe, expect, it } from 'vitest';
import { localeOf, localizePath, stripLocale } from './config';

describe('locale paths', () => {
  it('reads the locale from the first segment only', () => {
    expect(localeOf('/')).toBe('en');
    expect(localeOf('/button')).toBe('en');
    expect(localeOf('/ko')).toBe('ko');
    expect(localeOf('/ko/button')).toBe('ko');
    expect(localeOf('/ko?x=1')).toBe('ko');
    expect(localeOf('/korean')).toBe('en');
    expect(localeOf('/en/button')).toBe('en');
  });

  it('strips the prefix and keeps the rest', () => {
    expect(stripLocale('/ko')).toBe('/');
    expect(stripLocale('/ko/utilities/use-field')).toBe('/utilities/use-field');
    expect(stripLocale('/ko#top')).toBe('/#top');
    expect(stripLocale('/korean')).toBe('/korean');
    expect(stripLocale('/button')).toBe('/button');
  });

  it('moves same-site paths between locales', () => {
    expect(localizePath('/', 'ko')).toBe('/ko');
    expect(localizePath('/#top', 'ko')).toBe('/ko#top');
    expect(localizePath('/tokens#contrast', 'ko')).toBe('/ko/tokens#contrast');
    expect(localizePath('/ko/tokens', 'ko')).toBe('/ko/tokens');
    expect(localizePath('/ko/tokens', 'en')).toBe('/tokens');
    expect(localizePath('/ko', 'en')).toBe('/');
    expect(localizePath('/button', 'en')).toBe('/button');
  });

  it('leaves other links alone', () => {
    for (const href of ['https://example.com/x', '//cdn.example.com/x', '#props', 'mailto:a@b.c', '/api/mcp', 'relative']) {
      expect(localizePath(href, 'ko')).toBe(href);
    }
  });
});
