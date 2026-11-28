// A pointer that scrolls a scroller as it moves over a part, as ScrollEdges' arrows do, may not reach that part:
// a native scrollbar can lie over it and take the pointer. On a Mac, WebKit's overlay scrollbar sent the moves over
// an arrow's foot to the scroller, so the arrow never started (#533), and a press there dragged the scrollbar, which
// held the mouse and sent no move or leave, so an arrow the pointer had started kept scrolling against the drag
// (#534). Both passed tests that sent events to the arrow. src/internal/scrollerParts.ts owns that routing, so this
// rule fails a hover listener on an element, anywhere else in the package, whose handler reaches a scroll.

/** Event types that hear a pointer moving over an element, whose target a scrollbar over it can change. */
const HOVER_TYPES = new Set([
  'pointermove',
  'pointerover',
  'pointerenter',
  'pointerleave',
  'pointerout',
  'mousemove',
  'mouseover',
  'mouseenter',
  'mouseleave',
  'mouseout',
]);
const HOVER_PROP = /^on(?:Pointer|Mouse)(?:Move|Over|Enter|Leave|Out)(?:Capture)?$/;
const SCROLL_PROPS = new Set(['scrollTop', 'scrollLeft']);
const SCROLL_CALLS = new Set(['scroll', 'scrollBy', 'scrollTo']);

const SKIP_KEYS = new Set(['parent', 'loc', 'range', 'tokens', 'comments']);

/** Calls `visit` on node and every node under it; `visit` returning false skips a subtree. */
function walk(node, visit) {
  if (!node || typeof node.type !== 'string') return;
  if (visit(node) === false) return;
  for (const key of Object.keys(node)) {
    if (SKIP_KEYS.has(key)) continue;
    const value = node[key];
    if (Array.isArray(value)) for (const child of value) walk(child, visit);
    else if (value && typeof value.type === 'string') walk(value, visit);
  }
}

const isFunction = (node) =>
  node?.type === 'FunctionDeclaration' || node?.type === 'FunctionExpression' || node?.type === 'ArrowFunctionExpression';

/** The expression under TypeScript's `as`, `satisfies` and `!`, and under an optional chain such as `fn?.bind(x)`. */
const WRAPPERS = new Set(['TSAsExpression', 'TSSatisfiesExpression', 'TSNonNullExpression', 'ChainExpression']);
function unwrap(node) {
  let current = node;
  while (current && WRAPPERS.has(current.type)) current = current.expression;
  return current;
}

const propertyName = (member) =>
  member?.type === 'MemberExpression' && !member.computed && member.property.type === 'Identifier' ? member.property.name : null;

/** A write to a scroll position: `el.scrollTop = …`, `el.scrollLeft += …`, `el.scroll(…)`, `el.scrollBy(…)` or `el.scrollTo(…)`. */
function isScrollWrite(node) {
  if (node.type === 'AssignmentExpression') return SCROLL_PROPS.has(propertyName(unwrap(node.left)));
  if (node.type === 'UpdateExpression') return SCROLL_PROPS.has(propertyName(unwrap(node.argument)));
  if (node.type === 'CallExpression') return SCROLL_CALLS.has(propertyName(unwrap(node.callee)));
  return false;
}

/** The event type a listener call names, when it is written out. */
function literalType(node) {
  if (node?.type === 'Literal' && typeof node.value === 'string') return node.value;
  if (node?.type === 'TemplateLiteral' && node.expressions.length === 0) return node.quasis[0].value.cooked;
  return null;
}

/** Whether an identifier here names a binding, rather than a property, key, type member or JSX attribute. */
function isReference(node) {
  const parent = node.parent;
  if (!parent) return true;
  if (parent.type === 'MemberExpression' && parent.property === node && !parent.computed) return false;
  if ((parent.type === 'Property' || parent.type === 'MethodDefinition' || parent.type === 'PropertyDefinition') && parent.key === node && !parent.computed && !parent.shorthand) return false;
  if (parent.type === 'TSPropertySignature' || parent.type === 'TSMethodSignature') return false;
  if (parent.type === 'JSXAttribute' && parent.name === node) return false;
  if (parent.type === 'JSXMemberExpression' && parent.property === node) return false;
  return true;
}

/** Calls that return a handler made of the functions passed to them. Any other call, such as requestAnimationFrame's, returns a value. */
const HANDLER_WRAPPERS = new Set(['useCallback', 'useEffectEvent', 'composeHandlers', 'alongside']);

