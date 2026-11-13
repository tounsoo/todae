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

afterEach(cleanup);

const frame = () => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
const fence = (count: number) => `${Array.from({ length: count }, (_, index) => `const line${index + 1} = ${index + 1};`).join('\n')}\n`;

describe('a long code block in a browser', () => {
  it('shows 20 lines, keeps the rest findable, and opens to the whole fence', async () => {
    const text = fence(60);
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
    expect(describeViolations(await axe.run(container, AXE_OPTIONS))).toEqual([]);

    button.click();
    await frame();
    expect(button.getAttribute('aria-expanded')).toBe('true');
    expect(code.innerText.trimEnd()).toBe(text.trimEnd());
    expect(getComputedStyle(pre).maskImage).toBe('none');
    expect(getComputedStyle(button.parentElement as HTMLElement).position).toBe('sticky');
    expect(describeViolations(await axe.run(container, AXE_OPTIONS))).toEqual([]);
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
    rest.removeAttribute('hidden');
    rest.dispatchEvent(new Event('beforematch', { bubbles: true }));
    await frame();
    expect(button.getAttribute('aria-expanded')).toBe('true');
    expect(rest.getBoundingClientRect().height).toBeGreaterThan(0);
  });
});
