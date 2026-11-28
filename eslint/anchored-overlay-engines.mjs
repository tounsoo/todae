// An anchored overlay's placement and motion differ by engine: each one implements anchor positioning,
// position tries and their transitions on its own. #525 left a flipped submenu 13px off its menu in
// WebKit, and #529 found a Popover close that jumped in WebKit and a flip that slid from the far side in
// Firefox, each after a test that returned early outside Chromium. This rule fails a browser test of an
// anchored overlay that skips an engine, or skips its assertions there, by the engine's name.

/** Exports that render or position an anchored overlay, wherever a test imports them from. */
const ANCHORED_EXPORTS = new Set([
  'Popover',
  'usePopover',
  'Tooltip',
  'useTooltip',
  'Menu',
  'ChipList',
  'useChipList',
  'Coachmark',
  'Mention',
  'MentionText',
  'useMentions',
]);

/** Modules whose every export is about an anchored overlay. */
const ANCHORED_MODULE =
  /(?:^|\/)(?:components\/(?:Popover|Tooltip|Menu|ChipList|Coachmark|Mention|MentionText|Field\.Picker)|hooks\/(?:usePopover|useTooltip|useChipList|useMentions|useMentionPeek)|overlay\/(?:popover\w*|tooltip\w*|coachmark|usePopoverSync|anchorName))(?:\.[cm]?[jt]sx?)?$/;

const TEST_CALLS = new Set(['it', 'test', 'describe', 'suite']);

const SKIP_KEYS = new Set(['parent', 'loc', 'range', 'tokens', 'comments']);

/** Calls `visit` on node and every node under it, in source order; `visit` returning false skips a subtree. */
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

/** The identifier at the root of `a.b.c`, or of a call such as `a.b(x).c`. */
function rootName(node) {
  let current = node;
  while (current) {
    if (current.type === 'Identifier') return current.name;
    if (current.type === 'MemberExpression') current = current.object;
    else if (current.type === 'CallExpression') current = current.callee;
    else return null;
  }
  return null;
}

const isTestCallee = (callee) => TEST_CALLS.has(rootName(callee));

/** Whether an identifier here names a binding, rather than a property, key or JSX attribute. */
function isReference(node) {
  const parent = node.parent;
  if (!parent) return true;
  if (parent.type === 'MemberExpression' && parent.property === node && !parent.computed) return false;
  if (parent.type === 'Property' && parent.key === node && !parent.computed && !parent.shorthand) return false;
  if (parent.type === 'JSXAttribute' && parent.name === node) return false;
  if (parent.type === 'JSXMemberExpression' && parent.property === node) return false;
  return true;
}

