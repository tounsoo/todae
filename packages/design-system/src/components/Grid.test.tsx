import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { Grid } from './Grid.js';

afterEach(cleanup);

describe('Grid', () => {
  it('sets a fixed column count', () => {
    render(<Grid.Root columns={3} data-testid="g" />);
    const grid = screen.getByTestId('g');
    expect(grid.getAttribute('data-layout')).toBe('columns');
    expect(grid.style.getPropertyValue('--todae-grid-column-count')).toBe('3');
  });

  it('fills the width with columns no narrower than minItemSize', () => {
    render(<Grid.Root minItemSize="12rem" data-testid="g" />);
    const grid = screen.getByTestId('g');
    expect(grid.getAttribute('data-layout')).toBe('fill');
    expect(grid.style.getPropertyValue('--_min-item-size')).toBe('12rem');
  });

  it('takes the tracks from the caller when neither prop is set, and floors the column count at 1', () => {
    render(<Grid.Root style={{ gridTemplateColumns: '16rem 1fr' }} data-testid="g" />);
    const grid = screen.getByTestId('g');
    expect(grid.hasAttribute('data-layout')).toBe(false);
    expect(grid.style.gridTemplateColumns).toBe('16rem 1fr');
    cleanup();
    render(<Grid.Root columns={0} data-testid="g" />);
    expect(screen.getByTestId('g').style.getPropertyValue('--todae-grid-column-count')).toBe('1');
    cleanup();
    render(<Grid.Root columns={Infinity} data-testid="g" />);
    expect(screen.getByTestId('g').style.getPropertyValue('--todae-grid-column-count')).toBe('1');
    cleanup();
    render(<Grid.Root minItemSize="" data-testid="g" />);
    expect(screen.getByTestId('g').hasAttribute('data-layout')).toBe(false);
  });

  it('keeps the caller style', () => {
    render(<Grid.Root columns={2} style={{ alignItems: 'start' }} data-testid="g" />);
    expect(screen.getByTestId('g').style.alignItems).toBe('start');
  });
});
