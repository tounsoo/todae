import { render, screen, waitFor } from '@testing-library/react';
import { userEvent } from '@vitest/browser/context';
import axe from 'axe-core';
import { useState, type CSSProperties, type ReactNode } from 'react';
import { hydrateRoot } from 'react-dom/client';
import { renderToString } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { Avatar, Button, DensityProvider, Description, ErrorMessage, Field, Grid, Label, Pagination, RadioGroup, Stack, Text, ThemeProvider, paginationRange } from '../index.js';

/** axe without its WCAG 2 contrast rule: Todae checks contrast with APCA when tokens build. */
async function violations(): Promise<string[]> {
  const result = await axe.run(document.body, { rules: { 'color-contrast': { enabled: false } } });
  return result.violations.map((v) => `${v.id}: ${v.help}\n  ${v.nodes.map((n) => n.target.join(' ')).join('\n  ')}`);
}

function Themed({ children }: { children: ReactNode }) {
  return (
    <main data-appearance="light" data-density="comfortable">
      {children}
    </main>
  );
}

const PIXEL =
  'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="8" height="8"><rect width="8" height="8" fill="red"/></svg>');

describe('Avatar in a browser', () => {
  it('shows a loaded image over the fallback space, and is one named image', async () => {
    render(
      <Themed>
        <Avatar.Root label="Ada Lovelace" data-testid="root">
          <Avatar.Image src={PIXEL} data-testid="img" />
          <Avatar.Fallback>AL</Avatar.Fallback>
        </Avatar.Root>
      </Themed>,
    );
    await waitFor(() => expect(screen.getByTestId('root').getAttribute('data-status')).toBe('loaded'));
    expect(screen.queryByText('AL')).toBeNull();
    const root = screen.getByTestId('root').getBoundingClientRect();
    const img = screen.getByTestId('img').getBoundingClientRect();
    expect(img.width).toBe(root.width);
    expect(img.height).toBe(root.height);
    expect(root.width).toBe(root.height);
    expect(getComputedStyle(screen.getByTestId('img')).visibility).toBe('visible');
    expect(await violations()).toEqual([]);
  });

  it('keeps the fallback, and hides the broken image, when it fails to load', async () => {
    render(
      <Themed>
        <Avatar.Root label="Ada Lovelace" data-testid="root">
          <Avatar.Image src="data:image/png;base64,broken" data-testid="img" />
          <Avatar.Fallback>AL</Avatar.Fallback>
        </Avatar.Root>
      </Themed>,
    );
    await waitFor(() => expect(screen.getByTestId('root').getAttribute('data-status')).toBe('error'));
    expect(screen.getByText('AL')).toBeTruthy();
    expect(getComputedStyle(screen.getByTestId('img')).visibility).toBe('hidden');
    expect(await violations()).toEqual([]);
  });

  it('hides the old image while a new src loads, so the fallback shows', async () => {
    const other =
      'data:image/svg+xml,' +
      encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="8" height="8"><rect width="8" height="8" fill="blue"/></svg>');
    const tree = (src: string) => (
      <Themed>
        <Avatar.Root data-testid="root">
          <Avatar.Image src={src} data-testid="img" />
          <Avatar.Fallback>AL</Avatar.Fallback>
        </Avatar.Root>
      </Themed>
    );
    const { rerender } = render(tree(PIXEL));
    await waitFor(() => expect(screen.getByTestId('root').getAttribute('data-status')).toBe('loaded'));
    rerender(tree(other));
    expect(screen.getByTestId('root').getAttribute('data-status')).toBe('loading');
    expect(getComputedStyle(screen.getByTestId('img')).visibility).toBe('hidden');
    expect(screen.getByText('AL')).toBeTruthy();
    await waitFor(() => expect(screen.getByTestId('root').getAttribute('data-status')).toBe('loaded'));
    expect(getComputedStyle(screen.getByTestId('img')).visibility).toBe('visible');
  });

  it('reads an image that loaded before hydration, an SVG with no intrinsic size included', async () => {
    // Only a viewBox: some engines report a natural width of 0 for it.
    const viewBoxOnly =
      'data:image/svg+xml,' +
      encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 8 8"><rect width="8" height="8"/></svg>');
    const tree = (
      <Themed>
        <Avatar.Root data-testid="root">
          <Avatar.Image src={viewBoxOnly} />
          <Avatar.Fallback>AL</Avatar.Fallback>
        </Avatar.Root>
      </Themed>
    );
    const container = document.createElement('div');
    container.innerHTML = renderToString(tree);
    document.body.append(container);
    const img = container.querySelector('img')!;
    // The load event fires before React attaches its handlers, as on a server-rendered page.
    if (!img.complete) await new Promise((resolve) => img.addEventListener('load', resolve, { once: true }));
    // Before hydration the loaded image already shows over the fallback.
    expect(getComputedStyle(img).visibility).toBe('visible');
    const root = hydrateRoot(container, tree);
    try {
      await waitFor(() => expect(container.querySelector('[data-testid="root"]')!.getAttribute('data-status')).toBe('loaded'));
    } finally {
      root.unmount();
      container.remove();
    }
  });

  it('draws at avatar.size, and at a length a product sets on it or around it', () => {
    render(
      <Themed>
        <Avatar.Root data-testid="bare">
          <Avatar.Fallback data-testid="bare-fallback">AL</Avatar.Fallback>
        </Avatar.Root>
        <div style={{ '--todae-avatar-size': '2.5rem' } as CSSProperties}>
          <Avatar.Root data-testid="large">
            <Avatar.Fallback data-testid="large-fallback">AL</Avatar.Fallback>
          </Avatar.Root>
        </div>
      </Themed>,
    );
    const box = (id: string) => screen.getByTestId(id).getBoundingClientRect();
    expect([box('bare').width, box('bare').height]).toEqual([32, 32]);
    expect([box('large').width, box('large').height]).toEqual([40, 40]);
    expect(getComputedStyle(screen.getByTestId('large-fallback')).fontSize).toBe('16px');
  });

  it('draws at the avatar.size a ThemeProvider overrides', () => {
    render(
      <ThemeProvider overrides={{ 'avatar.size': { value: 1.5, unit: 'rem' } }}>
        <Avatar.Root data-testid="themed" />
      </ThemeProvider>,
    );
    expect(screen.getByTestId('themed').getBoundingClientRect().width).toBe(24);
  });

  it('drops a size set on an ancestor when a density element sits between them', () => {
    render(
      <Themed>
        <div style={{ '--todae-avatar-size': '1.5rem' } as CSSProperties}>
          <DensityProvider density="compact">
            <Avatar.Root data-testid="nested" />
          </DensityProvider>
        </div>
      </Themed>,
    );
    expect(screen.getByTestId('nested').getBoundingClientRect().width).toBe(32);
  });
});

