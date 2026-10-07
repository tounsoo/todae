import { render, screen } from '@testing-library/react';
import { userEvent } from '@vitest/browser/context';
import axe from 'axe-core';
import { useId, type ReactNode } from 'react';
import { describe, expect, it } from 'vitest';
import { Alert, Checkbox, ErrorMessage, Field, Fieldset, Label, Text } from '../index';

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

function Gallery() {
  const errorId = useId();
  const dateId = useId();
  return (
    <Themed>
      <Text as="h1">Settings</Text>
      <Text as="h2">Notifications</Text>
      <Alert.Root tone="success">
        <Alert.Icon>✓</Alert.Icon>
        <Alert.Title>Saved</Alert.Title>
        <Alert.Description>Your changes are live.</Alert.Description>
        <Alert.Close>×</Alert.Close>
      </Alert.Root>
      <Alert.Root tone="critical">
        <Alert.Title>Payment failed</Alert.Title>
        <Alert.Description>Update your card to keep the plan.</Alert.Description>
        <Alert.Actions>
          <a href="#billing">Open billing</a>
        </Alert.Actions>
      </Alert.Root>
      <Fieldset.Root invalid aria-describedby={errorId}>
        <Fieldset.Legend>Topics</Fieldset.Legend>
        <Checkbox>Product news</Checkbox>
        <Checkbox>Security notices</Checkbox>
        <ErrorMessage id={errorId}>Pick at least one.</ErrorMessage>
      </Fieldset.Root>
      <Label htmlFor={dateId}>Start date</Label>
      <Field.Root id={dateId}>
        <Field.TextInput type="date" value="2026-10-07" onChange={() => undefined} />
      </Field.Root>
      <details name="faq">
        <summary>What is Todae?</summary>
        <p>A base for company design systems.</p>
      </details>
      <details name="faq">
        <summary>Does it ship icons?</summary>
        <p>No. Pass your own.</p>
      </details>
      <a href="#gallery-end" className="todae-visually-hidden-focusable">
        Skip to content
      </a>
      <p id="gallery-end" tabIndex={-1}>
        End
      </p>
    </Themed>
  );
}

