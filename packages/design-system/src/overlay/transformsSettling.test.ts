import { afterEach, describe, expect, it } from 'vitest';
import { transformsSettling } from './transformsSettling.js';

afterEach(() => {
  document.body.replaceChildren();
});

describe('transformsSettling', () => {
  it('is null when nothing moves or is about to', () => {
    const el = document.createElement('button');
    document.body.append(el);
    expect(transformsSettling(el)).toBeNull();
  });

  it('waits while a popover around it is in its first frames, before it grows', async () => {
    const popover = document.createElement('div');
    popover.setAttribute('data-todae-entering', '');
    const el = document.createElement('button');
    popover.append(el);
    document.body.append(popover);
    const settling = transformsSettling(el);
    expect(settling).not.toBeNull();
    let done = false;
    void settling!.then(() => {
      done = true;
    });
    await Promise.resolve();
    expect(done).toBe(false);
    popover.removeAttribute('data-todae-entering');
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(done).toBe(true);
  });
});
