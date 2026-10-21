import type { StackChange } from './useStackMotion.js';

/** What a view gets back on a pop: its scroll offset, and the Drilldown.Trigger in it that pushed the view above, if one did. */
export type Covered = { offset: number; trigger: HTMLElement | null };

export type ViewMemory = {
  /** Notes the trigger of a push, until the change it asks for starts. */
  pushing: (view: string, trigger: HTMLElement) => void;
  /**
   * Follows a change of the shown stack as it starts, given the scroll offset
   * before it: remembers the view a forward change covers, forgets the views
   * that left, and returns what the view a pop shows gets back.
   */
  follow: (change: StackChange, offset: number) => Covered | undefined;
  clear: () => void;
};

/** A Drilldown's memory of the views it covered while they showed. */
export function createViewMemory(): ViewMemory {
  const covered = new Map<string, Covered>();
  let opener: { view: string; trigger: HTMLElement } | null = null;
  return {
    pushing(view, trigger) {
      opener = { view, trigger };
    },
    follow({ from, to, direction }, offset) {
      for (const view of covered.keys()) {
        if (!to.includes(view)) covered.delete(view);
      }
      const top = to.at(-1);
      const below = from.at(-1);
      const pushed = opener;
      opener = null;
      if (direction === 'forward' && below !== undefined && below !== top && to.includes(below)) {
        covered.set(below, { offset, trigger: pushed && pushed.view === top ? pushed.trigger : null });
      }
      return direction === 'back' && top !== undefined ? covered.get(top) : undefined;
    },
    clear() {
      covered.clear();
      opener = null;
    },
  };
}
