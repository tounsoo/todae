/** Whether `event` happened inside `el`, through shadow roots too. */
export function eventInside(el: HTMLElement | null, event: Event): boolean {
  if (!el) return false;
  const path = typeof event.composedPath === 'function' ? event.composedPath() : [];
  if (path.includes(el)) return true;
  return event.target instanceof Node && el.contains(event.target);
}
