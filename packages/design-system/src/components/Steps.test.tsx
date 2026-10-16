import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { StringsProvider } from '../providers/StringsProvider.js';
import { Steps } from './Steps.js';

afterEach(cleanup);

function plan() {
  return (
    <Steps.Root aria-label="Plan">
      <Steps.Item status="done">Read the files</Steps.Item>
      <Steps.Item status="current">Write the fix</Steps.Item>
      <Steps.Item>Run the tests</Steps.Item>
      <Steps.Item status="error">Deploy</Steps.Item>
    </Steps.Root>
  );
}

describe('Steps', () => {
  it('is a named list whose items read their status before their text', () => {
    render(plan());
    const list = screen.getByRole('list', { name: 'Plan' });
    expect(list.tagName).toBe('OL');
    const items = screen.getAllByRole('listitem');
    expect(items.map((item) => item.textContent)).toEqual([
      'Done: Read the files',
      'In progress: Write the fix',
      'Not started: Run the tests',
      'Failed: Deploy',
    ]);
    expect(items.map((item) => item.dataset.status)).toEqual(['done', 'current', 'pending', 'error']);
  });

  it('marks only the current step with aria-current="step"', () => {
    render(plan());
    const items = screen.getAllByRole('listitem');
    expect(items.map((item) => item.getAttribute('aria-current'))).toEqual([null, 'step', null, null]);
  });

  it('hides the marker, spinner and glyphs from screen readers', () => {
    render(plan());
    expect(screen.queryByRole('progressbar')).toBeNull();
    const [done, current, pending, error] = screen.getAllByRole('listitem');
    expect(done!.querySelector('[aria-hidden="true"] [data-todae-glyph] > svg')).not.toBeNull();
    expect(current!.querySelector('[aria-hidden="true"] > progress')).not.toBeNull();
    expect(pending!.querySelector('[aria-hidden="true"]')!.childElementCount).toBe(0);
    expect(error!.querySelector('[aria-hidden="true"] [data-todae-glyph] > svg')).not.toBeNull();
  });

  it('reads the status words from StringsProvider unless statusLabel is set and not empty', () => {
    render(
      <StringsProvider strings={{ stepDone: '완료' }}>
        <Steps.Root>
          <Steps.Item status="done">A</Steps.Item>
          <Steps.Item status="done" statusLabel="Skipped">
            B
          </Steps.Item>
          <Steps.Item status="done" statusLabel="">
            C
          </Steps.Item>
        </Steps.Root>
      </StringsProvider>,
    );
    expect(screen.getAllByRole('listitem').map((item) => item.textContent)).toEqual(['완료: A', 'Skipped: B', '완료: C']);
  });

  it('throws when an item is rendered outside Steps.Root', () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => render(<Steps.Item>Alone</Steps.Item>)).toThrow('Steps.Item must be rendered inside Steps.Root');
    error.mockRestore();
  });
});
