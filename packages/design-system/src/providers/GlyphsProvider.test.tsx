import { act, cleanup, fireEvent, render, renderHook, screen } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  Alert,
  BottomSheet,
  Breadcrumbs,
  Checkbox,
  Chip,
  Composer,
  Dialog,
  Disclosure,
  Drilldown,
  Field,
  GlyphsProvider,
  Menu,
  OptionList,
  Pagination,
  Steps,
  Table,
  Toast,
  useGlyphs,
  type Glyphs,
} from '../index.js';
import { Breadcrumbs as ServerBreadcrumbs } from '../server/breadcrumbs.js';
import { Disclosure as ServerDisclosure } from '../server/disclosure.js';
import { Pagination as ServerPagination } from '../server/pagination.js';

afterEach(cleanup);

const components = join(import.meta.dirname, '..', 'components');
const sheet = (name: string) => readFileSync(join(components, name), 'utf8');

const ICONS: Required<Glyphs> = {
  close: <svg data-testid="close" />,
  check: <svg data-testid="check" />,
  chevron: <svg data-testid="chevron" />,
  indeterminate: <svg data-testid="indeterminate" />,
  sort: <svg data-testid="sort" />,
  separator: <svg data-testid="separator" />,
  ellipsis: <svg data-testid="ellipsis" />,
  calendar: <svg data-testid="calendar" />,
  clock: <svg data-testid="clock" />,
  plus: <svg data-testid="plus" />,
  minus: <svg data-testid="minus" />,
  send: <svg data-testid="send" />,
  stop: <svg data-testid="stop" />,
  error: <svg data-testid="error" />,
  back: <svg data-testid="back" />,
};

function withIcons(children: ReactNode, glyphs: Glyphs = ICONS) {
  return <GlyphsProvider glyphs={glyphs}>{children}</GlyphsProvider>;
}

