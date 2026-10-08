import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { Grid } from './Grid';

afterEach(cleanup);

describe('Grid', () => {
  it('sets a fixed column count', () => {
    render(<Grid columns={3} data-testid="g" />);
    const grid = screen.getByTestId('g');
    expect(grid.getAttribute('data-layout')).toBe('columns');
    expect(grid.style.getPropertyValue('--todae-grid-column-count')).toBe('3');
  });

  it('fills the width with columns no narrower than minItemSize', () => {
    render(<Grid minItemSize="12rem" data-testid="g" />);
    const grid = screen.getByTestId('g');
    expect(grid.getAttribute('data-layout')).toBe('fill');
    expect(grid.style.getPropertyValue('--todae-grid-min-item-size')).toBe('12rem');
  });

  it('keeps the caller style', () => {
    render(<Grid columns={2} style={{ alignItems: 'start' }} data-testid="g" />);
    expect(screen.getByTestId('g').style.alignItems).toBe('start');
  });
});
