import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Alert, type AlertTone } from './Alert.js';
import { renderToString } from 'react-dom/server';

afterEach(cleanup);

describe('Alert', () => {
  it.each<[AlertTone, string]>([
    ['info', 'status'],
    ['success', 'status'],
    ['warning', 'alert'],
    ['critical', 'alert'],
  ])('gives a %s alert role="%s"', (tone, role) => {
    render(
      <Alert.Root tone={tone}>
        <Alert.Title>Saved</Alert.Title>
      </Alert.Root>,
    );
    const root = screen.getByRole(role);
    expect(root.getAttribute('data-tone')).toBe(tone);
    expect(root.textContent).toBe('Saved');
  });

  it('defaults to the info tone', () => {
    render(<Alert.Root>Note</Alert.Root>);
    expect(screen.getByRole('status').getAttribute('data-tone')).toBe('info');
  });

  it('keeps a role the caller passes', () => {
    render(
      <Alert.Root tone="critical" role="none" data-testid="a">
        Down
      </Alert.Root>,
    );
    expect(screen.getByTestId('a').getAttribute('role')).toBe('none');
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('hides the icon slot from assistive technology unless told otherwise', () => {
    render(
      <Alert.Root>
        <Alert.Icon data-testid="hidden">!</Alert.Icon>
        <Alert.Icon data-testid="shown" aria-hidden={false} role="img" aria-label="Warning">
          !
        </Alert.Icon>
      </Alert.Root>,
    );
    expect(screen.getByTestId('hidden').getAttribute('aria-hidden')).toBe('true');
    expect(screen.getByTestId('shown').getAttribute('aria-hidden')).toBe('false');
    expect(screen.getByRole('img', { name: 'Warning' })).toBe(screen.getByTestId('shown'));
  });

  it('renders a dismiss button that calls onClick', () => {
    const onClick = vi.fn();
    render(
      <Alert.Root>
        <Alert.Description>Text</Alert.Description>
        <Alert.Close onClick={onClick}>×</Alert.Close>
      </Alert.Root>,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Dismiss' }));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('names the close button by its visible text when it has some', () => {
    render(
      <Alert.Root>
        <Alert.Close>Got it</Alert.Close>
        <Alert.Close>
          <span>Hide</span> <span>notice</span>
        </Alert.Close>
      </Alert.Root>,
    );
    expect(screen.getByRole('button', { name: 'Got it' }).hasAttribute('aria-label')).toBe(false);
    expect(screen.getByRole('button', { name: 'Hide notice' }).hasAttribute('aria-label')).toBe(false);
  });

  it('keeps Dismiss for a glyph or hidden icon text', () => {
    render(
      <Alert.Root>
        <Alert.Close>x</Alert.Close>
        <Alert.Close>
          <svg aria-hidden="true">
            <title>Close</title>
          </svg>
        </Alert.Close>
        <Alert.Close>
          <span aria-hidden="true">Close</span>
        </Alert.Close>
      </Alert.Root>,
    );
    expect(screen.getAllByRole('button', { name: 'Dismiss' })).toHaveLength(3);
  });

  it('reads the rendered text, so a component that renders a label names the button', () => {
    function Translated() {
      return <>닫기</>;
    }
    render(
      <Alert.Root>
        <Alert.Close>
          <Translated />
        </Alert.Close>
      </Alert.Root>,
    );
    expect(screen.getByRole('button', { name: '닫기' }).hasAttribute('aria-label')).toBe(false);
  });

  it('lets the close button take its own label', () => {
    render(
      <Alert.Root>
        <Alert.Close aria-label="Hide notice">×</Alert.Close>
      </Alert.Root>,
    );
    expect(screen.getByRole('button', { name: 'Hide notice' })).toBeTruthy();
  });

  it('merges class names on every part', () => {
    render(
      <Alert.Root className="r" data-testid="root">
        <Alert.Icon className="i" data-testid="icon" />
        <Alert.Title className="t" data-testid="title" />
        <Alert.Description className="d" data-testid="desc" />
        <Alert.Actions className="a" data-testid="actions" />
        <Alert.Close className="c" data-testid="close" />
      </Alert.Root>,
    );
    for (const [id, cls] of [
      ['root', 'r'],
      ['icon', 'i'],
      ['title', 't'],
      ['desc', 'd'],
      ['actions', 'a'],
      ['close', 'c'],
    ]) {
      const el = screen.getByTestId(id!);
      expect(el.classList.contains(cls!)).toBe(true);
      expect(el.classList.length).toBeGreaterThan(1);
    }
  });
});

describe('Alert.Close server markup', () => {
  it('does not count SVG title text as a name', () => {
    const html = renderToString(
      <Alert.Close>
        <svg>
          <title>Close icon</title>
        </svg>
      </Alert.Close>,
    );
    expect(html).toContain('aria-label="Dismiss"');
  });
});
