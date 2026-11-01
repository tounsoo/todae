// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it } from 'vitest';
import { ChatComposerCard } from './ChatComposer';

afterEach(cleanup);

const field = () => screen.getByRole('textbox', { name: 'Message' }) as HTMLTextAreaElement;

it('does not send Enter during composition, and sends a plain Enter after compositionend', () => {
  render(<ChatComposerCard />);
  const before = field().value;
  expect(before).not.toBe('');

  fireEvent.keyDown(field(), { key: 'Enter', isComposing: true });
  expect(field().value).toBe(before);

  fireEvent.keyDown(field(), { key: 'Enter', keyCode: 229 });
  expect(field().value).toBe(before);

  fireEvent.compositionEnd(field());
  fireEvent.keyDown(field(), { key: 'Enter', keyCode: 13 });
  expect(field().value).toBe('');
});
