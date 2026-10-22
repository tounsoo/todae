import type { StackChange } from './useStackMotion.js';

/** What a view gets back on a pop: its scroll offset, and the Drilldown.Trigger in it that pushed the view above, if one did. */
export type Covered = { offset: number; trigger: HTMLElement | null };

export type ViewMemory = {
  /** Notes the trigger that pushed `view`, for the first change that shows it, however late the product applies the push. */
  pushed: (view: string, trigger: HTMLElement) => void;
  /**
   * Follows a change of the shown stack as it starts, given the scroll offset
   * before it: remembers the view a forward change covers, forgets the views
   * that left, and returns what the view a pop shows gets back.
   */
  follow: (change: StackChange, offset: number) => Covered | undefined;
  clear: () => void;
};

/** A Drilldown's memory of the triggers that pushed and of the views it covered while they showed. */
export function createViewMemory(): ViewMemory {
  const covered = new Map<string, Covered>();
  const triggers = new Map<string, HTMLElement>();
  return {
    pushed(view, trigger) {
      triggers.set(view, trigger);
    },
    follow({ from, to, direction }, offset) {
      for (const view of covered.keys()) {
        if (!to.includes(view)) covered.delete(view);
      }
      const top = to.at(-1);
      const below = from.at(-1);
      if (top === undefined) return undefined;
      if (top !== below) {
        const trigger = triggers.get(top) ?? null;
        triggers.delete(top);
        if (direction === 'forward' && below !== undefined && to.includes(below)) {
          covered.set(below, { offset, trigger });
        }
      }
      return direction === 'back' ? covered.get(top) : undefined;
    },
    clear() {
      covered.clear();
      triggers.clear();
    },
  };
}