describe('Grid in a browser', () => {
  it('lays out a fixed number of equal columns', () => {
    render(
      <Themed>
        <div style={{ width: 600 }}>
          <Grid.Root columns={3} data-testid="grid">
            <div data-testid="a">A</div>
            <div data-testid="b">B</div>
            <div data-testid="c">C</div>
            <div data-testid="d">D</div>
          </Grid.Root>
        </div>
      </Themed>,
    );
    const box = (id: string) => screen.getByTestId(id).getBoundingClientRect();
    expect(box('a').top).toBe(box('c').top);
    expect(box('d').top).toBeGreaterThan(box('a').top);
    expect(box('d').left).toBe(box('a').left);
    expect(box('a').width).toBe(box('b').width);
  });

  it('fits as many columns as the width allows, and never overflows a narrow container', () => {
    render(
      <Themed>
        <div style={{ width: 400 }}>
          <Grid.Root minItemSize="150px" data-testid="wide">
            <div data-testid="w1">1</div>
            <div data-testid="w2">2</div>
            <div data-testid="w3">3</div>
          </Grid.Root>
        </div>
        <div style={{ width: 100 }}>
          <Grid.Root minItemSize="150px" data-testid="narrow">
            <div data-testid="n1">1</div>
          </Grid.Root>
        </div>
      </Themed>,
    );
    const box = (id: string) => screen.getByTestId(id).getBoundingClientRect();
    expect(box('w1').top).toBe(box('w2').top);
    expect(box('w3').top).toBeGreaterThan(box('w1').top);
    expect(box('n1').width).toBeLessThanOrEqual(100);
  });
});