describe('content parts in a browser', () => {
  it('pass axe', async () => {
    render(<Gallery />);
    expect(await violations()).toEqual([]);
  });

  it('give each alert tone its own colors', () => {
    render(
      <Themed>
        {(['info', 'success', 'warning', 'critical'] as const).map((tone) => (
          <Alert.Root key={tone} tone={tone} data-testid={tone}>
            {tone}
          </Alert.Root>
        ))}
      </Themed>,
    );
    const backgrounds = new Set(
      ['info', 'success', 'warning', 'critical'].map((tone) => getComputedStyle(screen.getByTestId(tone)).backgroundColor),
    );
    expect(backgrounds.size).toBe(4);
  });

  it('lays out an alert icon and close button beside the text', () => {
    render(
      <Themed>
        <Alert.Root style={{ width: 400 }}>
          <Alert.Icon data-testid="icon">i</Alert.Icon>
          <Alert.Title>Heads up</Alert.Title>
          <Alert.Description>Maintenance tonight.</Alert.Description>
          <Alert.Close>×</Alert.Close>
        </Alert.Root>
      </Themed>,
    );
    const icon = screen.getByTestId('icon').getBoundingClientRect();
    const title = screen.getByText('Heads up').getBoundingClientRect();
    const description = screen.getByText('Maintenance tonight.').getBoundingClientRect();
    const close = screen.getByRole('button', { name: 'Dismiss' }).getBoundingClientRect();
    expect(icon.right).toBeLessThanOrEqual(title.left);
    expect(description.top).toBeGreaterThanOrEqual(title.bottom);
    expect(Math.round(description.left)).toBe(Math.round(title.left));
    expect(close.left).toBeGreaterThanOrEqual(title.right);
  });

  it('puts the fieldset legend above its controls', () => {
    render(
      <Themed>
        <Fieldset.Root>
          <Fieldset.Legend>Topics</Fieldset.Legend>
          <Checkbox>News</Checkbox>
        </Fieldset.Root>
      </Themed>,
    );
    const legend = screen.getByText('Topics').getBoundingClientRect();
    const box = screen.getByText('News').getBoundingClientRect();
    expect(box.top).toBeGreaterThan(legend.bottom);
  });

  it('sizes headings down the scale', () => {
    render(
      <Themed>
        {(['h1', 'h2', 'h3', 'h6'] as const).map((tag) => (
          <Text key={tag} as={tag}>
            {tag}
          </Text>
        ))}
      </Themed>,
    );
    const size = (level: number) => parseFloat(getComputedStyle(screen.getByRole('heading', { level })).fontSize);
    expect(size(1)).toBeGreaterThan(size(2));
    expect(size(2)).toBeGreaterThan(size(3));
    expect(size(3)).toBeGreaterThan(size(6));
  });

  it('underlines links and lets a class override them', () => {
    render(
      <Themed>
        <a href="#a">Plain</a>
        <a href="#b" style={{ textDecorationLine: 'none' }}>
          Styled
        </a>
        <a>Placeholder</a>
      </Themed>,
    );
    expect(getComputedStyle(screen.getByText('Plain')).textDecorationLine).toBe('underline');
    expect(getComputedStyle(screen.getByText('Styled')).textDecorationLine).toBe('none');
    // An <a> without href is not a link and keeps the text style.
    expect(getComputedStyle(screen.getByText('Placeholder')).textDecorationLine).toBe('none');
  });

  it('marks the current link from its tokens and treats false and empty as not current', async () => {
    render(
      <Themed>
        <a href="#a">Other</a>
        <a href="#b" aria-current="page">
          Current
        </a>
        <a href="#c" aria-current="step">
          Step
        </a>
        <a href="#d" aria-current="true">
          True
        </a>
        <a href="#e" aria-current="false">
          False
        </a>
        {/* React types allow only the ARIA tokens, but markup can carry these. */}
        <a href="#f" {...{ 'aria-current': 'FALSE' as 'false' }}>
          Upper false
        </a>
        <a href="#g" {...{ 'aria-current': '' as 'false' }}>
          Empty
        </a>
      </Themed>,
    );
    const style = (text: string) => getComputedStyle(screen.getByText(text));
    expect(style('Current').textDecorationThickness).toBe('2px');
    // Point each current token at a distinct value to prove the rule reads it.
    const root = screen.getByText('Current').closest('main') as HTMLElement;
    root.style.setProperty('--todae-link-fg-current', 'rgb(1, 2, 3)');
    root.style.setProperty('--todae-link-decoration-current', 'rgb(4, 5, 6)');
    root.style.setProperty('--todae-link-decoration-current-thickness', '3px');
    for (const text of ['Current', 'Step', 'True']) {
      expect(style(text).color).toBe('rgb(1, 2, 3)');
      expect(style(text).textDecorationColor).toBe('rgb(4, 5, 6)');
      expect(style(text).textDecorationThickness).toBe('3px');
    }
    for (const text of ['Other', 'False', 'Upper false', 'Empty']) {
      expect(style(text).textDecorationThickness).toBe('1px');
      expect(style(text).color).not.toBe('rgb(1, 2, 3)');
      expect(style(text).textDecorationColor).not.toBe('rgb(4, 5, 6)');
    }
    // Hover still wins on a current link.
    root.style.setProperty('--todae-link-fg-hover', 'rgb(7, 8, 9)');
    root.style.setProperty('--todae-link-decoration-hover', 'rgb(10, 11, 12)');
    await userEvent.hover(screen.getByText('Current'));
    expect(style('Current').color).toBe('rgb(7, 8, 9)');
    expect(style('Current').textDecorationColor).toBe('rgb(10, 11, 12)');
    await userEvent.unhover(screen.getByText('Current'));
  });

  it('hides visually hidden text from the screen but keeps it in the page', async () => {
    render(
      <Themed>
        <button type="button">Before</button>
        <span className="todae-visually-hidden" data-testid="hidden">
          Only for screen readers
        </span>
        <a href="#main" className="todae-visually-hidden-focusable">
          Skip to content
        </a>
      </Themed>,
    );
    const hidden = screen.getByTestId('hidden').getBoundingClientRect();
    expect(hidden.width).toBeLessThanOrEqual(1);
    expect(hidden.height).toBeLessThanOrEqual(1);
    const skip = screen.getByText('Skip to content');
    expect(skip.getBoundingClientRect().width).toBeLessThanOrEqual(1);
    screen.getByRole('button', { name: 'Before' }).focus();
    await userEvent.tab();
    expect(document.activeElement).toBe(skip);
    expect(skip.getBoundingClientRect().width).toBeGreaterThan(1);
  });

  it('opens and closes a native disclosure, one at a time in a named group', async () => {
    render(
      <Themed>
        <details name="faq" data-testid="one">
          <summary>One</summary>
          <p>First answer</p>
        </details>
        <details name="faq" data-testid="two">
          <summary>Two</summary>
          <p>Second answer</p>
        </details>
      </Themed>,
    );
    await userEvent.click(screen.getByText('One'));
    expect(screen.getByTestId('one').hasAttribute('open')).toBe(true);
    await userEvent.click(screen.getByText('Two'));
    expect(screen.getByTestId('two').hasAttribute('open')).toBe(true);
    expect(screen.getByTestId('one').hasAttribute('open')).toBe(false);
    expect(getComputedStyle(screen.getByTestId('one')).borderBottomStyle).toBe('solid');
  });
});
