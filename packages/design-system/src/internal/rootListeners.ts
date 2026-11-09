// One capture listener on a root node, a document or a shadow root, for each
// event type, shared by every part that listens there, instead of one per
// part. A page of 1,000 checkboxes added 1,000 `reset` listeners before.
//
// The handlers run in the order they started, as listeners of their own on
// the node would. A handler that starts during a dispatch hears the next
// event, not this one, and one that stops during it hears no more, as the DOM
// has it. A handler returns `'stop'` where its own listener would have called
// `stopImmediatePropagation`, which this calls too, so the handlers after it
// on the node, shared or not, don't hear the event. One that throws doesn't
// keep the others from hearing; its error is thrown after.
//
// The one place the order differs: the shared listener sits where the first
// handler started, so a capture listener a page adds to the same node between
// two parts' starts now runs after both, where it used to run between them,
// and its stopImmediatePropagation no longer shields the later part. A page
// listener added before the first part starts keeps its place.

/** Handles one event; `'stop'` keeps the handlers after it from hearing it. */
export type RootHandler = (event: Event) => 'stop' | void;

type Shared = { handlers: Set<RootHandler>; listener: (event: Event) => void };

const roots = new WeakMap<Node, Map<string, Shared>>();

/** Calls `handler` for each `type` event that reaches `root` in the capture phase. Returns the stop. */
export function listenOnRoot(root: Node, type: string, handler: RootHandler): () => void {
  let types = roots.get(root);
  if (!types) roots.set(root, (types = new Map()));
  let shared = types.get(type);
  if (!shared) {
    const handlers = new Set<RootHandler>();
    const listener = (event: Event) => {
      for (const own of [...handlers]) {
        if (!handlers.has(own)) continue;
        let result: 'stop' | void;
        try {
          result = own(event);
        } catch (error) {
          setTimeout(() => {
            throw error;
          });
          continue;
        }
        if (result === 'stop') {
          event.stopImmediatePropagation();
          return;
        }
      }
    };
    shared = { handlers, listener };
    types.set(type, shared);
    root.addEventListener(type, listener, true);
  }
  const own = shared;
  // Each call subscribes on its own, the same function twice included.
  const subscription: RootHandler = (event) => handler(event);
  own.handlers.add(subscription);
  return () => {
    if (!own.handlers.delete(subscription) || own.handlers.size) return;
    root.removeEventListener(type, own.listener, true);
    if (types.get(type) === own) types.delete(type);
    if (!types.size) roots.delete(root);
  };
}
