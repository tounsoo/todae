import { describe, expect, it, vi } from 'vitest';
import { cancelLayout, queueLayout, STAGE } from './layoutBatch.js';

const settle = () => new Promise<void>((resolve) => queueMicrotask(resolve));

describe('queueLayout', () => {
  it('runs every read of a stage before any write, and stages in order', async () => {
    const log: string[] = [];
    const a = {};
    const b = {};
    queueLayout(a, STAGE.reveal, { read: () => log.push('reveal a') });
    queueLayout(a, STAGE.measure, {
      read: () => log.push('read a'),
      write: () => {
        log.push('write a');
        queueLayout(a, STAGE.show, { read: () => log.push('show a') });
      },
    });
    queueLayout(b, STAGE.measure, { read: () => log.push('read b'), write: () => log.push('write b') });
    expect(log).toEqual([]);
    await settle();
    expect(log).toEqual(['read a', 'read b', 'write a', 'write b', 'show a', 'reveal a']);
  });

  it('keeps one job per key and stage, the newest, and drops a cancelled key', async () => {
    const log: string[] = [];
    const a = {};
    const b = {};
    queueLayout(a, STAGE.measure, { read: () => log.push('old a') });
    queueLayout(b, STAGE.measure, { read: () => log.push('b') });
    queueLayout(a, STAGE.measure, { read: () => log.push('new a') });
    const c = {};
    queueLayout(c, STAGE.show, { read: () => log.push('c') });
    cancelLayout(c);
    await settle();
    expect(log).toEqual(['new a', 'b']);
  });

  it('runs the rest when one job throws, and throws it after', async () => {
    vi.useFakeTimers();
    try {
      const log: string[] = [];
      queueLayout({}, STAGE.measure, {
        read: () => {
          throw new Error('boom');
        },
      });
      queueLayout({}, STAGE.measure, { read: () => log.push('ran') });
      await settle();
      expect(log).toEqual(['ran']);
      expect(() => vi.runAllTimers()).toThrow('boom');
    } finally {
      vi.useRealTimers();
    }
  });
});
