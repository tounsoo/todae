const MOVES = ['transform', 'translate', 'scale', 'rotate'] as const;

const noop = () => undefined;

/**
 * A promise that settles when every finite transform-like motion running on
 * `el` or an element around it ends, or null when none runs. Anchor
 * positioning places against the untransformed box, so a tooltip shown while
 * its trigger scales, as an opening popover does, would sit where the
 * trigger lands instead of where it is.
 */
export function transformsSettling(el: Element | null): Promise<void> | null {
  const doc = el?.ownerDocument;
  if (!el || !doc || typeof doc.getAnimations !== 'function') return null;
  const moving = doc.getAnimations().filter((animation) => {
    if (animation.playState !== 'running') return false;
    const effect = animation.effect as KeyframeEffect | null;
    if (!effect || !('target' in effect) || effect.pseudoElement || !effect.target?.contains(el)) return false;
    // A loop never ends; what spins forever is no container of a trigger.
    if (effect.getComputedTiming().endTime === Infinity) return false;
    if ('transitionProperty' in animation) {
      return (MOVES as readonly string[]).includes((animation as CSSTransition).transitionProperty);
    }
    return effect.getKeyframes().some((frame) => MOVES.some((property) => property in frame));
  });
  if (moving.length === 0) return null;
  return Promise.all(moving.map((animation) => animation.finished.then(noop, noop))).then(noop);
}
