import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { renderToString } from 'react-dom/server';
import { useState } from 'react';
import { afterEach, describe, expect, expectTypeOf, it } from 'vitest';
import { Switch, type SwitchRootProps } from './Switch.js';
import * as api from '../index.js';

const css = readFileSync(join(dirname(fileURLToPath(import.meta.url)), 'selection.module.css'), 'utf8');

afterEach(cleanup);

describe('Switch exports', () => {
  it('is a top-level primitive', () => {
    expect(api.Switch).toBe(Switch);
    expectTypeOf<SwitchRootProps>().toHaveProperty('children');
  });
});

describe('Switch', () => {
  it('toggles when the visible label is clicked', () => {
    render(<Switch.Root>Play a sound on mention</Switch.Root>);
    const input = screen.getByRole('switch', { name: 'Play a sound on mention' });
    expect(input).toHaveProperty('checked', false);
    fireEvent.click(screen.getByText('Play a sound on mention'));
    expect(input).toHaveProperty('checked', true);
  });

  it('is a checkbox input with role switch', () => {
    render(<Switch.Root defaultChecked>Weekly digest</Switch.Root>);
    const input = screen.getByRole('switch');
    expect(input).toHaveProperty('type', 'checkbox');
    expect(input.getAttribute('role')).toBe('switch');
    expect(input).toHaveProperty('checked', true);
  });

  it('is controlled from checked', () => {
    function Harness() {
      const [on, setOn] = useState(true);
      return (
        <Switch.Root checked={on} onCheckedChange={setOn}>
          Weekly digest
        </Switch.Root>
      );
    }
    render(<Harness />);
    fireEvent.click(screen.getByRole('switch'));
    expect(screen.getByRole('switch')).toHaveProperty('checked', false);
  });

  it('paints a thumb, not a check glyph', () => {
    const thumb = css.match(/data-control='switch'\] \.indicator::after \{[\s\S]*?\}/)?.[0];
    expect(thumb).toContain('--todae-selection-thumb-bg');
    expect(thumb).not.toContain('--todae-selection-indicator-fg');
  });

  it('SSR keeps the switch role', () => {
    const html = renderToString(<Switch.Root>Weekly digest</Switch.Root>);
    expect(html).toContain('role="switch"');
    expect(html).toContain('type="checkbox"');
    expect(html).toContain('Weekly digest');
  });
});