describe('Pagination in a browser', () => {
  function Pages({ initial = 10 }: { initial?: number }) {
    const [page, setPage] = useState(initial);
    const count = 20;
    const step = (to: number, label: string, id: string) => (
      <Pagination.Item>
        <button
          type="button"
          data-testid={id}
          aria-disabled={to < 1 || to > count ? true : undefined}
          onClick={() => to >= 1 && to <= count && setPage(to)}
        >
          {label}
        </button>
      </Pagination.Item>
    );
    return (
      <Themed>
        <Pagination.Root>
          {step(page - 1, 'Previous', 'prev')}
          {paginationRange({ page, count }).map((item) =>
            typeof item === 'number' ? (
              <Pagination.Item key={item}>
                <button
                  type="button"
                  data-testid={`page-${item}`}
                  aria-current={item === page ? 'page' : undefined}
                  onClick={() => setPage(item)}
                >
                  {item}
                </button>
              </Pagination.Item>
            ) : (
              <Pagination.Ellipsis key={item} />
            ),
          )}
          {step(page + 1, 'Next', 'next')}
        </Pagination.Root>
      </Themed>
    );
  }

  it('fills the current page, drops the link underline, mutes a step with nowhere to go, and passes axe', async () => {
    render(
      <Themed>
        <Pagination.Root>
          <Pagination.Item>
            <a role="link" aria-disabled="true" data-testid="prev">
              Previous
            </a>
          </Pagination.Item>
          <Pagination.Item>
            <a href="#page-1" data-testid="page-1">
              1
            </a>
          </Pagination.Item>
          <Pagination.Item>
            <a href="#page-2" aria-current="page" data-testid="page-2">
              2
            </a>
          </Pagination.Item>
          <Pagination.Ellipsis />
        </Pagination.Root>
      </Themed>,
    );
    const style = (id: string) => getComputedStyle(screen.getByTestId(id));
    expect(style('page-1').textDecorationLine).toBe('none');
    expect(style('page-2').backgroundColor).not.toBe(style('page-1').backgroundColor);
    expect(style('prev').color).not.toBe(style('page-1').color);
    expect(await violations()).toEqual([]);
  });

  it('draws a current page without href as current, not muted', () => {
    render(
      <Themed>
        <Pagination.Root>
          <Pagination.Item>
            <a href="#page-1" aria-current="page" data-testid="linked">
              1
            </a>
          </Pagination.Item>
          <Pagination.Item>
            <a aria-current="page" data-testid="plain">
              2
            </a>
          </Pagination.Item>
        </Pagination.Root>
      </Themed>,
    );
    const linked = getComputedStyle(screen.getByTestId('linked'));
    const plain = getComputedStyle(screen.getByTestId('plain'));
    expect(plain.color).toBe(linked.color);
    expect(plain.backgroundColor).toBe(linked.backgroundColor);
    expect(plain.cursor).not.toBe('default');
  });

  it('keeps focus on the control the user pressed, at the ends too', async () => {
    render(<Pages initial={2} />);
    await userEvent.click(screen.getByTestId('page-3'));
    expect(document.activeElement).toBe(screen.getByTestId('page-3'));
    expect(screen.getByTestId('page-3').getAttribute('aria-current')).toBe('page');
    await userEvent.click(screen.getByTestId('prev'));
    await userEvent.click(screen.getByTestId('prev'));
    expect(document.activeElement).toBe(screen.getByTestId('prev'));
    expect(screen.getByTestId('prev').getAttribute('aria-disabled')).toBe('true');
    // The current page keeps its fill under the pointer.
    const fill = getComputedStyle(screen.getByTestId('page-1')).backgroundColor;
    await userEvent.hover(screen.getByTestId('page-1'));
    expect(getComputedStyle(screen.getByTestId('page-1')).backgroundColor).toBe(fill);
    expect(await violations()).toEqual([]);
  });

  it('gives an ordered list the list role, and lets a role you pass win', () => {
    render(
      <Themed>
        <Stack.Root as="ol" data-testid="ordered">
          <li>One</li>
        </Stack.Root>
        <Stack.Root as="ul" role="none" data-testid="plain">
          <li>One</li>
        </Stack.Root>
        <Stack.Root as="nav" aria-label="Pages" data-testid="nav" />
      </Themed>,
    );
    expect(screen.getByTestId('ordered').tagName).toBe('OL');
    expect(screen.getByTestId('ordered').getAttribute('role')).toBe('list');
    expect(screen.getByTestId('plain').getAttribute('role')).toBe('none');
    expect(screen.getByTestId('nav').hasAttribute('role')).toBe(false);
  });
});