const anchoredRule = {
  meta: {
    type: 'problem',
    docs: { description: 'A browser test of an anchored overlay runs and asserts in Chromium, Firefox and WebKit.' },
    schema: [],
    messages: {
      skipsEngine:
        'This browser test of an anchored overlay (Popover, Tooltip, Menu, ChipList, Field.Picker, Coachmark, Mention) {{how}} by server.browser. ' +
        'Its placement and motion broke in WebKit and Firefox after tests that ran only in Chromium (#525, #529). ' +
        'Assert in every engine. Where an engine truly differs, give it its own expected value or tolerance, such as ' +
        "`expect(gap).toBeCloseTo(server.browser === 'webkit' ? 1.5 : 1)`, and put a known Firefox failure on the quarantine in " +
        'packages/design-system/scripts/firefox-quarantine.ts. A test that drives Chromium\'s CDP session (`cdp()`) may run in Chromium only.',
    },
  },
  create(context) {
    const anchoredNames = new Set();
    const fieldNames = new Set();
    /** Each identifier that reads a binding, to the nodes that give that binding its value in this file. */
    let targets = null;
    function targetsOf(identifier) {
      if (!targets) {
        targets = new Map();
        for (const scope of context.sourceCode.scopeManager.scopes) {
          for (const reference of scope.references) {
            const variable = reference.resolved;
            if (!variable) continue;
            const nodes = [];
            for (const def of variable.defs) {
              if (def.type === 'FunctionName') nodes.push(def.node);
              else if (def.type === 'Variable' && def.node.init) nodes.push(def.node.init);
            }
            for (const write of variable.references) if (write.writeExpr && write.writeExpr !== reference.identifier) nodes.push(write.writeExpr);
            targets.set(reference.identifier, nodes);
          }
        }
      }
      return targets.get(identifier) ?? [];
    }

    /** Whether a node, or a value or function of this file that it reads, has a part `match` finds. */
    function reaches(node, match, seen = new Set()) {
      if (seen.has(node)) return false;
      seen.add(node);
      let found = false;
      walk(node, (child) => {
        if (found) return false;
        if (match(child)) {
          found = true;
          return false;
        }
        if (child.type === 'Identifier' || child.type === 'JSXIdentifier') {
          for (const target of targetsOf(child)) {
            if (reaches(target, match, seen)) {
              found = true;
              return false;
            }
          }
        }
        return undefined;
      });
      return found;
    }

    /** Whether a node renders or calls an anchored overlay. */
    const anchored = (node) =>
      reaches(node, (child) => {
        if ((child.type === 'Identifier' || child.type === 'JSXIdentifier') && isReference(child)) return anchoredNames.has(child.name);
        if (child.type !== 'MemberExpression' && child.type !== 'JSXMemberExpression') return false;
        const { object, property } = child;
        return fieldNames.has(object.name) && typeof property.name === 'string' && property.name.endsWith('Picker');
      });

    /** Whether a condition reads the engine. */
    const readsEngine = (node) =>
      reaches(node, (child) => {
        if (child.type !== 'MemberExpression' || child.computed || child.property.type !== 'Identifier') return false;
        const object = rootName(child.object);
        return (object === 'server' && child.property.name === 'browser') || (object === 'navigator' && child.property.name === 'userAgent');
      });

    /** Whether a node drives Chromium's DevTools session, through cdp(). */
    const drivesCdp = (node) => reaches(node, (child) => child.type === 'Identifier' && child.name === 'cdp');

    /** Whether a branch has a part `match` finds, outside the functions it defines. */
    function holds(node, match) {
      let found = false;
      walk(node, (child) => {
        if (found) return false;
        if (child !== node && isFunction(child)) return false;
        if (match(child)) found = true;
        return undefined;
      });
      return found;
    }

    const isExpect = (child) => child.type === 'CallExpression' && rootName(child.callee) === 'expect';

    /** It asserts, itself, in a callback such as waitFor's, or through a function of this file that it calls. */
    const asserts = (node) => !!node && reaches(node, isExpect);

    const isSkip = (child) =>
      child.type === 'CallExpression' &&
      (rootName(child.callee) === 'skip' || (child.callee.type === 'MemberExpression' && !child.callee.computed && child.callee.property.name === 'skip'));

    /** The nearest function around a node. */
    function enclosingFunction(node) {
      for (let current = node.parent; current; current = current.parent) if (isFunction(current)) return current;
      return null;
    }

    /**
     * It skips the test, or returns from a function that asserts, such as a test body or a waitFor
     * callback, so its assertions run in some engines only. A return from a helper that picks a value
     * skips nothing.
     */
    function leaves(node, gate) {
      if (!node) return false;
      if (holds(node, isSkip)) return true;
      if (!holds(node, (child) => child.type === 'ReturnStatement')) return false;
      const around = enclosingFunction(gate);
      return !!around && asserts(around.body);
    }

    /**
     * Whether a choice between two branches skips assertions in some engine: one branch skips the test or
     * returns from one that asserts, or only one of them asserts. Two branches that each assert give each
     * engine its own expectation.
     */
    const skipsAssertions = (gate, one, other) => leaves(one, gate) || leaves(other, gate) || asserts(one) !== asserts(other);

    const lastFunction = (call) => [...call.arguments].reverse().find(isFunction) ?? null;

    /** Names bound to a test call, such as `const motionIt = it.runIf(...)`. */
    const testAliases = new Set();
    const isTestCall = (call) => call?.type === 'CallExpression' && (isTestCallee(call.callee) || testAliases.has(rootName(call.callee)));
    const testCalls = [];

    /** The test body around a node: the nearest function passed to a test or suite call. */
    function testBody(node) {
      for (let current = node.parent; current; current = current.parent) {
        if (isFunction(current) && isTestCall(current.parent) && current.parent.arguments.includes(current)) return current;
      }
      return null;
    }

    /** The test bodies a body holds, or the body itself when it is a test: a suite runs its tests. */
    function testsIn(body) {
      const inner = testCalls.map(lastFunction).filter((fn) => fn && fn !== body && fn.range[0] >= body.range[0] && fn.range[1] <= body.range[1]);
      const leavesOnly = inner.filter((fn) => !inner.some((other) => other !== fn && other.range[0] >= fn.range[0] && other.range[1] <= fn.range[1]));
      return leavesOnly.length > 0 ? leavesOnly : [body];
    }

    /** Whether any of these bodies tests an anchored overlay without driving CDP. */
    const anchoredTests = (bodies) => bodies.flatMap(testsIn).some((body) => !drivesCdp(body) && anchored(body));

    /** The test bodies that run a node: its own test, or every test that calls the helper of this file it sits in. */
    function bodiesRunning(node) {
      const body = testBody(node);
      if (body) return [body];
      let helper = null;
      for (let current = node.parent; current; current = current.parent) if (isFunction(current)) helper = current;
      if (!helper) return [];
      return testCalls
        .map(lastFunction)
        .filter((fn) => fn && !(fn.range[0] <= helper.range[0] && fn.range[1] >= helper.range[1]))
        .filter((fn) => reaches(fn, (child) => child === helper));
    }

    /** The outermost call in a chain such as `it.runIf(x).each(rows)(name, fn)`, from its first link. */
    function outerCall(node) {
      let current = node;
      let call = null;
      while (current.parent) {
        const parent = current.parent;
        if (parent.type === 'MemberExpression' && parent.object === current) current = parent;
        else if (parent.type === 'CallExpression' && parent.callee === current) {
          current = parent;
          call = parent;
        } else break;
      }
      return { call, top: current };
    }

    function report(node, bodies, how) {
      if (anchoredTests(bodies)) context.report({ node, messageId: 'skipsEngine', data: { how } });
    }

    const gates = [];

    return {
      ImportDeclaration(node) {
        if (node.importKind === 'type') return;
        const whole = typeof node.source.value === 'string' && ANCHORED_MODULE.test(node.source.value);
        for (const specifier of node.specifiers) {
          if (specifier.importKind === 'type') continue;
          const imported = specifier.type === 'ImportSpecifier' ? (specifier.imported.name ?? specifier.imported.value) : null;
          if (whole || (imported && ANCHORED_EXPORTS.has(imported))) anchoredNames.add(specifier.local.name);
          if (imported === 'Field') fieldNames.add(specifier.local.name);
        }
      },
      VariableDeclarator(node) {
        if (node.id.type === 'Identifier' && node.init && TEST_CALLS.has(rootName(node.init))) testAliases.add(node.id.name);
      },
      CallExpression(node) {
        testCalls.push(node);
        const callee = node.callee;
        if (callee.type !== 'MemberExpression' || callee.computed || !isTestCallee(callee)) return;
        if (callee.property.name !== 'runIf' && callee.property.name !== 'skipIf') return;
        if (!node.arguments[0]) return;
        gates.push({ kind: 'call', node });
      },
      IfStatement(node) {
        gates.push({ kind: 'if', node });
      },
      ConditionalExpression(node) {
        gates.push({ kind: 'branch', node, test: node.test, branches: [node.consequent, node.alternate] });
      },
      LogicalExpression(node) {
        if (node.operator === '&&' || node.operator === '||') gates.push({ kind: 'branch', node, test: node.left, branches: [node.right] });
      },
      'Program:exit'() {
        for (let i = testCalls.length - 1; i >= 0; i -= 1) if (!isTestCall(testCalls[i]) || !lastFunction(testCalls[i])) testCalls.splice(i, 1);
        for (const gate of gates) {
          const { node } = gate;
          if (gate.kind === 'call') {
            if (!readsEngine(node.arguments[0])) continue;
            const how = node.callee.property.name === 'runIf' ? 'runs in one engine only' : 'skips an engine';
            const { call, top } = outerCall(node);
            const declarator = top.parent;
            if (call && call !== node && lastFunction(call)) {
              report(node, [lastFunction(call)], how);
            } else if (declarator?.type === 'VariableDeclarator' && declarator.init === top && declarator.id.type === 'Identifier') {
              const name = declarator.id.name;
              report(node, testCalls.filter((use) => rootName(use.callee) === name).map(lastFunction), how);
            }
            continue;
          }
          const test = gate.kind === 'if' ? node.test : gate.test;
          if (!readsEngine(test)) continue;
          const [one, other] = gate.kind === 'if' ? [node.consequent, node.alternate] : gate.branches;
          if (!skipsAssertions(node, one, other)) continue;
          report(test, bodiesRunning(node), 'skips its assertions in an engine');
        }
      },
    };
  },
};

export default anchoredRule;
