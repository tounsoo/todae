import { afterEach, describe, expect, it } from 'vitest';
import { lastInputWasPointer, resetInputModality, watchInputModality } from './inputModality.js';

afterEach(resetInputModality);

function press(doc: Document) {
  doc.body.dispatchEvent(new Event('pointerdown', { bubbles: true }));
}

function key(doc: Document, init: KeyboardEventInit = { key: 'Tab' }) {
  doc.body.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, ...init }));
}

describe('watchInputModality', () => {
  it('hears the page and a frame alike, whichever started watching first', () => {
    const frame = document.implementation.createHTMLDocument('frame');
    watchInputModality(frame);
    watchInputModality(document);
    press(document);
    expect(lastInputWasPointer()).toBe(true);
    key(frame);
    expect(lastInputWasPointer()).toBe(false);
    press(frame);
    expect(lastInputWasPointer()).toBe(true);
  });

  it('listens once for each document, however often it is asked', () => {
    watchInputModality(document);
    watchInputModality(document);
    press(document);
    key(document, { key: 'k', ctrlKey: true });
    expect(lastInputWasPointer()).toBe(true);
    key(document);
    expect(lastInputWasPointer()).toBe(false);
  });
});
