import { describe, expect, it, vi } from 'vitest';
import { createToaster, DEFAULT_TOAST_DURATION } from './toaster';

describe('createToaster', () => {
  it('adds toasts oldest first with defaults and returns their ids', () => {
    const toaster = createToaster();
    const a = toaster.add({ title: 'A' });
    const b = toaster.add({ title: 'B', tone: 'critical', duration: 100 });
    expect(a).not.toBe(b);
    expect(toaster.getSnapshot().map((t) => [t.id, t.title, t.tone, t.duration, t.open])).toEqual([
      [a, 'A', 'info', DEFAULT_TOAST_DURATION, true],
      [b, 'B', 'critical', 100, true],
    ]);
  });

  it('takes a default duration and fields of your own', () => {
    const toaster = createToaster<{ href?: string }>({ duration: Infinity });
    toaster.add({ title: 'A', href: '/a' });
    expect(toaster.getSnapshot()[0]).toMatchObject({ duration: Infinity, href: '/a' });
  });

  it('replaces a toast with the same id in place and starts it again', () => {
    const toaster = createToaster();
    toaster.add({ id: 'x', title: 'One' });
    toaster.add({ id: 'y', title: 'Other' });
    const first = toaster.getSnapshot()[0]!;
    toaster.dismiss('x');
    toaster.add({ id: 'x', title: 'Two' });
    const [again] = toaster.getSnapshot();
    expect(toaster.getSnapshot()).toHaveLength(2);
    expect(again).toMatchObject({ id: 'x', title: 'Two', open: true });
    expect(again!.version).toBeGreaterThan(first.version);
  });

  it('updates fields without starting the timer again or reopening', () => {
    const toaster = createToaster();
    const id = toaster.add({ title: 'Uploading', tone: 'info' });
    const before = toaster.getSnapshot()[0]!;
    toaster.update(id, { title: 'Uploaded', tone: 'success' });
    expect(toaster.getSnapshot()[0]).toMatchObject({ title: 'Uploaded', tone: 'success', version: before.version });
    toaster.dismiss(id);
    toaster.update(id, { title: 'Late' });
    expect(toaster.getSnapshot()[0]).toMatchObject({ title: 'Late', open: false });
    toaster.update('missing', { title: 'No' });
    toaster.update(id, { tone: undefined, duration: undefined });
    expect(toaster.getSnapshot()[0]).toMatchObject({ tone: 'success', duration: DEFAULT_TOAST_DURATION });
    expect(toaster.getSnapshot()).toHaveLength(1);
  });

  it('dismisses one or all, then removes', () => {
    const toaster = createToaster();
    const a = toaster.add({ title: 'A' });
    toaster.add({ title: 'B' });
    toaster.dismiss(a);
    expect(toaster.getSnapshot().map((t) => t.open)).toEqual([false, true]);
    toaster.dismiss();
    expect(toaster.getSnapshot().map((t) => t.open)).toEqual([false, false]);
    toaster.remove(a);
    expect(toaster.getSnapshot()).toHaveLength(1);
  });

  it('notifies subscribers only when something changes', () => {
    const toaster = createToaster();
    const listener = vi.fn();
    const unsubscribe = toaster.subscribe(listener);
    const id = toaster.add({ title: 'A' });
    toaster.dismiss(id);
    toaster.dismiss(id);
    toaster.remove('missing');
    expect(listener).toHaveBeenCalledTimes(2);
    unsubscribe();
    toaster.remove(id);
    expect(listener).toHaveBeenCalledTimes(2);
  });
});
