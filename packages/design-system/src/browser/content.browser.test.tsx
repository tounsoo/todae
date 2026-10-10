import { render, screen } from '@testing-library/react';
import { userEvent } from '@vitest/browser/context';
import axe from 'axe-core';
import { useId, type ReactNode } from 'react';
import { describe, expect, it } from 'vitest';
import {
  Alert,
  Badge,
  Breadcrumbs,
  Button,
  Card,
  Checkbox,
  Code,
  Disclosure,
  ErrorMessage,
  Field,
  Fieldset,
  Kbd,
  Label,
  Link,
  Meter,
  Pagination,
  Progress,
  Separator,
  Skeleton,
  Slider,
  Spinner,
  Table,
  Text,
  VisuallyHidden,
} from '../index';

/** axe without its WCAG 2 contrast rule: Todae checks contrast with APCA when tokens build. */
async function violations(): Promise<string[]> {
  const result = await axe.run(document.body, { rules: { 'color-contrast': { enabled: false } } });
  return result.violations.map((v) => `${v.id}: ${v.help}\n  ${v.nodes.map((n) => n.target.join(' ')).join('\n  ')}`);
}

/** The background of the first rule that styles `pseudo` on the Progress or Meter class alone. */
function pseudoBackground(pseudo: string): string | undefined {
  const element = pseudo.includes('meter') ? 'meter' : 'progress';
  const selector = new RegExp(`^\\.todae_${element}_[0-9a-f]+${pseudo}$`);
  const rules = (list: CSSRuleList): CSSStyleRule[] =>
    [...list].flatMap((rule) =>
      rule instanceof CSSStyleRule ? [rule] : rule instanceof CSSLayerBlockRule ? rules(rule.cssRules) : [],
    );
  const sheets = [...document.styleSheets].flatMap((sheet) => rules(sheet.cssRules));
  const match = sheets.find((rule) => selector.test(rule.selectorText));
  return match?.style.getPropertyValue('background').trim();
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
          <Link.Root href="#billing">Open billing</Link.Root>
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
      <Disclosure.Root name="faq">
        <Disclosure.Summary>What is Todae?</Disclosure.Summary>
        <p>A base for company design systems.</p>
      </Disclosure.Root>
      <Disclosure.Root name="faq">
        <Disclosure.Summary>Does it ship icons?</Disclosure.Summary>
        <p>No. Pass your own.</p>
      </Disclosure.Root>
      <Separator.Root />
      <Table.Root>
        <caption>Invoices</caption>
        <thead>
          <tr>
            <th scope="col">Month</th>
            <th scope="col">Total</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <th scope="row">May</th>
            <td>$120</td>
          </tr>
        </tbody>
      </Table.Root>
      <label>
        Upload
        <Progress.Root value={40} max={100} />
      </label>
      <label>
        Storage
        <Meter.Root value={0.9} low={0.5} high={0.8} optimum={0.2} />
      </label>
      <label>
        Volume
        <Slider.Root defaultValue={30} />
      </label>
      <Breadcrumbs.Root>
        <Breadcrumbs.Item>
          <Link.Root href="#home">Home</Link.Root>
        </Breadcrumbs.Item>
        <Breadcrumbs.Item current>Settings</Breadcrumbs.Item>
      </Breadcrumbs.Root>
      <Card.Root>
        <Card.Header>
          <Text as="h3">Plan</Text>
        </Card.Header>
        <Card.Body>
          Pro <Badge.Root tone="success">Paid</Badge.Root>
        </Card.Body>
      </Card.Root>
      <Spinner.Root aria-label="Loading invoices" />
      <div aria-busy="true">
        <Skeleton.Root aria-hidden="true" />
      </div>
      <p>
        Press{' '}
        <Kbd.Root>
          <Kbd.Root>Ctrl</Kbd.Root> + <Kbd.Root>K</Kbd.Root>
        </Kbd.Root>{' '}
        to run <Code.Root>open()</Code.Root>.
      </p>
      <Code.Block tabIndex={0} role="region" aria-label="Example code">
        <code>{'const plan = await getPlan();'}</code>
      </Code.Block>
      <VisuallyHidden.Root focusable>
        <a href="#gallery-end">Skip to content</a>
      </VisuallyHidden.Root>
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
    // The negative margin into the padding must not cap the button below its content.
    const label = screen.getByText('×');
    expect(label.scrollWidth).toBeLessThanOrEqual(label.clientWidth);
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
        <Link.Root href="#a">Plain</Link.Root>
        <Link.Root href="#b" style={{ textDecorationLine: 'none' }}>
          Styled
        </Link.Root>
        <Link.Root>Placeholder</Link.Root>
      </Themed>,
    );
    expect(getComputedStyle(screen.getByText('Plain')).textDecorationLine).toBe('underline');
    expect(getComputedStyle(screen.getByText('Styled')).textDecorationLine).toBe('none');
    // An <a> without href is not a link and keeps the text style.
    expect(getComputedStyle(screen.getByText('Placeholder')).textDecorationLine).toBe('none');
  });

  it('lets a container component style a Link.Root inside it, as Pagination does', async () => {
    render(
      <Themed>
        <Pagination.Root>
          <Pagination.Item>
            <Link.Root href="#1">1</Link.Root>
          </Pagination.Item>
          <Pagination.Item>
            <Link.Root href="#2" aria-current="page">
              2
            </Link.Root>
          </Pagination.Item>
        </Pagination.Root>
      </Themed>,
    );
    const root = screen.getByText('1').closest('main') as HTMLElement;
    root.style.setProperty('--todae-pagination-fg-default', 'rgb(1, 2, 3)');
    root.style.setProperty('--todae-pagination-current-fg', 'rgb(4, 5, 6)');
    root.style.setProperty('--todae-pagination-ring-focus', 'rgb(7, 8, 9)');
    root.style.setProperty('--todae-pagination-radius', '5px');
    const page = screen.getByText('1');
    const current = screen.getByText('2');
    expect(getComputedStyle(page).textDecorationLine).toBe('none');
    expect(getComputedStyle(page).color).toBe('rgb(1, 2, 3)');
    expect(getComputedStyle(current).textDecorationLine).toBe('none');
    expect(getComputedStyle(current).color).toBe('rgb(4, 5, 6)');
    await userEvent.tab();
    expect(document.activeElement).toBe(page);
    expect(getComputedStyle(page).outlineColor).toBe('rgb(7, 8, 9)');
    expect(getComputedStyle(page).borderTopLeftRadius).toBe('5px');
  });

  it('marks the current link from its tokens and treats false and empty as not current', async () => {
    render(
      <Themed>
        <Link.Root href="#a">Other</Link.Root>
        <Link.Root href="#b" aria-current="page">
          Current
        </Link.Root>
        <Link.Root href="#c" aria-current="step">
          Step
        </Link.Root>
        <Link.Root href="#d" aria-current="true">
          True
        </Link.Root>
        <Link.Root href="#e" aria-current="false">
          False
        </Link.Root>
        {/* React types allow only the ARIA tokens, but markup can carry these. */}
        <Link.Root href="#f" {...{ 'aria-current': 'FALSE' as 'false' }}>
          Upper false
        </Link.Root>
        <Link.Root href="#g" {...{ 'aria-current': '' as 'false' }}>
          Empty
        </Link.Root>
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
        <VisuallyHidden.Root data-testid="hidden">Only for screen readers</VisuallyHidden.Root>
        <VisuallyHidden.Root focusable data-testid="skip">
          <a href="#main">Skip to content</a>
        </VisuallyHidden.Root>
      </Themed>,
    );
    const hidden = screen.getByTestId('hidden').getBoundingClientRect();
    expect(hidden.width).toBeLessThanOrEqual(1);
    expect(hidden.height).toBeLessThanOrEqual(1);
    const skip = screen.getByText('Skip to content');
    const box = screen.getByTestId('skip');
    expect(box.getBoundingClientRect().width).toBeLessThanOrEqual(1);
    screen.getByRole('button', { name: 'Before' }).focus();
    await userEvent.tab();
    expect(document.activeElement).toBe(skip);
    expect(box.getBoundingClientRect().width).toBeGreaterThan(1);
  });

  it('opens and closes a disclosure, one at a time in a named group', async () => {
    render(
      <Themed>
        <Disclosure.Root name="faq" data-testid="one">
          <Disclosure.Summary>One</Disclosure.Summary>
          <p>First answer</p>
        </Disclosure.Root>
        <Disclosure.Root name="faq" data-testid="two">
          <Disclosure.Summary>Two</Disclosure.Summary>
          <p>Second answer</p>
        </Disclosure.Root>
      </Themed>,
    );
    await userEvent.click(screen.getByText('One'));
    expect(screen.getByTestId('one').hasAttribute('open')).toBe(true);
    await userEvent.click(screen.getByText('Two'));
    expect(screen.getByTestId('two').hasAttribute('open')).toBe(true);
    expect(screen.getByTestId('one').hasAttribute('open')).toBe(false);
    expect(getComputedStyle(screen.getByTestId('one')).borderBottomStyle).toBe('solid');
  });

  it('styles tables, progress, meter and sliders from their tokens', () => {
    render(
      <Themed>
        <Table.Root>
          <thead>
            <tr>
              <th scope="col" data-testid="col">
                Month
              </th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <th scope="row" data-testid="row">
                May
              </th>
              <td data-testid="cell">$120</td>
            </tr>
          </tbody>
        </Table.Root>
        <Progress.Root data-testid="progress" value={40} max={100} />
        <Progress.Root data-testid="busy" />
        <Slider.Root data-testid="range" />
      </Themed>,
    );
    const style = (id: string, pseudo?: string) => getComputedStyle(screen.getByTestId(id), pseudo);
    // Row and column headers share one weight; only column headers get the stronger rule.
    expect(style('row').fontWeight).toBe(style('col').fontWeight);
    expect(style('col').borderBottomColor).not.toBe(style('cell').borderBottomColor);
    expect(style('cell').borderBottomStyle).toBe('solid');
    expect(style('busy').animationName).toContain('todae-progress-sweep');
    // Chromium does not report the bar's pseudo-elements, so check the rules that draw them.
    expect(pseudoBackground('::-webkit-progress-value')).toBe('var(--todae-progress-fill)');
    expect(pseudoBackground('::-webkit-progress-bar')).toBe('var(--todae-progress-track)');
    expect(pseudoBackground('::-webkit-meter-optimum-value')).toBe('var(--todae-meter-fill-optimum)');
    expect(pseudoBackground('::-webkit-meter-suboptimum-value')).toBe('var(--todae-meter-fill-suboptimum)');
    expect(pseudoBackground('::-webkit-meter-even-less-good-value')).toBe('var(--todae-meter-fill-critical)');
    expect(style('range').accentColor).not.toBe('auto');
  });

  it('sweeps the busy band the way the fill grows', () => {
    render(
      <Themed>
        <Progress.Root data-testid="ltr" />
        <div dir="rtl">
          <Progress.Root data-testid="rtl" />
        </div>
      </Themed>,
    );
    expect(getComputedStyle(screen.getByTestId('ltr')).animationDirection).toBe('normal');
    expect(getComputedStyle(screen.getByTestId('rtl')).animationDirection).toBe('reverse');
  });

  it('turns a spinner ring and pulses a skeleton', () => {
    render(
      <Themed>
        <Spinner.Root data-testid="spinner" aria-label="Loading" />
        <Button.Root variant="primary" data-testid="button">
          <Spinner.Root data-testid="in-button" aria-label="Saving" /> Save <Code.Root data-testid="button-code">x</Code.Root>
        </Button.Root>
        <div dir="rtl">
          <Spinner.Root data-testid="rtl" aria-label="Loading" />
        </div>
        <Skeleton.Root data-testid="skeleton" aria-hidden="true">
          Placeholder <b data-testid="inside">text</b>
        </Skeleton.Root>
      </Themed>,
    );
    const style = (id: string) => getComputedStyle(screen.getByTestId(id));
    expect(style('spinner').animationName).toContain('todae-spinner-turn');
    expect(style('spinner').width).toBe(style('spinner').height);
    expect(style('spinner').borderTopLeftRadius).toBe('50%');
    expect(style('spinner').backgroundImage).toContain('conic-gradient');
    // A ring turns the same way on either side; the progress sweep's reversal must not reach it.
    expect(style('rtl').animationDirection).toBe('normal');
    // Inside a primary button the arc and inline code take the button's text color.
    expect(style('in-button').color).toBe(style('button').color);
    expect(style('in-button').backgroundImage).toContain(style('button').color);
    expect(style('button-code').color).toBe(style('button').color);
    expect(style('button-code').backgroundColor).not.toBe(style('button').backgroundColor);
    expect(style('skeleton').display).toBe('block');
    expect(style('skeleton').animationName).toContain('todae-skeleton-pulse');
    expect(style('skeleton').color).toBe('rgba(0, 0, 0, 0)');
    expect(style('inside').visibility).toBe('hidden');
  });

  it('keeps a skeleton at least one line high, and lets what is inside make it taller', () => {
    render(
      <Themed>
        <p data-testid="line">x</p>
        <Skeleton.Root data-testid="short" style={{ blockSize: '2px' }} />
        <Skeleton.Root data-testid="tall">
          <div style={{ blockSize: '200px' }} />
        </Skeleton.Root>
      </Themed>,
    );
    const height = (id: string) => screen.getByTestId(id).getBoundingClientRect().height;
    expect(height('short')).toBeCloseTo(height('line'), 0);
    expect(height('tall')).toBe(200);
  });

  it('draws keys as caps, leaves the outer key of a shortcut plain, and drops the code box inside a block', () => {
    render(
      <Themed>
        <p style={{ color: 'rgb(1, 2, 3)' }}>
          <Kbd.Root data-testid="shortcut">
            <Kbd.Root data-testid="key">Ctrl</Kbd.Root>+<Kbd.Root>K</Kbd.Root>
          </Kbd.Root>
        </p>
        <Code.Root data-testid="inline">x</Code.Root>
        <Link.Root href="#x" data-testid="link">
          <Code.Root data-testid="linked">x</Code.Root>
        </Link.Root>
        <Code.Block data-testid="block">
          <Code.Root data-testid="nested">x</Code.Root>
        </Code.Block>
        <Code.Block>
          <code data-testid="plain-nested">x</code>
        </Code.Block>
      </Themed>,
    );
    const style = (id: string) => getComputedStyle(screen.getByTestId(id));
    expect(style('key').borderTopStyle).toBe('solid');
    expect(parseFloat(style('key').borderBottomWidth)).toBeGreaterThan(parseFloat(style('key').borderTopWidth));
    expect(style('shortcut').borderTopStyle).toBe('none');
    expect(style('shortcut').display).toBe('inline');
    expect(style('shortcut').color).toBe('rgb(1, 2, 3)');
    expect(style('linked').color).toBe(style('link').color);
    expect(style('shortcut').fontFamily).toBe(getComputedStyle(screen.getByTestId('shortcut').parentElement!).fontFamily);
    expect(style('inline').fontFamily).toContain('monospace');
    expect(style('inline').backgroundColor).not.toBe('rgba(0, 0, 0, 0)');
    expect(style('block').backgroundColor).not.toBe('rgba(0, 0, 0, 0)');
    expect(style('block').overflowX).toBe('auto');
    expect(style('nested').backgroundColor).toBe('rgba(0, 0, 0, 0)');
    expect(style('nested').paddingLeft).toBe('0px');
    expect(style('plain-nested').backgroundColor).toBe('rgba(0, 0, 0, 0)');
  });

  it('leaves plain native elements without Todae styles', () => {
    render(
      <Themed>
        <Table.Root data-testid="styled">
          <tbody>
            <tr>
              <td data-testid="styled-cell">a</td>
            </tr>
          </tbody>
        </Table.Root>
        <table>
          <tbody>
            <tr>
              <td data-testid="plain-cell">a</td>
            </tr>
          </tbody>
        </table>
        <hr data-testid="plain-rule" />
        <Separator.Root data-testid="rule" />
      </Themed>,
    );
    const style = (id: string) => getComputedStyle(screen.getByTestId(id));
    expect(style('styled-cell').borderBottomStyle).toBe('solid');
    expect(style('plain-cell').borderBottomStyle).toBe('none');
    expect(style('rule').borderTopColor).not.toBe(style('plain-rule').borderTopColor);
  });

  it('draws the breadcrumb glyph between items only, and colors badges and cards from tokens', () => {
    render(
      <Themed>
        <Breadcrumbs.Root separator="›">
          <Breadcrumbs.Item data-testid="first">
            <Link.Root href="#home">Home</Link.Root>
          </Breadcrumbs.Item>
          <Breadcrumbs.Item data-testid="last" current>
            Billing
          </Breadcrumbs.Item>
        </Breadcrumbs.Root>
        <Badge.Root data-testid="neutral">Draft</Badge.Root>
        <Badge.Root data-testid="critical" tone="critical">
          Overdue
        </Badge.Root>
        <Card.Root data-testid="card">Plan</Card.Root>
      </Themed>,
    );
    const before = (id: string) => getComputedStyle(screen.getByTestId(id), '::before').content;
    expect(before('first')).toBe('none');
    expect(before('last')).toContain('›');
    const style = (id: string) => getComputedStyle(screen.getByTestId(id));
    expect(style('neutral').backgroundColor).not.toBe(style('critical').backgroundColor);
    expect(style('card').borderTopStyle).toBe('solid');
    expect(style('card').paddingTop).not.toBe('0px');
  });
});
