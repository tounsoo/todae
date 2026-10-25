import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import catalog from '../../tokens/tokens.generated.json';

const srcDir = join(import.meta.dirname, '..');
const generatedCss = readFileSync(join(import.meta.dirname, 'tokens.generated.css'), 'utf8');

/** Component tokens Todae leaves for product code to apply, each with the reason. */
const FOR_PRODUCTS: Record<string, string> = {
  '--todae-avatar-size-sm': 'A smaller avatar step. A product sets --todae-avatar-size-md to it on an avatar, or on an ancestor inside the nearest theme.',
  '--todae-avatar-size-lg': 'A larger avatar step. A product sets --todae-avatar-size-md to it on an avatar, or on an ancestor inside the nearest theme.',
};

/** Every non-test, non-generated source file under src: sheets, components and hooks. */
function sources(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return sources(path);
    if (!/\.(css|ts|tsx)$/.test(entry.name) || /\.(test|browser\.test)\.tsx?$|\.generated\./.test(entry.name)) return [];
    return [readFileSync(path, 'utf8')];
  });
}

describe('token usage', () => {
  it('reads every component token, from a source file or another token', () => {
    const code = sources(srcDir).join('\n');
    const inSource = (cssVar: string) => new RegExp(`${cssVar.replace(/[-]/g, '\\-')}(?![-\\w])`).test(code);
    const read = (cssVar: string) => inSource(cssVar) || new RegExp(`var\\(${cssVar.replace(/[-]/g, '\\-')}(?![-\\w])`).test(generatedCss);
    // Core and appearance tokens are public API for product code; a component token is only there for its component.
    const unread = [...new Set(catalog.tokens.filter((token) => token.layer === 'contract').map((token) => token.cssVar))].filter(
      (cssVar) => !read(cssVar) && !(cssVar in FOR_PRODUCTS),
    );
    expect(unread).toEqual([]);
    for (const cssVar of Object.keys(FOR_PRODUCTS)) {
      expect(catalog.tokens.some((token) => token.cssVar === cssVar && token.layer === 'contract'), cssVar).toBe(true);
      expect(inSource(cssVar), cssVar).toBe(false);
    }
  });
});
