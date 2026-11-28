import { describe, it } from 'node:test';
import { RuleTester } from 'eslint';
import tseslint from 'typescript-eslint';
import plugin from './todae.mjs';

RuleTester.describe = describe;
RuleTester.it = it;
RuleTester.itOnly = it.only;

const tester = new RuleTester({
  languageOptions: {
    parser: tseslint.parser,
    parserOptions: { ecmaFeatures: { jsx: true } },
  },
});

const error = { messageId: 'scrolls' };

// How ScrollEdges stepped the list, from the start of the file.
const step = `
function step(el: HTMLElement, edge: Edge, rtl: boolean, by: number) {
  if (edge === 'block-start') el.scrollTop -= by;
  else if (edge === 'block-end') el.scrollTop += by;
  else el.scrollLeft += (edge === 'inline-end') !== rtl ? by : -by;
}`;

// ScrollEdges' effect before #533 (01a8d99d): listeners on the arrows alone, which WebKit's overlay scrollbar
// passed by.
const before533 = `${step}
function effect(own: HTMLElement, el: HTMLElement, win: Window) {
  let frame = 0;
  let resting = null;
  const tick = (now: number) => {
    if (!resting) return;
    step(el, resting.edge, false, 1);
    if (resting) frame = requestAnimationFrame(tick);
  };
  const stop = () => {
    resting = null;
    cancelAnimationFrame(frame);
  };
  const enter = (event: PointerEvent) => {
    if (event.pointerType === 'touch' || !moved(event, win)) return;
    const edge = (event.currentTarget as HTMLElement).dataset.edge as Edge;
    stop();
    resting = { edge };
    frame = requestAnimationFrame(tick);
  };
  const press = (event: Event) => event.preventDefault();
  for (const node of own.children) {
    node.addEventListener('pointermove', enter as EventListener);
    node.addEventListener('pointerleave', stop);
    node.addEventListener('pointerdown', press);
  }
}`;

// ScrollEdges' effect before #534 (5bb80bef): a move on the scroller started the arrow under it, with a button
// held too, and no press on the scrollbar stopped it.
const before534 = `${step}
function effect(own: HTMLElement, el: HTMLElement, win: Window) {
  let frame = 0;
  let resting = null;
  const tick = (now: number) => {
    if (!resting) return;
    step(el, resting.edge, false, 1);
    if (resting) frame = requestAnimationFrame(tick);
  };
  const stop = () => {
    resting = null;
    cancelAnimationFrame(frame);
  };
  const rest = (event: PointerEvent, edge: Edge) => {
    if (!moved(event, win)) return;
    stop();
    resting = { edge };
    frame = requestAnimationFrame(tick);
  };
  const under = (event: PointerEvent) => [...own.children].find((node) => node.hasAttribute('data-shown'));
  const over = (event: PointerEvent) => {
    const node = event.target === el ? under(event) : undefined;
    if (node) rest(event, node.dataset.edge as Edge);
    else stop();
  };
  el.addEventListener('pointermove', over, { passive: true });
  el.addEventListener('pointerleave', stop);
}`;

tester.run('scroller-pointer', plugin.rules['scroller-pointer'], {
  valid: [
    // ScrollEdges now: the parts watcher owns the listeners, and the file only scrolls when told to rest.
    `${step}
import { watchScrollerParts } from '../internal/scrollerParts.js';
function effect(own: HTMLElement, el: HTMLElement) {
  const rest = (node: HTMLElement) => { step(el, node.dataset.edge as Edge, false, 1); };
  const stop = () => {};
  return watchScrollerParts(el, [...own.children] as HTMLElement[], { shown: () => true, rest, leave: stop });
}`,
    // A window or document listener hears every move, whatever the browser hit tests, as a drag's does.
    `function drag(board: HTMLElement) { const onMove = () => { board.scrollLeft += 4; }; window.addEventListener('pointermove', onMove, true); }`,
    `function drag(board: HTMLElement) { const doc = board.ownerDocument; doc.addEventListener('pointermove', () => board.scrollBy({ left: 4 })); }`,
    `function watch(el: HTMLElement) { const win = el.ownerDocument.defaultView ?? window; win.addEventListener('pointermove', () => { el.scrollTop = 0; }); }`,
    // A hover that doesn't scroll, and a scroll that no hover starts.
    `function tip(el: HTMLElement) { el.addEventListener('pointerenter', () => el.setAttribute('data-hover', '')); el.addEventListener('click', () => { el.scrollTop = 0; }); }`,
    `const Row = ({ list }) => <div onPointerMove={() => highlight(list)} onKeyDown={() => { list.scrollTop = 0; }} />;`,
    // A press handler that scrolls: a press over a scrollbar is the scrollbar's, not a hover over a part.
    `function press(el: HTMLElement) { el.addEventListener('pointerdown', () => { el.scrollTop = 0; }); }`,
  ],
  invalid: [
    { code: before533, errors: [error] },
    { code: before534, errors: [error] },
    // Through a function declared later in the file.
    {
      code: `function attach(arrow: HTMLElement, list: HTMLElement) { arrow.addEventListener('mouseenter', () => nudge(list)); }\nfunction nudge(list: HTMLElement) { list.scrollBy({ top: 8 }); }`,
      errors: [error],
    },
    // A React hover prop.
    { code: `const Arrow = ({ list }) => <span onPointerEnter={() => { list.current.scrollLeft += 8; }} />;`, errors: [error] },
    { code: 'function attach(arrow, list) { arrow.addEventListener(`pointerover`, () => list.scrollTo({ top: 0 })); }', errors: [error] },
  ],
});
