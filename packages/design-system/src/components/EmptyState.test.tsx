import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { renderToString } from 'react-dom/server';
import { EmptyState, type EmptyStateTitleAs } from './EmptyState.js';

afterEach(cleanup);

describe('EmptyState', () => {
  it('renders its parts in order with no role on the root', () => {
    render(
      <EmptyState.Root data-testid="empty">
        <EmptyState.Icon>
          <svg />
        </EmptyState.Icon>
        <EmptyState.Title>No projects yet</EmptyState.Title>
        <EmptyState.Description>Create one to get started.</EmptyState.Description>
        <EmptyState.Actions>
          <button type="button">New project</button>
        </EmptyState.Actions>
      </EmptyState.Root>,
    );
    const root = screen.getByTestId('empty');
    expect(root.tagName).toBe('DIV');
    expect(root.getAttribute('role')).toBeNull();
    expect([...root.children].map((child) => child.tagName)).toEqual(['SPAN', 'H2', 'DIV', 'DIV']);
    expect(screen.getByRole('heading', { level: 2 }).textContent).toBe('No projects yet');
  });

  it.each<[EmptyStateTitleAs, string]>([
    ['h2', 'H2'],
    ['h3', 'H3'],
    ['h4', 'H4'],
    ['h5', 'H5'],
    ['h6', 'H6'],
    ['p', 'P'],
  ])('renders the title as %s', (as, tag) => {
    render(<EmptyState.Title as={as}>Nothing here</EmptyState.Title>);
    expect(screen.getByText('Nothing here').tagName).toBe(tag);
  });

  it('hides the icon from assistive technology unless it says otherwise', () => {
    render(
      <>
        <EmptyState.Icon data-testid="plain" />
        <EmptyState.Icon data-testid="named" aria-hidden={false} role="img" aria-label="Empty" />
      </>,
    );
    expect(screen.getByTestId('plain').getAttribute('aria-hidden')).toBe('true');
    expect(screen.getByTestId('named').getAttribute('aria-hidden')).toBe('false');
  });

  it('renders on the server', () => {
    const html = renderToString(<EmptyState.Title as="h3">None</EmptyState.Title>);
    expect(html).toContain('<h3');
  });
});