const scrollerPointerRule = {
  meta: {
    type: 'problem',
    docs: { description: 'A pointer that scrolls a scroller as it moves over a part goes through src/internal/scrollerParts.ts.' },
    schema: [],
    messages: {
      scrolls:
        "This {{listener}} listener scrolls a scroller as a pointer moves over an element. A native scrollbar over the scroller's edge can take " +
        "that pointer: on a Mac, WebKit's overlay scrollbar sends the moves to the scroller instead (#533), and a press there drags the " +
        'scrollbar, which holds the mouse and sends no move or leave until it lets go (#534). Watch the parts with watchScrollerParts from ' +
        'packages/design-system/src/internal/scrollerParts.ts, which handles both, and test the strip with the real mouse from ' +
        'packages/design-system/src/test/mouse.ts.',
    },
  },
  create(context) {
    const { sourceCode } = context;

    /**
     * Each identifier that reads a binding this file declares, to that binding. A plain write, such as
     * `pending = null`, reads nothing, so a handler that only clears a binding never reaches what it held.
     */
    let resolved = null;
    function variableOf(identifier) {
      if (!resolved) {
        resolved = new Map();
        for (const scope of sourceCode.scopeManager.scopes) {
          for (const reference of scope.references) if (reference.resolved && reference.isRead()) resolved.set(reference.identifier, reference.resolved);
        }
      }
      return resolved.get(identifier) ?? null;
    }

    /**
     * The functions an expression gives: itself, a function of this file it names, either branch of a choice, or
     * those a handler wrapper such as `useCallback(fn)`, `composeHandlers(theirs, fn)` or `fn.bind(x)` wraps.
     */
    function functionsIn(node, seen = new Set()) {
      const current = unwrap(node);
      if (!current || seen.has(current)) return [];
      seen.add(current);
      if (isFunction(current)) return [current];
      if (current.type === 'Identifier') {
        const variable = variableOf(current);
        if (!variable) return [];
        const nodes = [];
        for (const def of variable.defs) {
          if (def.type === 'FunctionName') nodes.push(def.node);
          else if (def.type === 'Variable' && def.node.init) nodes.push(def.node.init);
        }
        for (const reference of variable.references) if (reference.writeExpr) nodes.push(reference.writeExpr);
        return nodes.flatMap((child) => functionsIn(child, seen));
      }
      if (current.type === 'ConditionalExpression') return [current.consequent, current.alternate].flatMap((child) => functionsIn(child, seen));
      if (current.type === 'LogicalExpression') return [current.left, current.right].flatMap((child) => functionsIn(child, seen));
      if (current.type === 'CallExpression') {
        const callee = unwrap(current.callee);
        if (propertyName(callee) === 'bind') return functionsIn(callee.object, seen);
        const name = callee.type === 'Identifier' ? callee.name : propertyName(callee);
        if (HANDLER_WRAPPERS.has(name)) return current.arguments.flatMap((child) => functionsIn(child, seen));
      }
      return [];
    }

    /** Whether a node, or a function of this file it names or calls, writes a scroll position. */
    function reachesScroll(node, seen = new Set()) {
      if (!node || seen.has(node)) return false;
      seen.add(node);
      let found = false;
      walk(node, (child) => {
        if (found) return false;
        if (isScrollWrite(child)) {
          found = true;
          return false;
        }
        if (child.type === 'Identifier' && isReference(child)) {
          for (const fn of functionsIn(child)) {
            if (reachesScroll(fn, seen)) {
              found = true;
              return false;
            }
          }
        }
        return undefined;
      });
      return found;
    }

    /**
     * Whether an expression is the window or a document, which hear every move whatever the browser hit tests.
     * `seen` holds the expressions on the path being followed, so a cycle of bindings ends and two branches that
     * read the same binding, as `win ?? fallback` with `fallback = win` does, each follow it.
     */
    function isWindowLike(node, seen = new Set()) {
      const current = unwrap(node);
      if (!current || seen.has(current)) return false;
      seen.add(current);
      try {
        return windowLike(current, seen);
      } finally {
        seen.delete(current);
      }
    }
    function windowLike(current, seen) {
      if (current.type === 'Identifier') {
        if (['window', 'document', 'globalThis', 'self'].includes(current.name)) return true;
        // Every value the binding is given, at its declaration and later, must be a window or a document:
        // a `let` that starts as the window and is set to an element later may hold the element.
        // A parameter, a destructured name or an import brings a value this file doesn't show, so it is no window.
        const variable = variableOf(current);
        if (!variable || variable.defs.length === 0) return false;
        // So does an ambient `declare let`, and a write that destructures, whose writeExpr is the whole object.
        if (variable.defs.some((def) => def.type !== 'Variable' || def.node.id.type !== 'Identifier' || def.parent?.declare)) return false;
        const values = [];
        for (const def of variable.defs) if (def.node.init) values.push(def.node.init);
        for (const reference of variable.references) {
          // The declaration's own write is its init, already above.
          if (!reference.isWrite() || reference.init) continue;
          const parent = reference.identifier.parent;
          if (!reference.writeExpr || parent?.type !== 'AssignmentExpression' || parent.left !== reference.identifier) return false;
          values.push(reference.writeExpr);
        }
        return values.length > 0 && values.every((value) => isWindowLike(value, seen));
      }
      if (current.type === 'MemberExpression') return ['ownerDocument', 'defaultView', 'document'].includes(propertyName(current));
      if (current.type === 'LogicalExpression') {
        // `a && b` gives b whenever a is set; `a || b` and `a ?? b` give either, so both must be.
        if (current.operator === '&&') return isWindowLike(current.right, seen);
        return isWindowLike(current.left, seen) && isWindowLike(current.right, seen);
      }
      return false;
    }

    return {
      CallExpression(node) {
        const callee = unwrap(node.callee);
        if (propertyName(callee) !== 'addEventListener') return;
        const type = literalType(node.arguments[0]);
        if (!type || !HOVER_TYPES.has(type)) return;
        if (isWindowLike(callee.object)) return;
        if (reachesScroll(node.arguments[1])) context.report({ node, messageId: 'scrolls', data: { listener: `'${type}'` } });
      },
      JSXAttribute(node) {
        const name = node.name.type === 'JSXIdentifier' ? node.name.name : null;
        if (!name || !HOVER_PROP.test(name)) return;
        if (node.value?.type !== 'JSXExpressionContainer') return;
        if (reachesScroll(node.value.expression)) context.report({ node, messageId: 'scrolls', data: { listener: name } });
      },
    };
  },
};

export default scrollerPointerRule;
