import { describe, expect, it } from 'vitest';
import { firstTabbable, getTabbables, TOAST_HOST_ATTRIBUTE } from './tabbables.js';

describe('getTabbables', () => {
  it('skips toasts moved into the root, wherever they sit among its own content', () => {
    const root = document.createElement('dialog');
    root.innerHTML = `<button id="own1"></button><div ${TOAST_HOST_ATTRIBUTE}><button id="toast"></button></div><button id="own2"></button>`;
    document.body.append(root);
    expect(getTabbables(root).map((el) => el.id)).toEqual(['own1', 'own2']);
    // Searching from inside a toast still finds its own controls.
    const toast = root.querySelector<HTMLElement>(`[${TOAST_HOST_ATTRIBUTE}]`)!;
    expect(getTabbables(toast).map((el) => el.id)).toEqual(['toast']);
    root.remove();
  });

  it('keeps the controls of a root that is itself hidden from assistive tech', () => {
    const root = document.createElement('div');
    root.setAttribute('aria-hidden', 'true');
    root.innerHTML = '<button id="bold"></button><span aria-hidden="true"><button id="decor"></button></span>';
    document.body.append(root);
    expect(getTabbables(root).map((el) => el.id)).toEqual(['bold']);
    root.remove();
  });

  it('skips a hidden input even with a tabindex', () => {
    const root = document.createElement('div');
    root.innerHTML = '<input type="hidden" tabindex="0" id="token"><button id="save"></button>';
    document.body.append(root);
    expect(getTabbables(root).map((el) => el.id)).toEqual(['save']);
    root.remove();
  });

  it('counts one stop per radio group: the checked radio, or the first with none checked', () => {
    const root = document.createElement('div');
    root.innerHTML = `
      <input type="radio" name="size" id="small">
      <input type="radio" name="size" id="large" checked>
      <input type="radio" name="tone" id="warm" disabled>
      <input type="radio" name="tone" id="cool">
      <input type="radio" name="tone" id="neutral">
      <input type="radio" id="alone1"><input type="radio" id="alone2">
      <form><input type="radio" name="size" id="inForm"></form>`;
    document.body.append(root);
    expect(getTabbables(root).map((el) => el.id)).toEqual(['large', 'cool', 'alone1', 'alone2', 'inForm']);
    root.remove();
  });

  it('passes a group\'s stop on when its checked radio cannot take focus', () => {
    const root = document.createElement('div');
    root.innerHTML = '<input type="radio" name="size" id="small"><input type="radio" name="size" id="large" checked disabled>';
    document.body.append(root);
    expect(getTabbables(root).map((el) => el.id)).toEqual(['small']);
    root.remove();
  });

  it('counts a checked radio outside the root in its group, as the browser does', () => {
    const outside = document.createElement('input');
    outside.type = 'radio';
    outside.name = 'size';
    outside.checked = true;
    const root = document.createElement('div');
    root.innerHTML = '<button id="before"></button><input type="radio" name="size" id="small"><input type="radio" name="size" id="large">';
    document.body.append(outside, root);
    expect(getTabbables(root).map((el) => el.id)).toEqual(['before']);
    expect(firstTabbable(root, (el) => el.localName === 'input')).toBeNull();
    outside.remove();
    root.remove();
  });

  it('keeps the root\'s first radio as the stop when an unchecked one of its group comes before the root', () => {
    const outside = document.createElement('input');
    outside.type = 'radio';
    outside.name = 'size';
    const root = document.createElement('div');
    root.innerHTML = '<input type="radio" name="size" id="small">';
    document.body.append(outside, root);
    expect(firstTabbable(root)?.id).toBe('small');
    outside.remove();
    root.remove();
  });

  it('keeps a visible group when its checked radio sits in a hidden subtree, without checkVisibility', () => {
    const root = document.createElement('div');
    root.innerHTML = '<input type="radio" name="g" id="a"><div hidden><input type="radio" name="g" id="b" checked></div>';
    document.body.append(root);
    expect(getTabbables(root).map((el) => el.id)).toEqual(['a']);
    root.remove();
  });
});
