import { act, cleanup, render, screen } from '@testing-library/react';
import { useRef } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { Coachmark } from './Coachmark.js';

afterEach(cleanup);

// The scrim dims by box-shadow, which takes no pointer: only `inert` keeps
// the dim page from being pressed.
describe('Coachmark whose target controls an element that holds it', () => {
  it('keeps the rest of that element inert (a collapse toggle inside the sidebar it controls)', async () => {
    function Tour() {
      const targetRef = useRef<HTMLButtonElement | null>(null);
      return (
        <>
          <nav id="sidebar">
            <a href="#billing">Billing</a>
            <button type="button" ref={targetRef} aria-controls="sidebar" aria-expanded="true">
              Collapse
            </button>
          </nav>
          <main>
            <button type="button">Delete account</button>
          </main>
          <Coachmark.Root targetRef={targetRef} defaultOpen aria-label="Collapse">
            <Coachmark.Title>Collapse the sidebar</Coachmark.Title>
          </Coachmark.Root>
        </>
      );
    }
    render(<Tour />);
    await act(async () => {});
    expect(screen.getByText('Delete account').closest('[inert]')).not.toBeNull();
    expect(screen.getByText('Collapse').closest('[inert]')).toBeNull();
    // The sidebar holds the target, so only the target stays usable in it.
    expect(screen.getByText('Billing').closest('[inert]')).not.toBeNull();
  });

  it('keeps the page inert when the target controls a wrapper around the page', async () => {
    function Tour() {
      const targetRef = useRef<HTMLButtonElement | null>(null);
      return (
        <div id="app">
          <header>
            <button type="button" ref={targetRef} aria-controls="app" aria-pressed="false">
              Compact mode
            </button>
          </header>
          <main>
            <button type="button">Delete account</button>
          </main>
          <Coachmark.Root targetRef={targetRef} defaultOpen aria-label="Compact">
            <Coachmark.Title>Try compact mode</Coachmark.Title>
          </Coachmark.Root>
        </div>
      );
    }
    render(<Tour />);
    await act(async () => {});
    expect(screen.getByText('Delete account').closest('[inert]')).not.toBeNull();
  });
});
