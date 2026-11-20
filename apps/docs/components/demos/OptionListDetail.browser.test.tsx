import { cleanup, render, screen } from '@testing-library/react';
import { userEvent } from 'vitest/browser';
import { useState } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { OptionList, ThemeProvider, type Appearance } from '@tounsoo/todae';
import '@tounsoo/todae/todae.css';

afterEach(cleanup);

const COPY = {
  en: {
    label: 'Fruit',
    apple: 'Apple',
    appleDetail: 'Crisp and sweet',
    pear: 'Pear',
    pearDetail: 'Soft when ripe',
  },
  ko: {
    label: '과일',
    apple: '사과',
    appleDetail: '아삭하고 달콤함',
    pear: '배',
    pearDetail: '익으면 부드러움',
  },
} as const;

function Rows({
  locale,
  mode,
  appearance,
}: {
  locale: keyof typeof COPY;
  mode: 'single' | 'multiple';
  appearance: Appearance;
}) {
  const copy = COPY[locale];
  const [single, setSingle] = useState<string | null>(null);
  const [multiple, setMultiple] = useState<string[]>([]);
  const options = (
    <>
      <OptionList.Option value="apple">
        {copy.apple}
        <OptionList.OptionDetail>{copy.appleDetail}</OptionList.OptionDetail>
      </OptionList.Option>
      <OptionList.Option value="pear">
        {copy.pear}
        <OptionList.OptionDetail>{copy.pearDetail}</OptionList.OptionDetail>
      </OptionList.Option>
    </>
  );
  return (
    <ThemeProvider appearance={appearance}>
      {mode === 'multiple' ? (
        <OptionList.Root selectionMode="multiple" value={multiple} onValueChange={setMultiple} aria-label={copy.label}>
          {options}
        </OptionList.Root>
      ) : (
        <OptionList.Root value={single} onValueChange={setSingle} aria-label={copy.label}>
          {options}
        </OptionList.Root>
      )}
    </ThemeProvider>
  );
}

function box(node: Node): DOMRect {
  if (node instanceof Element) return node.getBoundingClientRect();
  const range = document.createRange();
  range.selectNodeContents(node);
  return range.getBoundingClientRect();
}

it('paints the detail in the appearance color', () => {
  const { unmount } = render(<Rows locale="en" mode="single" appearance="light" />);
  const light = getComputedStyle(screen.getByText('Crisp and sweet')).color;
  unmount();
  render(<Rows locale="en" mode="single" appearance="dark" />);
  const dark = getComputedStyle(screen.getByText('Crisp and sweet')).color;
  expect(light).not.toBe(dark);
});

describe.each(['light', 'dark'] as const)('%s appearance', (appearance) => {
  describe.each(['en', 'ko'] as const)('%s', (locale) => {
    describe.each(['single', 'multiple'] as const)('%s selection', (mode) => {
      it('stacks the detail under the title, names the title, and selects the row', async () => {
        const copy = COPY[locale];
        render(<Rows locale={locale} mode={mode} appearance={appearance} />);
        const option = screen.getByRole('option', { name: copy.apple });
        const detail = document.getElementById(option.getAttribute('aria-describedby') ?? '');
        expect(detail?.textContent).toBe(copy.appleDetail);
        const title = [...(option.querySelector('[class*="copy"]')?.childNodes ?? [])].find(
          (node) => node.nodeType === Node.TEXT_NODE && node.textContent?.includes(copy.apple),
        );
        expect(title).toBeTruthy();
        const titleBox = box(title!);
        const detailBox = detail!.getBoundingClientRect();
        expect(detailBox.top).toBeGreaterThanOrEqual(titleBox.bottom - 1);
        expect(detailBox.left).toBeLessThanOrEqual(titleBox.left + 1);
        const optionStyle = getComputedStyle(option);
        const detailStyle = getComputedStyle(detail!);
        expect(detailStyle.color).toBe(optionStyle.color);
        expect(detailStyle.fontSize).toBe(optionStyle.fontSize);
        expect(Number.parseFloat(getComputedStyle(detail!.parentElement!).rowGap)).toBeGreaterThan(0);

        await userEvent.click(detail!);
        expect(option.getAttribute('aria-selected')).toBe('true');
        const selectedDetail = getComputedStyle(detail!).color;
        expect(selectedDetail).toBe(getComputedStyle(option).color);
        const check = option.querySelector('[data-todae-glyph]');
        const titleNow = box(
          [...(option.querySelector('[class*="copy"]')?.childNodes ?? [])].find(
            (node) => node.nodeType === Node.TEXT_NODE && node.textContent?.includes(copy.apple),
          )!,
        );
        const checkBox = check!.getBoundingClientRect();
        const checkMid = (checkBox.top + checkBox.bottom) / 2;
        expect(checkMid).toBeGreaterThanOrEqual(titleNow.top - 1);
        expect(checkMid).toBeLessThanOrEqual(titleNow.bottom + 1);

        screen.getByRole('listbox').focus();
        await userEvent.keyboard('{ArrowDown}');
        expect(screen.getByRole('listbox').getAttribute('aria-activedescendant')).toBe(
          screen.getByRole('option', { name: copy.pear }).id,
        );
      });
    });
  });
});
