import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ColorPicker, Fieldset, normalizeHex } from '../index.js';
import { hexToHsv, hsvToHex } from './color.js';

afterEach(cleanup);

describe('color helpers', () => {
  it('normalizes three- and six-digit hex, with or without #, and rejects the rest', () => {
    expect(normalizeHex('#ABC')).toBe('#aabbcc');
    expect(normalizeHex(' 3366ff ')).toBe('#3366ff');
    expect(normalizeHex('#3366f')).toBeNull();
    expect(normalizeHex('red')).toBeNull();
  });

  it('round-trips hex through HSV', () => {
    for (const hex of ['#000000', '#ffffff', '#ff0000', '#3366ff', '#7f7f7f', '#12ab9c']) {
      expect(hsvToHex(hexToHsv(hex)!)).toBe(hex);
    }
    expect(hexToHsv('#ff0000')).toEqual({ h: 0, s: 1, v: 1 });
    expect(hexToHsv('#0000ff')).toEqual({ h: 240, s: 1, v: 1 });
  });
});

function Controlled({ initial = '#ff0000', onValueChange }: { initial?: string; onValueChange?: (v: string) => void }) {
  const [value, setValue] = useState(initial);
  return (
    <>
      <ColorPicker.Root
        aria-label="Accent"
        value={value}
        onValueChange={(next) => {
          setValue(next);
          onValueChange?.(next);
        }}
      >
        <ColorPicker.Area />
        <ColorPicker.Hue />
      </ColorPicker.Root>
      <output data-testid="value">{value}</output>
    </>
  );
}

describe('ColorPicker', () => {
  it('is a named group with saturation, brightness and hue inputs', () => {
    render(<Controlled initial="#3366ff" />);
    expect(screen.getByRole('group', { name: 'Accent' })).toBeTruthy();
    const saturation = screen.getByRole('slider', { name: 'Saturation' }) as HTMLInputElement;
    const brightness = screen.getByRole('slider', { name: 'Brightness' }) as HTMLInputElement;
    const hue = screen.getByRole('slider', { name: 'Hue' }) as HTMLInputElement;
    expect(saturation.value).toBe('80');
    expect(saturation.getAttribute('aria-valuetext')).toBe('80%');
    expect(brightness.value).toBe('100');
    expect(brightness.tabIndex).toBe(-1);
    expect(hue.value).toBe('225');
    expect(hue.getAttribute('aria-valuetext')).toBe('225°');
  });

  it('moves saturation with Left and Right and brightness with Up and Down, focus following', () => {
    const onValueChange = vi.fn();
    render(<Controlled initial="#ff0000" onValueChange={onValueChange} />);
    const saturation = screen.getByRole('slider', { name: 'Saturation' }) as HTMLInputElement;
    const brightness = screen.getByRole('slider', { name: 'Brightness' }) as HTMLInputElement;
    saturation.focus();
    fireEvent.keyDown(saturation, { key: 'ArrowLeft', shiftKey: true });
    expect(saturation.value).toBe('90');
    fireEvent.keyDown(saturation, { key: 'ArrowDown' });
    expect(brightness.value).toBe('99');
    expect(document.activeElement).toBe(brightness);
    fireEvent.keyDown(brightness, { key: 'PageDown' });
    expect(brightness.value).toBe('89');
    fireEvent.keyDown(brightness, { key: 'ArrowRight' });
    expect(saturation.value).toBe('91');
    expect(document.activeElement).toBe(saturation);
    expect(onValueChange).toHaveBeenLastCalledWith(screen.getByTestId('value').textContent);
  });

  it('changes the hue from its range input', () => {
    render(<Controlled initial="#ff0000" />);
    fireEvent.change(screen.getByRole('slider', { name: 'Hue' }), { target: { value: '120' } });
    expect(screen.getByTestId('value').textContent).toBe('#00ff00');
  });

  it('keeps the hue while the color is a gray or black', () => {
    render(<Controlled initial="#3366ff" />);
    const saturation = screen.getByRole('slider', { name: 'Saturation' });
    const brightness = screen.getByRole('slider', { name: 'Brightness' });
    const hue = screen.getByRole('slider', { name: 'Hue' }) as HTMLInputElement;
    fireEvent.change(saturation, { target: { value: '0' } });
    expect(screen.getByTestId('value').textContent).toBe('#ffffff');
    expect(hue.value).toBe('225');
    fireEvent.change(brightness, { target: { value: '0' } });
    fireEvent.change(brightness, { target: { value: '100' } });
    fireEvent.change(saturation, { target: { value: '80' } });
    expect(screen.getByTestId('value').textContent).toBe('#3366ff');
  });

  it('follows a new value from outside', () => {
    function Outside() {
      const [value, setValue] = useState('#ff0000');
      return (
        <>
          <button type="button" onClick={() => setValue('#0000ff')}>blue</button>
          <ColorPicker.Root aria-label="c" value={value} onValueChange={setValue}>
            <ColorPicker.Hue />
          </ColorPicker.Root>
        </>
      );
    }
    render(<Outside />);
    fireEvent.click(screen.getByRole('button', { name: 'blue' }));
    expect((screen.getByRole('slider', { name: 'Hue' }) as HTMLInputElement).value).toBe('240');
  });

  it('gives a gray from outside the hue of the last color, even one from outside', () => {
    function Outside() {
      const [value, setValue] = useState('#3366ff');
      return (
        <>
          <button type="button" onClick={() => setValue('#ff0000')}>red</button>
          <button type="button" onClick={() => setValue('#808080')}>gray</button>
          <button type="button" onClick={() => setValue('#000000')}>black</button>
          <ColorPicker.Root aria-label="c" value={value} onValueChange={setValue}>
            <ColorPicker.Area />
            <ColorPicker.Hue />
          </ColorPicker.Root>
        </>
      );
    }
    render(<Outside />);
    const hue = screen.getByRole('slider', { name: 'Hue' }) as HTMLInputElement;
    const saturation = screen.getByRole('slider', { name: 'Saturation' }) as HTMLInputElement;
    fireEvent.change(hue, { target: { value: '200' } });
    fireEvent.click(screen.getByRole('button', { name: 'red' }));
    expect(hue.value).toBe('0');
    fireEvent.click(screen.getByRole('button', { name: 'gray' }));
    expect(hue.value).toBe('0');
    expect(saturation.value).toBe('0');
    fireEvent.click(screen.getByRole('button', { name: 'red' }));
    fireEvent.click(screen.getByRole('button', { name: 'black' }));
    expect(hue.value).toBe('0');
    expect(saturation.value).toBe('100');
  });

  it('disables every input when disabled or inside a disabled Fieldset', () => {
    render(
      <Fieldset.Root disabled>
        <Fieldset.Legend>L</Fieldset.Legend>
        <ColorPicker.Root aria-label="c" defaultValue="#ff0000">
          <ColorPicker.Area />
          <ColorPicker.Hue />
        </ColorPicker.Root>
      </Fieldset.Root>,
    );
    for (const slider of screen.getAllByRole('slider')) expect((slider as HTMLInputElement).disabled).toBe(true);
  });

  it('throws when a part renders outside ColorPicker.Root', () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    expect(() => render(<ColorPicker.Hue />)).toThrow('ColorPicker.Hue must render inside ColorPicker.Root');
    vi.restoreAllMocks();
  });
});
