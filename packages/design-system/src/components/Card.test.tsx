import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { Card } from './Card';

afterEach(cleanup);

describe('Card', () => {
  it('renders its parts in order with no roles of their own', () => {
    render(
      <Card.Root data-testid="card">
        <Card.Header>
          <h2>Plan</h2>
        </Card.Header>
        <Card.Body>Pro, billed yearly.</Card.Body>
        <Card.Footer>
          <button type="button">Change</button>
        </Card.Footer>
      </Card.Root>,
    );
    const card = screen.getByTestId('card');
    expect(card.getAttribute('role')).toBeNull();
    expect([...card.children].map((child) => child.textContent)).toEqual(['Plan', 'Pro, billed yearly.', 'Change']);
  });
});