describe('A button in a Field.Root', () => {
  const icon = (
    <Button.Icon>
      <svg viewBox="0 0 16 16" />
    </Button.Icon>
  );

  it.each(['comfortable', 'compact', 'spacious'])(
    'keeps a %s field one line tall, with an icon-only Button.Root before or after the input',
    (density) => {
      render(
        <main data-appearance="light" data-density={density}>
          <Field.Root aria-label="Plain" data-testid="plain">
            <Field.TextInput value="" onChange={() => {}} />
          </Field.Root>
          <Field.Root aria-label="Password" data-testid="after">
            <Field.TextInput type="password" value="" onChange={() => {}} />
            <Button.Root variant="ghost" aria-label="Show password" pressed={false}>
              {icon}
            </Button.Root>
          </Field.Root>
          <Field.Root aria-label="Search" data-testid="before">
            <Button.Root variant="ghost" aria-label="Clear search">
              {icon}
            </Button.Root>
            <Field.TextInput value="" onChange={() => {}} />
          </Field.Root>
        </main>,
      );
      const plain = screen.getByTestId('plain').getBoundingClientRect();
      for (const [id, name] of [
        ['after', 'Show password'],
        ['before', 'Clear search'],
      ] as const) {
        const shell = screen.getByTestId(id).getBoundingClientRect();
        const button = screen.getByRole('button', { name }).getBoundingClientRect();
        const size = parseFloat(getComputedStyle(document.documentElement).fontSize) * 1.5;
        expect(shell.height).toBe(plain.height);
        // field.action.size is 1.5rem, and Button's own icon-only padding doesn't apply.
        expect([button.width, button.height]).toEqual([size, size]);
        expect(getComputedStyle(screen.getByRole('button', { name })).paddingInlineStart).toBe('0px');
        expect(Math.abs(button.top + button.height / 2 - (shell.top + shell.height / 2))).toBeLessThan(0.5);
      }
    },
  );
});

describe('An Icon and a button beside a Field.Select', () => {
  it.each(['comfortable', 'compact', 'spacious'])('are centered on a %s select, which keeps its height', (density) => {
    const select = (
      <Field.Select value="a" onValueChange={() => {}}>
        <option value="a">Apple</option>
      </Field.Select>
    );
    render(
      <main data-appearance="light" data-density={density}>
        <Field.Root aria-label="Plain" data-testid="plain">
          {select}
        </Field.Root>
        <Field.Root aria-label="Fruit" data-testid="fruit">
          <Field.Icon data-testid="icon">
            <svg viewBox="0 0 16 16" />
          </Field.Icon>
          {select}
          <Button.Root variant="ghost" aria-label="Clear fruit">
            <Button.Icon>
              <svg viewBox="0 0 16 16" />
            </Button.Icon>
          </Button.Root>
        </Field.Root>
      </main>,
    );
    const shell = screen.getByTestId('fruit').getBoundingClientRect();
    expect(shell.height).toBe(screen.getByTestId('plain').getBoundingClientRect().height);
    const middle = shell.top + shell.height / 2;
    for (const part of [screen.getByTestId('icon'), screen.getByRole('button', { name: 'Clear fruit' })]) {
      const box = part.getBoundingClientRect();
      expect(Math.abs(box.top + box.height / 2 - middle)).toBeLessThan(0.5);
    }
  });
});

describe('A button beside a Field.Textarea', () => {
  it("keeps Button's own icon-only size, since the field has no single line", () => {
    render(
      <main data-appearance="light" data-density="comfortable">
        <Field.Root aria-label="Note">
          <Field.Textarea value="" onChange={() => {}} />
          <Button.Root variant="ghost" aria-label="Clear note">
            <Button.Icon>
              <svg viewBox="0 0 16 16" />
            </Button.Icon>
          </Button.Root>
        </Field.Root>
        <Button.Root variant="ghost" aria-label="Alone">
          <Button.Icon>
            <svg viewBox="0 0 16 16" />
          </Button.Icon>
        </Button.Root>
      </main>,
    );
    const inField = screen.getByRole('button', { name: 'Clear note' });
    const alone = screen.getByRole('button', { name: 'Alone' });
    expect(getComputedStyle(inField).paddingInlineStart).toBe(getComputedStyle(alone).paddingInlineStart);
    expect(inField.getBoundingClientRect().height).toBe(alone.getBoundingClientRect().height);
  });
});

