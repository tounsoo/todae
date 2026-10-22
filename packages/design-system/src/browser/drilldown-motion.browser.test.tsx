import { render, screen, waitFor } from '@testing-library/react';
import { userEvent } from '@vitest/browser/context';
import { describe, expect, it } from 'vitest';
import { Drilldown } from '../components/Drilldown.js';
import { cssTimeMs } from '../overlay/cssTime.js';
import { cleanupAll, emulateMedia, openDialog, ScrollList, settled, SettingsDialog, Themed, view } from '../test/drilldown.js';

describe('Drilldown motion, height and scroll in a browser', () => {
  it('keeps the leaving view on screen but inert and hidden from screen readers while it slides, then hides it', async () => {
    await openDialog(<SettingsDialog />);
    await userEvent.click(screen.getByRole('button', { name: 'Account' }));
    const leaving = view('Settings');
    expect(screen.getByTestId('viewport').getAttribute('data-direction')).toBe('forward');
    expect(leaving.inert).toBe(true);
    expect(leaving.getAttribute('aria-hidden')).toBe('true');
    expect(leaving.checkVisibility()).toBe(true);
    expect(view('Account').inert).toBe(false);
    await settled();
    expect(leaving.hidden).toBe(true);
    expect(leaving.checkVisibility()).toBe(false);
    expect(leaving.inert).toBe(false);
  });

  it('scrolls to the top on push and brings back the offset on pop, after a trigger or a controlled change', async () => {
    for (const controlled of [false, true]) {
      await openDialog(<ScrollList controlled={controlled} />);
      const body = screen.getByTestId('body');
      await waitFor(() => expect(body.scrollHeight).toBeGreaterThan(body.clientHeight + 400));
      const row = screen.getByRole('button', { name: 'Item 30' });
      row.scrollIntoView({ block: 'center' });
      const offset = body.scrollTop;
      expect(offset).toBeGreaterThan(300);
      row.focus();
      await userEvent.keyboard('{Enter}');
      expect(body.scrollTop).toBe(0);
      await settled();
      await userEvent.click(screen.getByRole('button', { name: 'Back to Items' }));
      expect(body.scrollTop).toBe(offset);
      if (!controlled) expect(document.activeElement).toBe(row);
      cleanupAll();
    }
  });

  it('slides the new view in from the inline end, from the left in right-to-left text', async () => {
    const start = async (dir?: 'rtl') => {
      await openDialog(<SettingsDialog dir={dir} />);
      await userEvent.click(screen.getByRole('button', { name: 'Account' }));
      const port = screen.getByTestId('viewport').getBoundingClientRect();
      const entering = view('Account').getBoundingClientRect();
      return { fromLeft: entering.left - port.left, fromRight: port.right - entering.right };
    };
    const ltr = await start();
    expect(ltr.fromLeft).toBeGreaterThan(ltr.fromRight);
    expect(ltr.fromLeft).toBeGreaterThan(0);
    document.body.replaceChildren();
    const rtl = await start('rtl');
    expect(rtl.fromRight).toBeGreaterThan(rtl.fromLeft);
    expect(rtl.fromRight).toBeGreaterThan(0);
  });

  it('settles at once under reduced motion', async () => {
    await emulateMedia([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
    try {
      await openDialog(<SettingsDialog />);
      await userEvent.click(screen.getByRole('button', { name: 'Account' }));
      expect(screen.getByTestId('viewport').hasAttribute('data-direction')).toBe(false);
      expect(view('Settings').hidden).toBe(true);
      expect(view('Account').getAnimations()).toEqual([]);
      expect(document.activeElement).toBe(screen.getByRole('textbox', { name: 'Display name' }));
    } finally {
      await emulateMedia([]);
    }
  });

  it('lets each view finish its own slide when a second push comes during the first', async () => {
    await openDialog(<SettingsDialog />);
    screen.getByRole('button', { name: 'Account' }).click();
    const email = await screen.findByRole('button', { name: 'Email' });
    email.click();
    await waitFor(() => expect(view('Email')).not.toBeNull());
    for (const label of ['Settings', 'Account']) {
      expect(view(label).checkVisibility()).toBe(true);
      expect(view(label).inert).toBe(true);
      expect(view(label).getAnimations().length).toBeGreaterThan(0);
    }
    await settled();
    expect(view('Settings').hidden).toBe(true);
    expect(view('Account').hidden).toBe(true);
    expect(view('Email').inert).toBe(false);
  });

  it('keeps the leaving view on screen until its slide ends, when CSS makes the slide longer', async () => {
    await openDialog(<SettingsDialog />);
    const style = document.createElement('style');
    style.textContent = '[data-entering], [data-leaving] { transition-duration: 700ms; }';
    document.head.append(style);
    try {
      const token = cssTimeMs(getComputedStyle(screen.getByTestId('viewport')).getPropertyValue('--todae-drilldown-motion-duration'))!;
      expect(token).toBeLessThan(500);
      await userEvent.click(screen.getByRole('button', { name: 'Account' }));
      await new Promise((resolve) => setTimeout(resolve, token + 100));
      expect(view('Settings').checkVisibility()).toBe(true);
      expect(view('Settings').inert).toBe(true);
      await settled();
      expect(view('Settings').hidden).toBe(true);
    } finally {
      style.remove();
    }
  });

  it('moves the views part of the way at the middle of the slide, in both text directions', async () => {
    for (const dir of [undefined, 'rtl'] as const) {
      await openDialog(<SettingsDialog dir={dir} />);
      await userEvent.click(screen.getByRole('button', { name: 'Account' }));
      const port = screen.getByTestId('viewport').getBoundingClientRect();
      for (const label of ['Account', 'Settings']) {
        for (const animation of view(label).getAnimations()) {
          animation.pause();
          animation.currentTime = Number(animation.effect!.getComputedTiming().duration) / 2;
        }
      }
      const offset = (label: string) => {
        const box = view(label).getBoundingClientRect();
        return dir === 'rtl' ? port.right - box.right : box.left - port.left;
      };
      // Coming in from the inline end, and the view below shifting toward the inline start.
      expect(offset('Account')).toBeGreaterThan(1);
      expect(offset('Account')).toBeLessThan(port.width - 1);
      expect(offset('Settings')).toBeLessThan(-1);
      expect(offset('Settings')).toBeGreaterThan(-0.3 * port.width + 1);
      cleanupAll();
    }
  });

  it('slides a view overtaken during its slide on from where it is, and the height too on a push', async () => {
    const viewport = () => screen.getByTestId('viewport');
    const offsets = (labels: readonly string[]) => {
      const port = viewport().getBoundingClientRect();
      return labels.map((label) => view(label).getBoundingClientRect().left - port.left);
    };
    for (const second of ['push', 'pop'] as const) {
      await openDialog(<SettingsDialog inAccount={<div style={{ blockSize: 200 }} />} />);
      screen.getByRole('button', { name: 'Account' }).click();
      await waitFor(() => expect(view('Account')).not.toBeNull());
      // Early on, where the eased height is still well short of the view's.
      for (const el of [view('Settings'), view('Account'), viewport()]) {
        for (const animation of el.getAnimations()) {
          animation.pause();
          animation.currentTime = Number(animation.effect!.getComputedTiming().duration) / 10;
        }
      }
      const watched = second === 'push' ? ['Account'] : ['Account', 'Settings'];
      const before = offsets(watched);
      const heightBefore = viewport().getBoundingClientRect().height;
      expect(Math.abs(before[0]!)).toBeGreaterThan(10);
      expect(view('Account').offsetHeight - heightBefore).toBeGreaterThan(50);
      if (second === 'push') screen.getByRole('button', { name: 'Email' }).click();
      else screen.getByRole('button', { name: 'Back to Settings' }).click();
      // Read as the change commits, before a frame moves the new slide on.
      const after = await waitFor(() => {
        expect(view('Account').getAttribute('data-leaving')).toBe(second === 'push' ? 'forward' : 'back');
        return offsets(watched);
      });
      after.forEach((offset, i) => expect(Math.abs(offset - before[i]!)).toBeLessThan(2));
      // A pop brings back an offset, so its height is the views' own at once.
      if (second === 'push') expect(Math.abs(viewport().getBoundingClientRect().height - heightBefore)).toBeLessThan(2);
      cleanupAll();
    }
  });

  it('brings back the offset of a pop that comes while the height of the push before it still moves', async () => {
    await openDialog(<ScrollList />);
    const body = screen.getByTestId('body');
    await waitFor(() => expect(body.scrollHeight).toBeGreaterThan(body.clientHeight + 400));
    const row = screen.getByRole('button', { name: 'Item 30' });
    row.scrollIntoView({ block: 'center' });
    const offset = body.scrollTop;
    expect(offset).toBeGreaterThan(300);
    row.click();
    await waitFor(() => expect(view('Item 30')).not.toBeNull());
    const [height] = screen.getByTestId('viewport').getAnimations();
    height!.pause();
    height!.currentTime = Number(height!.effect!.getComputedTiming().duration) * 0.9;
    expect(body.scrollHeight - body.clientHeight).toBeLessThan(offset);
    screen.getByRole('button', { name: 'Back to Items' }).click();
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Back to Items' })).toBeNull());
    expect(body.scrollTop).toBe(offset);
    cleanupAll();
  });

  it('scrolls a page that scrolls itself to the top of an inline Drilldown on push, and back on pop', async () => {
    const rows = Array.from({ length: 40 }, (_, i) => `Item ${i + 1}`);
    render(
      <Themed>
        <div style={{ blockSize: 800 }} />
        <Drilldown.Root defaultValue={['list']}>
          <Drilldown.Back />
          <Drilldown.Viewport data-testid="viewport">
            <Drilldown.View value="list" label="Items">
              {rows.map((row) => (
                <div key={row}>
                  <Drilldown.Trigger value={row} variant="ghost">
                    {row}
                  </Drilldown.Trigger>
                </div>
              ))}
            </Drilldown.View>
            {rows.map((row) => (
              <Drilldown.View key={row} value={row} label={row}>
                <p>{row} details</p>
              </Drilldown.View>
            ))}
          </Drilldown.Viewport>
        </Drilldown.Root>
      </Themed>,
    );
    try {
      const page = document.scrollingElement!;
      const port = screen.getByTestId('viewport');
      const row = screen.getByRole('button', { name: 'Item 30' });
      row.scrollIntoView({ block: 'center' });
      const offset = page.scrollTop;
      expect(port.getBoundingClientRect().top).toBeLessThan(-300);
      row.focus();
      await userEvent.keyboard('{Enter}');
      expect(Math.abs(port.getBoundingClientRect().top)).toBeLessThan(1);
      expect(page.scrollTop).toBeGreaterThan(700);
      await settled();
      await userEvent.click(screen.getByRole('button', { name: 'Back to Items' }));
      expect(page.scrollTop).toBe(offset);
    } finally {
      cleanupAll();
      document.scrollingElement!.scrollTop = 0;
    }
  });
});