describe('GlyphsProvider', () => {
  it('sets nothing without a provider, merges nested providers, and resets a key with null', () => {
    expect(renderHook(() => useGlyphs()).result.current).toEqual({});
    const outer = { close: 'x', check: 'v' };
    const { result } = renderHook(() => useGlyphs(), {
      wrapper: ({ children }) => (
        <GlyphsProvider glyphs={outer}>
          <GlyphsProvider glyphs={{ close: undefined, check: null, chevron: 'c' }}>{children}</GlyphsProvider>
        </GlyphsProvider>
      ),
    });
    expect(result.current).toEqual({ close: 'x', check: null, chevron: 'c' });
  });

  it("gives empty close parts the close glyph as an icon-only button, else Todae's cross; content still wins", () => {
    const parts = (
      <>
        <Alert.Root>
          <Alert.Close />
        </Alert.Root>
        {/* Outside a region it has no toast to dismiss, but renders the same. */}
        <Toast.Close />
        <Dialog.Root open>
          <Dialog.Close />
        </Dialog.Root>
        <BottomSheet.Root open>
          <BottomSheet.Close />
        </BottomSheet.Root>
      </>
    );
    const { rerender } = render(parts);
    const closes = [
      ...screen.getAllByRole('button', { name: 'Dismiss', hidden: true }),
      ...screen.getAllByRole('button', { name: 'Close', hidden: true }),
    ];
    expect(closes).toHaveLength(4);
    for (const button of closes) {
      // A Button.Icon holding Todae's cross, so the button is icon-only.
      expect(button.querySelector('[data-todae-button-icon] > svg')).not.toBeNull();
      expect(button.textContent).toBe('');
    }
    rerender(withIcons(parts));
    expect(screen.getAllByTestId('close')).toHaveLength(4);
    rerender(
      withIcons(
        <Alert.Root>
          <Alert.Close>Got it</Alert.Close>
        </Alert.Root>,
      ),
    );
    expect(screen.getByRole('button', { name: 'Got it' })).toBeTruthy();
    expect(screen.queryByTestId('close')).toBeNull();
  });

  it("shows no tooltip on a close with Todae's own content, as a text × never did", () => {
    vi.useFakeTimers();
    try {
      render(
        <Alert.Root>
          <Alert.Close />
        </Alert.Root>,
      );
      fireEvent.pointerEnter(screen.getByRole('button', { name: 'Dismiss' }));
      act(() => {
        vi.advanceTimersByTime(1000);
      });
      expect(screen.queryByRole('tooltip')).toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });

  it('treats false and an empty string like an unset glyph', () => {
    render(
      withIcons(
        <>
          <Checkbox.Root>Terms</Checkbox.Root>
          <Alert.Root>
            <Alert.Close />
          </Alert.Root>
          <Disclosure.Root>
            <Disclosure.Summary>More</Disclosure.Summary>
          </Disclosure.Root>
        </>,
        { check: false, close: '', chevron: false },
      ),
    );
    expect(screen.getByRole('checkbox').parentElement!.querySelector('[data-todae-glyph] > svg')).not.toBeNull();
    expect(screen.getByRole('button', { name: 'Dismiss' }).querySelector('svg')).not.toBeNull();
    expect(screen.getByText('More').hasAttribute('data-glyph')).toBe(false);
  });

  it('uses the close glyph for chip remove buttons unless removeIcon is set', () => {
    const { rerender } = render(withIcons(<Chip.Root onRemove={() => undefined}>Alpha</Chip.Root>));
    expect(screen.getByRole('button', { name: 'Remove Alpha' }).contains(screen.getByTestId('close'))).toBe(true);
    rerender(
      withIcons(
        <Chip.Root onRemove={() => undefined} removeIcon={<svg data-testid="own" />}>
          Alpha
        </Chip.Root>,
      ),
    );
    expect(screen.getByTestId('own')).toBeTruthy();
    expect(screen.queryByTestId('close')).toBeNull();
  });

  it('uses the check glyph in Checkbox, Menu.CheckboxItem and a selected OptionList.Option, hidden from screen readers', () => {
    render(
      withIcons(
        <>
          <Checkbox.Root>Terms</Checkbox.Root>
          <Menu.Root>
            <Menu.Trigger>Actions</Menu.Trigger>
            <Menu.Content>
              <Menu.CheckboxItem checked>Grid</Menu.CheckboxItem>
            </Menu.Content>
          </Menu.Root>
          <OptionList.Root value="a" onValueChange={() => undefined} aria-label="Fruit">
            <OptionList.Option value="a">Apple</OptionList.Option>
            <OptionList.Option value="b">Banana</OptionList.Option>
          </OptionList.Root>
        </>,
      ),
    );
    const checks = screen.getAllByTestId('check');
    expect(checks).toHaveLength(3);
    for (const check of checks) expect(check.closest('[aria-hidden="true"]')).not.toBeNull();
    // Only the selected option draws one, and it does not change the option's name.
    expect(screen.getByRole('option', { name: 'Apple' }).contains(checks[2]!)).toBe(true);
    expect(screen.getByRole('option', { name: 'Banana' }).querySelector('svg')).toBeNull();
  });

  it("draws Todae's check where no provider sets one", () => {
    render(<Checkbox.Root>Terms</Checkbox.Root>);
    expect(screen.getByRole('checkbox').parentElement!.querySelector('[aria-hidden="true"] > [data-todae-glyph] > svg')).not.toBeNull();
  });

  it('draws the chevron glyph after Field.Select and in Disclosure.Summary, else keeps the native marker', () => {
    const select = (
      <Field.Root>
        <Field.Select aria-label="Plan" value="a" onValueChange={() => undefined}>
          <option value="a">A</option>
        </Field.Select>
      </Field.Root>
    );
    const { rerender, container } = render(
      <>
        {select}
        <Disclosure.Root>
          <Disclosure.Summary>More</Disclosure.Summary>
        </Disclosure.Root>
      </>,
    );
    expect(container.querySelector('select + span')).toBeNull();
    expect(container.querySelector('summary')!.hasAttribute('data-glyph')).toBe(false);
    rerender(
      withIcons(
        <>
          {select}
          <Disclosure.Root>
            <Disclosure.Summary>More</Disclosure.Summary>
          </Disclosure.Root>
          <ServerDisclosure.Root>
            <ServerDisclosure.Summary>Server</ServerDisclosure.Summary>
          </ServerDisclosure.Root>
        </>,
      ),
    );
    const [afterSelect, inSummary] = screen.getAllByTestId('chevron');
    expect(afterSelect!.parentElement!.previousElementSibling!.tagName).toBe('SELECT');
    expect(afterSelect!.parentElement!.getAttribute('aria-hidden')).toBe('true');
    const summary = inSummary!.closest('summary')!;
    expect(summary.hasAttribute('data-glyph')).toBe(true);
    expect(summary.textContent).toBe('More');
    // The server entry reads no context.
    expect(screen.getByText('Server').hasAttribute('data-glyph')).toBe(false);
  });

  it('draws the separator glyph between breadcrumbs, unless the trail sets its own separator', () => {
    const items = (
      <>
        <Breadcrumbs.Item>
          <a href="/">Home</a>
        </Breadcrumbs.Item>
        <Breadcrumbs.Item current>Page</Breadcrumbs.Item>
      </>
    );
    const { rerender } = render(withIcons(<Breadcrumbs.Root>{items}</Breadcrumbs.Root>));
    const separators = screen.getAllByTestId('separator');
    // Every item holds one; CSS hides the first.
    expect(separators).toHaveLength(2);
    expect(separators[1]!.parentElement!.getAttribute('aria-hidden')).toBe('true');
    // Outside the current page's aria-current span.
    expect(separators[1]!.closest('[aria-current]')).toBeNull();
    rerender(withIcons(<Breadcrumbs.Root separator="›">{items}</Breadcrumbs.Root>));
    expect(screen.queryByTestId('separator')).toBeNull();
    rerender(
      withIcons(
        <ServerBreadcrumbs.Root>
          <ServerBreadcrumbs.Item>Home</ServerBreadcrumbs.Item>
        </ServerBreadcrumbs.Root>,
      ),
    );
    expect(screen.queryByTestId('separator')).toBeNull();
  });

  it('uses the ellipsis glyph for an empty Pagination.Ellipsis, else "…"; content still wins', () => {
    const { rerender, container } = render(
      <Pagination.Root>
        <Pagination.Ellipsis />
      </Pagination.Root>,
    );
    expect(container.querySelector('li')!.textContent).toBe('…');
    rerender(
      withIcons(
        <Pagination.Root>
          <Pagination.Ellipsis />
          <Pagination.Ellipsis>...</Pagination.Ellipsis>
          <ServerPagination.Ellipsis />
        </Pagination.Root>,
      ),
    );
    expect(screen.getAllByTestId('ellipsis')).toHaveLength(1);
    const [, own, server] = container.querySelectorAll('li');
    expect(own!.textContent).toBe('...');
    expect(server!.textContent).toBe('…');
  });

  it('uses the send and stop glyphs for an empty Composer.Submit; content still wins', () => {
    const composer = (busy: boolean) =>
      withIcons(
        <Composer.Root busy={busy}>
          <Composer.Submit onStop={() => {}} />
          <Composer.Submit onStop={() => {}}>Go</Composer.Submit>
        </Composer.Root>,
      );
    const { rerender } = render(composer(false));
    expect(screen.getAllByTestId('send')).toHaveLength(1);
    rerender(composer(true));
    expect(screen.queryByTestId('send')).toBeNull();
    expect(screen.getAllByTestId('stop')).toHaveLength(1);
  });

  it("uses the back glyph for an empty Drilldown.Back, else Todae's chevron, on a wrapper that mirrors in right-to-left", () => {
    const back = (glyphs?: Glyphs) =>
      withIcons(
        <Drilldown.Root defaultValue={['a', 'b']}>
          <Drilldown.Back />
          <Drilldown.Back>Done</Drilldown.Back>
        </Drilldown.Root>,
        glyphs,
      );
    const { rerender } = render(back());
    expect(screen.getAllByTestId('back')).toHaveLength(1);
    expect(screen.getByTestId('back').parentElement?.hasAttribute('data-todae-glyph')).toBe(true);
    rerender(back({}));
    expect(screen.getByRole('button', { name: 'Back' }).querySelector('[data-todae-glyph] > svg')).toBeTruthy();
    expect(sheet('Drilldown.module.css')).toMatch(/\.glyph > :is\(svg, img\) \{[^}]*inline-size: 100%;/);
    expect(sheet('Drilldown.module.css')).toMatch(/\.backIcon > \[data-todae-glyph\]:dir\(rtl\) \{\s*scale: -1 1;/);
  });

  it('uses the check and error glyphs for done and failed Steps.Item markers', () => {
    render(
      withIcons(
        <Steps.Root>
          <Steps.Item status="done">A</Steps.Item>
          <Steps.Item status="error">B</Steps.Item>
          <Steps.Item>C</Steps.Item>
        </Steps.Root>,
      ),
    );
    expect(screen.getAllByTestId('check')).toHaveLength(1);
    expect(screen.getAllByTestId('error')).toHaveLength(1);
    expect(sheet('Steps.module.css')).toMatch(/\.marker > \[data-todae-glyph\] > :is\(svg, img\) \{[^}]*inline-size: var\(--todae-steps-icon-size\);/);
  });

  it('uses the sort glyph in Table.SortButton and the indeterminate glyph in a mixed Checkbox.Root', () => {
    render(
      withIcons(
        <>
          <table>
            <thead>
              <tr>
                <Table.HeaderCell scope="col" sort="ascending">
                  <Table.SortButton>Name</Table.SortButton>
                </Table.HeaderCell>
              </tr>
            </thead>
          </table>
          <Checkbox.Root indeterminate>All</Checkbox.Root>
        </>,
      ),
    );
    expect(screen.getAllByTestId('sort')).toHaveLength(1);
    expect(screen.getAllByTestId('indeterminate')).toHaveLength(1);
    expect(screen.queryByTestId('check')).toBeNull();
    expect(sheet('Table.module.css')).toMatch(/\[data-sort='descending'\] \.sortButton > \[data-todae-glyph\] \{\s*rotate: 180deg;/);
  });

  it('sizes glyphs in each part from its tokens, and turns or mirrors directional ones', () => {
    expect(sheet('Button.module.css')).toMatch(/\.icon > :is\(svg, img\) \{[^}]*inline-size: var\(--todae-button-icon-size\);/);
    expect(sheet('Field.module.css')).toMatch(/\.icon > :is\(svg, img\),\s*\.selectGlyph > :is\(svg, img\) \{[^}]*inline-size: var\(--todae-field-icon-size\);/);
    expect(sheet('Alert.module.css')).toMatch(/\.icon > :is\(svg, img\) \{[^}]*inline-size: var\(--todae-alert-icon-size\);/);
    expect(sheet('Toast.module.css')).toMatch(/\.icon > :is\(svg, img\) \{[^}]*inline-size: var\(--todae-toast-icon-size\);/);
    expect(sheet('Chip.module.css')).toMatch(/\.dismiss > :is\(svg, img\) \{[^}]*inline-size: var\(--todae-chip-icon-size\);/);
    // State goes on the wrapper, so a glyph that is text or a wrapped icon turns too.
    expect(sheet('Disclosure.module.css')).toMatch(/\.root:not\(\[open\]\) > \.summary > \[data-todae-glyph\] \{\s*rotate: -90deg;/);
    expect(sheet('Disclosure.module.css')).toMatch(/:dir\(rtl\) > \[data-todae-glyph\] \{\s*rotate: 90deg;/);
    expect(sheet('Breadcrumbs.module.css')).toMatch(/\.item > \[data-todae-glyph\]:dir\(rtl\) \{\s*scale: -1 1;/);
    // Only where the picker icon can be hidden, so two arrows never show.
    expect(sheet('Field.module.css')).toMatch(/@supports selector\(::picker-icon\) \{[\s\S]*\.select:has\(\+ \.selectGlyph:last-child\)::picker-icon \{\s*visibility: hidden;/);
  });
});