describe('A button beside a Field.ChipInput', () => {
  function Chips({ chips, testId }: { chips: string[]; testId: string }) {
    return (
      <Field.Root aria-label={testId} data-testid={testId}>
        <Field.ChipInput
          chips={chips}
          inputValue=""
          onInputValueChange={() => undefined}
          onCommit={() => undefined}
          onChipRemove={() => undefined}
        />
        <Button.Root variant="ghost" aria-label={`Clear ${testId}`}>
          <Button.Icon>
            <svg viewBox="0 0 16 16" />
          </Button.Icon>
        </Button.Root>
      </Field.Root>
    );
  }

  it.each(['comfortable', 'compact', 'spacious'])(
    'keeps a %s field one line tall, and stays the same size on the first line when chips wrap',
    (density) => {
      render(
        <main data-appearance="light" data-density={density} style={{ inlineSize: '16rem' }}>
          <Field.Root aria-label="Plain" data-testid="plain">
            <Field.ChipInput
              chips={[]}
              inputValue=""
              onInputValueChange={() => undefined}
              onCommit={() => undefined}
              onChipRemove={() => undefined}
            />
          </Field.Root>
          <Chips chips={[]} testId="empty" />
          <Chips chips={['alpha', 'bravo', 'charlie', 'delta', 'echo', 'foxtrot']} testId="wrapped" />
        </main>,
      );
      const size = parseFloat(getComputedStyle(document.documentElement).fontSize) * 1.5;
      expect(screen.getByTestId('empty').getBoundingClientRect().height).toBe(screen.getByTestId('plain').getBoundingClientRect().height);
      const wrapped = screen.getByTestId('wrapped').getBoundingClientRect();
      expect(wrapped.height).toBeGreaterThan(screen.getByTestId('plain').getBoundingClientRect().height);
      for (const name of ['Clear empty', 'Clear wrapped']) {
        const button = screen.getByRole('button', { name }).getBoundingClientRect();
        expect([button.width, button.height]).toEqual([size, size]);
      }
      // On the first line, centered on the first chip.
      const chip = screen.getByText('alpha').closest('span')!.getBoundingClientRect();
      const button = screen.getByRole('button', { name: 'Clear wrapped' }).getBoundingClientRect();
      expect(Math.abs(button.top + button.height / 2 - (chip.top + chip.height / 2))).toBeLessThan(0.5);
    },
  );
});

describe('A password shown and hidden in a browser', () => {
  function Password() {
    const [shown, setShown] = useState(false);
    const [value, setValue] = useState('');
    return (
      <Field.Root aria-label="Password">
        <Field.TextInput type={shown ? 'text' : 'password'} value={value} onValueChange={setValue} />
        <Button.Root variant="ghost" aria-label="Show password" pressed={shown} onPressedChange={setShown}>
          <Button.Icon>
            <svg viewBox="0 0 16 16" />
          </Button.Icon>
        </Button.Root>
        <Button.Root
          variant="ghost"
          aria-label="Suggest a password"
          onClick={() => {
            setValue('generated');
            setShown(true);
          }}
        >
          <Button.Icon>
            <svg viewBox="0 0 16 16" />
          </Button.Icon>
        </Button.Root>
      </Field.Root>
    );
  }

  it('keeps focus and the caret in the input when the show button switches its type', async () => {
    const { container } = render(<Password />);
    const input = container.querySelector('input') as HTMLInputElement;
    await userEvent.click(input);
    await userEvent.keyboard('wrong{ArrowLeft}{ArrowLeft}{ArrowLeft}');
    for (const typed of ['X', 'Y']) {
      await userEvent.click(screen.getByRole('button', { name: 'Show password' }));
      expect(document.activeElement).toBe(input);
      await userEvent.keyboard(typed);
    }
    expect(input.type).toBe('password');
    expect(input.value).toBe('wrXYong');
  });

  it('restores a mid-value caret after the password is shown', async () => {
    const { container } = render(<Password />);
    const input = container.querySelector('input') as HTMLInputElement;
    await userEvent.click(input);
    await userEvent.keyboard('secret');
    input.setSelectionRange(3, 3);
    await userEvent.click(screen.getByRole('button', { name: 'Show password' }));
    const afterCaretRestoreFrame = () => new Promise(requestAnimationFrame);
    await afterCaretRestoreFrame();
    expect(document.activeElement).toBe(input);
    expect(input.selectionStart).toBe(3);
    expect(input.selectionEnd).toBe(3);
  });

  it('keeps the caret a new value put, when the value and the type change together', async () => {
    const { container } = render(<Password />);
    const input = container.querySelector('input') as HTMLInputElement;
    await userEvent.click(input);
    await userEvent.keyboard('ab{ArrowLeft}');
    await userEvent.click(screen.getByRole('button', { name: 'Suggest a password' }));
    expect(document.activeElement).toBe(input);
    await userEvent.keyboard('!');
    expect(input.value).toBe('generated!');
  });
});

