import { Tree } from '@tounsoo/todae';
import { cleanup, render } from '@testing-library/react';
import { afterEach, expect, it } from 'vitest';
import { axeViolations } from './axeRun';

afterEach(cleanup);

/** An open branch. `extra` is text on its row outside its Tree.Label, so not in its name. */
function Files({ extra }: { extra?: string }) {
  return (
    <main>
      <Tree.Root aria-label="Files" defaultExpanded={['src']}>
      <Tree.Item value="src">
        <Tree.Label>src</Tree.Label>
        {extra ? <span>{extra}</span> : null}
        <Tree.Group>
          <Tree.Item value="src/index.ts">
            <Tree.Label>index.ts</Tree.Label>
          </Tree.Item>
          </Tree.Group>
        </Tree.Item>
      </Tree.Root>
    </main>
  );
}

it('passes an open tree item whose row matches its name, as axe-core#5505 would', async () => {
  render(<Files />);
  expect(await axeViolations()).toEqual([]);
  // The rule still runs: the child group is back on screen after the check.
  expect(document.querySelector<HTMLElement>('[role="group"]')!.hidden).toBe(false);
});

it('still reports an open tree item whose row is not in its name', async () => {
  render(<Files extra="3 files" />);
  expect((await axeViolations()).join('\n')).toContain('label-content-name-mismatch');
});

it('still reports a closed tree item whose row is not in its name', async () => {
  render(
    <main>
      <Tree.Root aria-label="Files">
        <Tree.Item value="readme">
          <Tree.Label>README.md</Tree.Label>
          <span>edited</span>
        </Tree.Item>
      </Tree.Root>
    </main>,
  );
  expect((await axeViolations()).join('\n')).toContain('label-content-name-mismatch');
});
