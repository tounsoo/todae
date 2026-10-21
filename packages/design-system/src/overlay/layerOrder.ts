/**
 * The layer that answers first: the one registered last, or, when other
 * layers sit inside it in the DOM, the innermost of them. Registration order
 * alone fails when an inner layer registers first, as nested ones do when
 * they mount together.
 */
export function innermost<T>(layers: readonly T[], element: (layer: T) => Element | null): T | undefined {
  let top = layers.at(-1);
  while (top !== undefined) {
    const outer = element(top);
    if (!outer) return top;
    let inner: T | undefined;
    for (let i = layers.length - 1; i >= 0 && inner === undefined; i--) {
      const el = element(layers[i]!);
      if (el && el !== outer && outer.contains(el)) inner = layers[i];
    }
    if (inner === undefined) return top;
    top = inner;
  }
  return undefined;
}
