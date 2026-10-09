// @vitest-environment jsdom
import { cleanup, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PropsTableView, unionMembers, type PropsTableRow } from './PropsTableView';

const path = vi.hoisted(() => ({ current: '/' }));
vi.mock('next/navigation', () => ({ usePathname: () => path.current }));

beforeEach(() => {
  path.current = '/';
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe() {}
      disconnect() {}
    },
  );
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const row = (overrides: Partial<PropsTableRow>): PropsTableRow => ({
  name: 'tone',
  type: 'string',
  required: false,
  descriptions: { en: { text: 'English text.', lang: 'en' }, ko: { text: '한국어 설명.', lang: 'ko' } },
  ...overrides,
});

describe('unionMembers', () => {
  it('splits a union at its top level', () => {
    expect(unionMembers('"a" | "b" | "c"')).toEqual(['"a"', '"b"', '"c"']);
  });

  it('keeps unions inside parentheses, generics, arrays and strings whole', () => {
    expect(unionMembers('((value: string | null) => void) | ReadonlyArray<"a" | "b">')).toEqual([
      '((value: string | null) => void)',
      'ReadonlyArray<"a" | "b">',
    ]);
    expect(unionMembers('"x | y" | [a | b]')).toEqual(['"x | y"', '[a | b]']);
  });

  it('does not take an arrow for the end of a generic', () => {
    expect(unionMembers('Promise<(a: string) => void | number> | null')).toEqual([
      'Promise<(a: string) => void | number>',
      'null',
    ]);
  });

  it('leaves a type with no top-level union as one member', () => {
    expect(unionMembers('(event: ChangeEvent<HTMLInputElement>) => void')).toEqual([
      '(event: ChangeEvent<HTMLInputElement>) => void',
    ]);
  });
});

describe('PropsTableView', () => {
  it('has name, type and description columns, with required and default inside them', () => {
    render(
      <PropsTableView
        name="Field.TextInput"
        rows={[
          row({ name: 'value', required: true }),
          row({ name: 'type', type: '"text" | "search" | "email" | "url" | "tel" | "password"', default: '"text"' }),
        ]}
      />,
    );
    const table = screen.getByRole('table', { name: 'Field.TextInput props' });
    expect(within(table).getAllByRole('columnheader').map((cell) => cell.textContent)).toEqual([
      'Name',
      'Type',
      'Description',
    ]);
    const [, value, type] = within(table).getAllByRole('row');
    expect(within(value!).getByRole('rowheader').textContent).toBe('value Required');
    expect(within(type!).getByRole('rowheader').textContent).toBe('type');
    const [typeCell, descriptionCell] = within(type!).getAllByRole('cell');
    expect([...typeCell!.querySelectorAll('.props-type-member')].map((line) => line.textContent)).toEqual([
      '"text"',
      '| "search"',
      '| "email"',
      '| "url"',
      '| "tel"',
      '| "password"',
    ]);
    expect(descriptionCell!.textContent).toBe('English text.Default: "text"');
  });

  it('keeps a short union on one line', () => {
    render(<PropsTableView name="Badge.Root" rows={[row({ type: '"single" | "multiple"' })]} />);
    const code = screen.getByText('"single" | "multiple"');
    expect(code.querySelector('.props-type-member')).toBeNull();
  });

  it('labels in the page language and marks a fallback description with its own', () => {
    path.current = '/ko/badge';
    render(
      <PropsTableView
        name="Badge.Root"
        rows={[
          row({ name: 'tone', required: true, default: '"neutral"' }),
          row({ name: 'children', descriptions: { en: { text: 'Label.', lang: 'en' }, ko: { text: 'Label.', lang: 'en' } } }),
        ]}
      />,
    );
    const [, tone, children] = screen.getAllByRole('row');
    expect(within(tone!).getByRole('rowheader').textContent).toBe('tone 필수');
    expect(within(tone!).getAllByRole('cell')[1]!.textContent).toBe('한국어 설명.기본값: "neutral"');
    expect(within(children!).getByText('Label.').getAttribute('lang')).toBe('en');
  });
});