describe('Field.Group in a browser', () => {
  const gaps = { ['--_todae-field-label-gap' as string]: '10px', ['--_todae-field-messages-gap' as string]: '3px' };
  const box = (id: string) => screen.getByTestId(id).getBoundingClientRect();

  it('spaces label, control and messages by field.label.gap, and an ErrorMessage after a Description by field.messages.gap', () => {
    render(
      <main data-appearance="light" data-density="comfortable" style={gaps}>
        <Field.Group>
          <Label.Root htmlFor="email" data-testid="label">
            Email
          </Label.Root>
          <Field.Root id="email" data-testid="shell">
            <Field.TextInput value="" onChange={() => {}} />
          </Field.Root>
          <Description.Root id="hint" data-testid="hint">Use your work address.</Description.Root>
          <ErrorMessage.Root id="error" data-testid="error">Enter an email.</ErrorMessage.Root>
        </Field.Group>
      </main>,
    );
    expect(Math.round(box('shell').top - box('label').bottom)).toBe(10);
    expect(Math.round(box('hint').top - box('shell').bottom)).toBe(10);
    expect(Math.round(box('error').top - box('hint').bottom)).toBe(3);
  });

  it('keeps field.label.gap between messages in any other order, as outside a group', () => {
    render(
      <main data-appearance="light" data-density="comfortable" style={gaps}>
        <Field.Group>
          <ErrorMessage.Root id="error" data-testid="error">
            Enter an email.
          </ErrorMessage.Root>
          <Description.Root id="hint" data-testid="hint">
            Use your work address.
          </Description.Root>
          <Description.Root id="hint2" data-testid="hint2">
            Shown to admins.
          </Description.Root>
          <ErrorMessage.Root id="error2" data-testid="error2">
            Too long.
          </ErrorMessage.Root>
          <ErrorMessage.Root id="error3" data-testid="error3">
            Not allowed.
          </ErrorMessage.Root>
        </Field.Group>
      </main>,
    );
    expect(Math.round(box('hint').top - box('error').bottom)).toBe(10);
    expect(Math.round(box('hint2').top - box('hint').bottom)).toBe(10);
    expect(Math.round(box('error3').top - box('error2').bottom)).toBe(10);
  });

  it('keeps every message gap the same inside a group as outside one', () => {
    const sequence = (prefix: string) => (
      <>
        <Field.Root aria-label={`${prefix} email`} data-testid={`${prefix}-0`}>
          <Field.TextInput value="" onChange={() => {}} />
        </Field.Root>
        <Description.Root id={`${prefix}-d1`} data-testid={`${prefix}-1`}>Hint</Description.Root>
        <ErrorMessage.Root id={`${prefix}-e1`} data-testid={`${prefix}-2`}>Error</ErrorMessage.Root>
        <Description.Root id={`${prefix}-d2`} data-testid={`${prefix}-3`}>Hint</Description.Root>
        <Description.Root id={`${prefix}-d3`} data-testid={`${prefix}-4`}>Hint</Description.Root>
        <ErrorMessage.Root id={`${prefix}-e2`} data-testid={`${prefix}-5`}>Error</ErrorMessage.Root>
        <ErrorMessage.Root id={`${prefix}-e3`} data-testid={`${prefix}-6`}>Error</ErrorMessage.Root>
      </>
    );
    render(
      <main data-appearance="light" data-density="comfortable" style={gaps}>
        <div>{sequence('out')}</div>
        <Field.Group>{sequence('in')}</Field.Group>
      </main>,
    );
    const gapsOf = (prefix: string) =>
      [1, 2, 3, 4, 5, 6].map((i) => Math.round(box(`${prefix}-${i}`).top - box(`${prefix}-${i - 1}`).bottom));
    expect(gapsOf('in')).toEqual(gapsOf('out'));
  });

  it('spaces a text caption from a radio group, and leaves an open popover out of the column', () => {
    render(
      <main data-appearance="light" data-density="comfortable" style={gaps}>
        <Field.Group data-testid="group">
          <Text.Root as="span" id="plan" data-testid="caption">
            Plan
          </Text.Root>
          <RadioGroup.Root aria-labelledby="plan" defaultValue="a" data-testid="radios">
            <RadioGroup.Item value="a">A</RadioGroup.Item>
          </RadioGroup.Root>
          <div popover="manual" data-testid="pop">
            Options
          </div>
        </Field.Group>
      </main>,
    );
    expect(Math.round(box('radios').top - box('caption').bottom)).toBe(10);
    const height = box('group').height;
    (screen.getByTestId('pop') as HTMLElement).showPopover();
    expect(box('group').height).toBe(height);
  });
});

