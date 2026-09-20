import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { renderToString } from 'react-dom/server';
import { useState } from 'react';
import { afterEach, describe, expect, expectTypeOf, it } from 'vitest';
import { Switch, type SwitchProps } from './Switch';
import * as api from '../index';

const css = readFileSync(join(dirname(fileURLToPath(import.meta.url)), 'selection.module.css'), 'utf8');

afterEach(cleanup);

describe('Switch exports', () => {
  it('is a top-level primitive', () => {
    expect(api.Switch).toBe(Switch);
    expectTypeOf<SwitchProps>().toHaveProperty('children');
  });
});

describe('Switch', () => {
  it('toggles when the visible label is clicked', () => {
    render(<Switch>Play a sound on mention</Switch>);
    const input = screen.getByRole('switch', { name: 'Play a sound on mention' });
    expect(input).toHaveProperty('checked', false);
    fireEvent.click(screen.getByText('Play a sound on mention'));
    expect(input).toHaveProperty('checked', true);
  });

  it('is a checkbox input with role switch', () => {
    render(<Switch defaultChecked>Weekly digest</Switch>);
    const input = screen.getByRole('switch');
    expect(input).toHaveProperty('type', 'checkbox');
    expect(input.getAttribute('role')).toBe('switch');
    expect(input).toHaveProperty('checked', true);
  });

  it('is controlled from checked', () => {
    function Harness() {
      const [on, setOn] = useState(true);
      return (
        <Switch checked={on} onCheckedChange={setOn}>
          Weekly digest
        </Switch>
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
    const html = renderToString(<Switch>Weekly digest</Switch>);
    expect(html).toContain('role="switch"');
    expect(html).toContain('type="checkbox"');
    expect(html).toContain('Weekly digest');
  });
});
