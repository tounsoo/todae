import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { EmptyState } from '../index.js';

afterEach(cleanup);

/** What a token resolves to in pixels, read by sizing a probe element with it. */
function tokenPx(host: HTMLElement, name: string): number {
  const probe = document.createElement('div');
  probe.style.inlineSize = `var(--todae-${name})`;
  host.append(probe);
  const width = probe.getBoundingClientRect().width;
  probe.remove();
  return width;
}

function renderEmpty(width: string) {
  render(
    <div data-appearance="light" data-density="comfortable" data-testid="host" style={{ inlineSize: width }}>
      <EmptyState.Root data-testid="root">
        <EmptyState.Icon data-testid="icon">
          <svg viewBox="0 0 24 24" data-testid="svg" />
        </EmptyState.Icon>
        <EmptyState.Title>No projects yet</EmptyState.Title>
        <EmptyState.Description data-testid="description">
          Projects group your files and teammates. Create one to get started, or import the ones you already have from
          another workspace, so nothing has to be typed in again by hand.
        </EmptyState.Description>
        <EmptyState.Actions data-testid="actions">
          <button type="button">New project</button>
          <button type="button">Import a project</button>
          <button type="button">Browse templates</button>
        </EmptyState.Actions>
      </EmptyState.Root>
    </div>,
  );
  return screen.getByTestId('host');
}

describe('EmptyState in a browser', () => {
  it('sizes an svg in Icon to the icon size token', () => {
    const host = renderEmpty('60rem');
    const expected = tokenPx(host, 'emptystate-icon-size');
    expect(expected).toBeGreaterThan(0);
    const box = screen.getByTestId('svg').getBoundingClientRect();
    expect(box.width).toBeCloseTo(expected, 1);
    expect(box.height).toBeCloseTo(expected, 1);
  });

  it('keeps the description within the max-width token', () => {
    const host = renderEmpty('60rem');
    const max = tokenPx(host, 'emptystate-max-width');
    expect(max).toBeGreaterThan(0);
    const description = screen.getByTestId('description').getBoundingClientRect();
    expect(description.width).toBeLessThanOrEqual(max + 0.5);
    expect(description.width).toBeGreaterThan(max / 2);
  });

  it('wraps the actions and centers each row', () => {
    renderEmpty('18rem');
    const rowOf = (el: Element) => Math.round(el.getBoundingClientRect().top);
    const buttons = [...screen.getByTestId('actions').children];
    expect(new Set(buttons.map(rowOf)).size).toBeGreaterThan(1);
    const root = screen.getByTestId('root').getBoundingClientRect();
    const rootCentre = root.left + root.width / 2;
    const tops = [...new Set(buttons.map(rowOf))];
    for (const top of tops) {
      const row = buttons.filter((el) => rowOf(el) === top);
      const left = Math.min(...row.map((el) => el.getBoundingClientRect().left));
      const right = Math.max(...row.map((el) => el.getBoundingClientRect().right));
      expect(Math.abs((left + right) / 2 - rootCentre)).toBeLessThan(1);
    }
  });
});