describe('Stack in a browser', () => {
  const gapOf = (id: string) => getComputedStyle(screen.getByTestId(id)).rowGap;

  it('maps each gap step to its density token, and none to zero', () => {
    const steps = ['none', 'condensed', 'normal', 'spacious'] as const;
    const sizes = (density: string) => {
      render(
        <main data-appearance="light" data-density={density}>
          {steps.map((gap) => (
            <Stack.Root key={gap} gap={gap} data-testid={`${density}-${gap}`} />
          ))}
        </main>,
      );
      return steps.map((gap) => gapOf(`${density}-${gap}`));
    };
    expect(sizes('compact')).toEqual(['0px', '4px', '8px', '16px']);
    expect(sizes('comfortable')).toEqual(['0px', '4px', '12px', '24px']);
    expect(sizes('spacious')).toEqual(['0px', '8px', '20px', '32px']);
  });

  it('defaults to the normal gap', () => {
    render(
      <Themed>
        <Stack.Root data-testid="default" />
      </Themed>,
    );
    expect(gapOf('default')).toBe('12px');
  });

  it('wraps, aligns and spreads items', () => {
    render(
      <Themed>
        <div style={{ width: 200 }}>
          <Stack.Root direction="row" wrap data-testid="wrap">
            <div data-testid="w1" style={{ width: 120 }}>1</div>
            <div data-testid="w2" style={{ width: 120 }}>2</div>
          </Stack.Root>
          <Stack.Root direction="row" justify="between" align="center" data-testid="spread">
            <div data-testid="s1" style={{ height: 40 }}>1</div>
            <div data-testid="s2">2</div>
          </Stack.Root>
        </div>
      </Themed>,
    );
    const box = (id: string) => screen.getByTestId(id).getBoundingClientRect();
    expect(box('w2').top).toBeGreaterThan(box('w1').top);
    expect(box('s2').right).toBe(box('spread').right);
    expect(box('s2').top + box('s2').height / 2).toBe(box('s1').top + box('s1').height / 2);
  });

  it('renders a list without bullets or indent, and keeps it a list', async () => {
    render(
      <Themed>
        <Stack.Root as="ul" direction="row" data-testid="list">
          <li>One</li>
          <li>Two</li>
        </Stack.Root>
      </Themed>,
    );
    const list = screen.getByTestId('list');
    expect(list.tagName).toBe('UL');
    // Explicit, since Safari drops the implicit role once the bullets are gone.
    expect(list.getAttribute('role')).toBe('list');
    expect(screen.getByRole('list')).toBe(list);
    expect(screen.getAllByRole('listitem')).toHaveLength(2);
    const style = getComputedStyle(list);
    expect(style.listStyleType).toBe('none');
    expect(style.paddingInlineStart).toBe('0px');
    expect(style.marginBlockStart).toBe('0px');
    expect(await violations()).toEqual([]);
  });
});
