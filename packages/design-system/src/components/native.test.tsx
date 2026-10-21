import { cleanup, render, screen } from '@testing-library/react';
import type { ComponentPropsWithRef } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { Code, CodeBlock, Disclosure, Kbd, Link, Meter, Progress, Separator, Loader, Skeleton, Slider, Table, VisuallyHidden } from '../index.js';

afterEach(cleanup);

// Components that render one native element and style it from tokens.
describe('native element components', () => {
  it.each([
    ['Link.Root', () => <Link.Root href="/a" data-testid="x" className="mine" />, 'A'],
    ['Disclosure.Root', () => <Disclosure.Root data-testid="x" className="mine" />, 'DETAILS'],
    ['Separator.Root', () => <Separator.Root data-testid="x" className="mine" />, 'HR'],
    ['Table.Root', () => <Table.Root data-testid="x" className="mine" />, 'TABLE'],
    ['Table.Caption', () => <table><Table.Caption data-testid="x" className="mine" /></table>, 'CAPTION'],
    ['Table.Head', () => <table><Table.Head data-testid="x" className="mine" /></table>, 'THEAD'],
    ['Table.HeaderCell', () => <table><tbody><tr><Table.HeaderCell data-testid="x" className="mine" /></tr></tbody></table>, 'TH'],
    ['Table.Cell', () => <table><tbody><tr><Table.Cell data-testid="x" className="mine" /></tr></tbody></table>, 'TD'],
    ['Progress.Root', () => <Progress.Root data-testid="x" className="mine" />, 'PROGRESS'],
    ['Meter.Root', () => <Meter.Root value={1} data-testid="x" className="mine" />, 'METER'],
    ['Loader.Root', () => <Loader.Root data-testid="x" className="mine" />, 'PROGRESS'],
    ['Skeleton.Root', () => <Skeleton.Root data-testid="x" className="mine" />, 'DIV'],
    ['Slider.Root', () => <Slider.Root data-testid="x" className="mine" />, 'INPUT'],
    ['Code.Root', () => <Code.Root data-testid="x" className="mine" />, 'CODE'],
    ['CodeBlock.Root', () => <CodeBlock.Root data-testid="x" className="mine" />, 'PRE'],
    ['Kbd.Root', () => <Kbd.Root data-testid="x" className="mine" />, 'KBD'],
    ['VisuallyHidden.Root', () => <VisuallyHidden.Root data-testid="x" className="mine" />, 'SPAN'],
  ])('%s renders a %s with its own class and the consumer one', (_name, ui, tag) => {
    render(ui());
    const el = screen.getByTestId('x');
    expect(el.tagName).toBe(tag);
    expect(el.classList).toContain('mine');
    expect(el.classList.length).toBeGreaterThan(1);
  });

  it('passes the link props, class included, to a render function', () => {
    const RouterLink = (props: ComponentPropsWithRef<'a'>) => <a {...props} data-router="" />;
    render(
      <Link.Root href="/billing" aria-current="page" className="mine" render={(props) => <RouterLink {...props} />}>
        Billing
      </Link.Root>,
    );
    const link = screen.getByRole('link', { name: 'Billing' });
    expect(link.hasAttribute('data-router')).toBe(true);
    expect(link.getAttribute('href')).toBe('/billing');
    expect(link.getAttribute('aria-current')).toBe('page');
    expect(link.classList).toContain('mine');
    expect(link.classList.length).toBe(2);
  });

  it('keeps a disclosure native, with its summary as the toggle', () => {
    render(
      <Disclosure.Root name="faq" open>
        <Disclosure.Summary>What is Todae?</Disclosure.Summary>
        <p>A foundation.</p>
      </Disclosure.Root>,
    );
    const details = screen.getByRole('group');
    expect(details.tagName).toBe('DETAILS');
    expect(details.getAttribute('name')).toBe('faq');
    expect(details.hasAttribute('open')).toBe(true);
    expect(screen.getByText('What is Todae?').tagName).toBe('SUMMARY');
  });

  it('builds a native table from its parts', () => {
    render(
      <Table.Root>
        <Table.Caption>Invoices</Table.Caption>
        <Table.Head>
          <Table.Row>
            <Table.HeaderCell scope="col">Month</Table.HeaderCell>
            <Table.HeaderCell scope="col">Total</Table.HeaderCell>
          </Table.Row>
        </Table.Head>
        <Table.Body>
          <Table.Row>
            <Table.HeaderCell scope="row">May</Table.HeaderCell>
            <Table.Cell>$120</Table.Cell>
          </Table.Row>
        </Table.Body>
        <Table.Foot>
          <Table.Row>
            <Table.HeaderCell scope="row">Sum</Table.HeaderCell>
            <Table.Cell>$120</Table.Cell>
          </Table.Row>
        </Table.Foot>
      </Table.Root>,
    );
    const table = screen.getByRole('table', { name: 'Invoices' });
    expect([...table.children].map((el) => el.tagName)).toEqual(['CAPTION', 'THEAD', 'TBODY', 'TFOOT']);
    expect(screen.getAllByRole('columnheader').map((el) => el.textContent)).toEqual(['Month', 'Total']);
    expect(screen.getAllByRole('rowheader').map((el) => el.textContent)).toEqual(['May', 'Sum']);
    expect(screen.getAllByRole('cell')).toHaveLength(2);
  });

  it('keeps a spinner indeterminate even if a value slips through', () => {
    const props = { value: 3 } as Record<string, unknown>;
    render(<Loader.Root aria-label="Saving" {...props} />);
    const spinner = screen.getByRole('progressbar', { name: 'Saving' });
    expect(spinner.tagName).toBe('PROGRESS');
    expect(spinner.hasAttribute('value')).toBe(false);
  });

  it('marks the variant, ring by default', () => {
    render(
      <>
        <Loader.Root aria-label="Typing" variant="dots" />
        <Loader.Root aria-label="Loading" />
      </>,
    );
    expect(screen.getByRole('progressbar', { name: 'Typing' }).dataset.variant).toBe('dots');
    expect(screen.getByRole('progressbar', { name: 'Loading' }).dataset.variant).toBe('spinner');
  });

  it('always renders a range input', () => {
    const props = { type: 'text' } as Record<string, unknown>;
    render(<Slider.Root aria-label="Volume" {...props} />);
    expect(screen.getByRole('slider', { name: 'Volume' }).getAttribute('type')).toBe('range');
  });

  it('switches the visually hidden class when focusable', () => {
    const { rerender } = render(<VisuallyHidden.Root data-testid="x" />);
    const hidden = screen.getByTestId('x').className;
    rerender(<VisuallyHidden.Root data-testid="x" focusable />);
    expect(screen.getByTestId('x').className).not.toBe(hidden);
  });

  it('keeps hidden text in the accessible name', () => {
    render(
      <button type="button">
        <span aria-hidden="true">×</span>
        <VisuallyHidden.Root>Delete draft</VisuallyHidden.Root>
      </button>,
    );
    expect(screen.getByRole('button', { name: 'Delete draft' })).toBeTruthy();
  });
});
