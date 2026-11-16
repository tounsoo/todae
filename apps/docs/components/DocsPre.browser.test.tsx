/// <reference types="@vitest/browser-playwright" />
import { Code } from '@tounsoo/todae/code';
import { cleanup, render, screen } from '@testing-library/react';
import axe from 'axe-core';
import { afterEach, describe, expect, it, vi } from 'vitest';
import '@tounsoo/todae/todae.css';
import '../app/globals.css';
import { AXE_OPTIONS, describeViolations } from '../test/axe';
import { DocsPre } from './DocsPre';

vi.mock('next/navigation', () => ({ usePathname: () => '/recipes/kanban' }));

afterEach(() => {
  cleanup();
  scrollTo({ top: 0, behavior: 'instant' });
});

const frame = () => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
const LONG_LINE = `const wide = '${'x'.repeat(300)}';`;
const fence = (count: number) => `${Array.from({ length: count }, (_, index) => `const line${index + 1} = ${index + 1};`).join('\n')}\n`;

describe('a long code block in a browser', () => {
  it('shows 20 lines, keeps the rest findable, and opens to the whole fence', async () => {
    const text = `${LONG_LINE}\n${fence(59)}`;
    const { container } = render(
      <main>
        <h2>Recipe</h2>
        <DocsPre>
          <Code.Root className="language-tsx">{text}</Code.Root>
        </DocsPre>
      </main>,
    );
    await frame();
    const pre = container.querySelector('pre') as HTMLPreElement;
    const code = container.querySelector('code') as HTMLElement;
    const button = screen.getByRole('button', { name: 'Show all code' });
    const rest = document.getElementById(button.getAttribute('aria-controls') ?? '') as HTMLElement;

    // Chromium has hidden="until-found", so find in page can reach the rest and open the block.
    expect(rest.getAttribute('hidden')).toBe('until-found');
    const style = getComputedStyle(pre);
    const lines = (pre.clientHeight - parseFloat(style.paddingBlockStart) - parseFloat(style.paddingBlockEnd)) / parseFloat(style.lineHeight);
    expect(lines).toBeCloseTo(20, 0);
    expect(getComputedStyle(pre).maskImage).toContain('linear-gradient');
    // The mask clips at the pre's box, so the pre has to be as wide as its longest line for a sideways scroll to show it.
    expect(pre.scrollWidth).toBeLessThanOrEqual(pre.clientWidth);
    const frameEl = pre.closest<HTMLElement>('[data-scroll-kind="code"]');
    if (!frameEl) throw new Error('The block has no scroll frame.');
    expect(pre.clientWidth).toBeGreaterThan(frameEl.clientWidth);
    expect(describeViolations(await axe.run(container, AXE_OPTIONS))).toEqual([]);

    button.click();
    await frame();
    expect(button.getAttribute('aria-expanded')).toBe('true');
    expect(code.innerText.trimEnd()).toBe(text.trimEnd());
    expect(getComputedStyle(pre).maskImage).toBe('none');
    expect(getComputedStyle(button.parentElement as HTMLElement).position).toBe('sticky');
    expect(describeViolations(await axe.run(container, AXE_OPTIONS))).toEqual([]);
  });

  it('keeps the button in place in the viewport when the reader folds the block', async () => {
    // Room above the block, so the page can scroll up by as much as the block shrinks.
    render(
      <main>
        <div style={{ blockSize: '200vh' }} />
        <DocsPre>
          <Code.Root className="language-tsx">{fence(300)}</Code.Root>
        </DocsPre>
        <div style={{ blockSize: '200vh' }} />
      </main>,
    );
    screen.getByRole('button', { name: 'Show all code' }).click();
    await frame();
    const button = screen.getByRole('button', { name: 'Show less code' });
    // Read deep into the open block, where the button sticks to the bottom of the screen.
    scrollTo({ top: document.documentElement.scrollHeight / 3, behavior: 'instant' });
    await frame();
    const before = button.getBoundingClientRect().top;
    expect(before).toBeGreaterThan(innerHeight / 2);
    button.click();
    await frame();
    expect(button.getAttribute('aria-expanded')).toBe('false');
    expect(Math.abs(button.getBoundingClientRect().top - before)).toBeLessThanOrEqual(1);
  });

  it('keeps the button in place when the reader folds the block with its end on screen', async () => {
    render(
      <main>
        <div style={{ blockSize: '200vh' }} />
        <DocsPre>
          <Code.Root className="language-tsx">{fence(300)}</Code.Root>
        </DocsPre>
        <p>The paragraph after the block.</p>
        <div style={{ blockSize: '200vh' }} />
      </main>,
    );
    screen.getByRole('button', { name: 'Show all code' }).click();
    await frame();
    const button = screen.getByRole('button', { name: 'Show less code' });
    // Scroll the block's end to a third of the way down, so the button is back in the flow, no longer stuck to the
    // bottom of the screen, with the next paragraph under it.
    const block = button.closest('.docs-code-fold') as HTMLElement;
    scrollBy({ top: block.getBoundingClientRect().bottom - innerHeight / 3, behavior: 'instant' });
    await frame();
    const before = button.getBoundingClientRect().top;
    expect(before).toBeLessThan(innerHeight / 2);
    button.click();
    await frame();
    await frame();
    expect(Math.abs(button.getBoundingClientRect().top - before)).toBeLessThanOrEqual(1);
    expect(document.documentElement.style.overflowAnchor).toBe('');
  });

  it('opens when the browser reveals the rest for find in page', async () => {
    const { container } = render(
      <DocsPre>
        <Code.Root className="language-tsx">{fence(45)}</Code.Root>
      </DocsPre>,
    );
    await frame();
    const button = screen.getByRole('button', { name: 'Show all code' });
    const rest = container.querySelector('.docs-code-rest') as HTMLElement;
    // What Chromium does when a find matches text inside a hidden="until-found" element.
    rest.dispatchEvent(new Event('beforematch', { bubbles: true }));
    rest.removeAttribute('hidden');
    await frame();
    expect(button.getAttribute('aria-expanded')).toBe('true');
    expect(rest.getBoundingClientRect().height).toBeGreaterThan(0);
  });
});
