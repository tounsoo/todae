import type { StackChange } from './useStackMotion.js';

/** What a view gets back on a pop: its scroll offset, and the Drilldown.Trigger in it that pushed the view above, if one did. */
export type Covered = { offset: number; trigger: HTMLElement | null };

export type ViewMemory = {
  /**
   * Notes the trigger in view `holder` that pushed `view`, for the next
   * change, however late the product applies the push.
   */
  pushed: (view: string, trigger: HTMLElement, holder: string) => void;
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
  const triggers = new Map<string, { trigger: HTMLElement; holder: string }>();
  return {
    pushed(view, trigger, holder) {
      triggers.set(view, { trigger, holder });
    },
    follow({ from, to, direction }, offset) {
      for (const view of covered.keys()) {
        if (!to.includes(view)) covered.delete(view);
      }
      const top = to.at(-1);
      const below = from.at(-1);
      if (top === undefined) {
        triggers.clear();
        return undefined;
      }
      if (top !== below && direction === 'forward') {
        // A trigger goes back to the view it sits in, and only that view.
        const pushedBy = triggers.get(top);
        const triggerIn = (view: string) => (pushedBy?.holder === view ? pushedBy.trigger : null);
        if (below !== undefined && to.includes(below)) covered.set(below, { offset, trigger: triggerIn(below) });
        // A covered view that a swap of the view above it leaves under the
        // top keeps its offset, and its trigger only if it holds this push's.
        const under = to.at(-2);
        const kept = under === undefined || under === below ? undefined : covered.get(under);
        if (under !== undefined && kept) covered.set(under, { offset: kept.offset, trigger: triggerIn(under) });
      }
      // A push the product applies arrives as the next change; one it turned down never does.
      triggers.clear();
      return direction === 'back' ? covered.get(top) : undefined;
    },
    clear() {
      covered.clear();
      triggers.clear();
    },
  };
}
