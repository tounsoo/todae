import { render, screen } from '@testing-library/react';
import { userEvent } from '@vitest/browser/context';
import { describe, expect, it } from 'vitest';
import { Tree } from '../components/Tree';

function Files({ dir }: { dir?: 'rtl' }) {
  return (
    <div data-appearance="light" data-density="comfortable" dir={dir}>
      <button type="button">before</button>
      <Tree.Root aria-label="Files" defaultExpanded={['src']} defaultValue="src/index.ts">
        <Tree.Item value="src">
          <Tree.Label>src</Tree.Label>
          <Tree.Group>
            <Tree.Item value="src/lib">
              <Tree.Label>lib</Tree.Label>
              <Tree.Group>
                <Tree.Item value="src/lib/util.ts">
                  <Tree.Label>util.ts</Tree.Label>
                </Tree.Item>
              </Tree.Group>
            </Tree.Item>
            <Tree.Item value="src/index.ts">
              <Tree.Label>index.ts</Tree.Label>
            </Tree.Item>
          </Tree.Group>
        </Tree.Item>
        <Tree.Item value="README.md">
          <Tree.Label>README.md</Tree.Label>
        </Tree.Item>
      </Tree.Root>
      <button type="button">after</button>
    </div>
  );
}

const item = (name: string) => screen.getByRole('treeitem', { name });

describe('Tree in a browser', () => {
  it('is one Tab stop on the selected item and walks only the items shown', async () => {
    render(<Files />);
    screen.getByRole('button', { name: 'before' }).focus();
    await userEvent.keyboard('{Tab}');
    expect(document.activeElement).toBe(item('index.ts'));
    await userEvent.keyboard('{ArrowUp}');
    // lib is closed, so util.ts is skipped.
    expect(document.activeElement).toBe(item('lib'));
    await userEvent.keyboard('{ArrowRight}{ArrowRight}');
    expect(document.activeElement).toBe(item('util.ts'));
    await userEvent.keyboard('{Tab}');
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'after' }));
  });

  it('rings only the focused row and indents rows by depth', async () => {
    render(<Files />);
    screen.getByRole('button', { name: 'before' }).focus();
    await userEvent.keyboard('{Tab}');
    const focused = item('index.ts');
    const label = focused.querySelector<HTMLElement>(':scope > div')!;
    expect(getComputedStyle(focused).outlineStyle).toBe('none');
    expect(getComputedStyle(label).outlineStyle).toBe('solid');
    const top = item('src').querySelector<HTMLElement>(':scope > div')!;
    expect(parseFloat(getComputedStyle(label).paddingInlineStart)).toBeGreaterThan(
      parseFloat(getComputedStyle(top).paddingInlineStart),
    );
  });

  it('turns a closed item’s chevron toward the text, the other way in rtl', () => {
    const { unmount } = render(<Files />);
    const chevron = (name: string) => item(name).querySelector<HTMLElement>(':scope > div > [data-todae-glyph]')!;
    expect(getComputedStyle(chevron('lib')).rotate).toBe('-90deg');
    expect(getComputedStyle(chevron('src')).rotate).toBe('none');
    expect(getComputedStyle(chevron('README.md')).visibility).toBe('hidden');
    unmount();
    render(<Files dir="rtl" />);
    expect(getComputedStyle(chevron('lib')).rotate).toBe('90deg');
  });
});
