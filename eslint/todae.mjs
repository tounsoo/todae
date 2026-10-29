const FORBIDDEN_PROP_NAMES = new Set(['isDisabled', 'isInvalid', 'isOpen', 'error', 'hasError']);
const CONSOLE_METHODS = new Set(['warn', 'error', 'log', 'info', 'debug']);

function unwrap(node) {
  let current = node;
  while (
    current &&
    (current.type === 'ChainExpression' ||
      current.type === 'ParenthesizedExpression' ||
      current.type === 'TSAsExpression' ||
      current.type === 'TSSatisfiesExpression' ||
      current.type === 'TSNonNullExpression' ||
      current.type === 'TSTypeAssertion')
  ) {
    current = current.expression;
  }
  return current;
}

function contains(outer, inner) {
  if (!outer?.range || !inner?.range) return false;
  return outer.range[0] <= inner.range[0] && inner.range[1] <= outer.range[1];
}

function isString(node, value) {
  const expr = unwrap(node);
  return expr?.type === 'Literal' && expr.value === value;
}

function isNodeEnv(node) {
  const expr = unwrap(node);
  if (expr?.type !== 'MemberExpression' || expr.computed || expr.optional) return false;
  if (expr.property.type !== 'Identifier' || expr.property.name !== 'NODE_ENV') return false;
  const env = expr.object;
  if (env.type !== 'MemberExpression' || env.computed || env.optional) return false;
  if (env.property.type !== 'Identifier' || env.property.name !== 'env') return false;
  const proc = unwrap(env.object);
  return proc?.type === 'Identifier' && proc.name === 'process';
}

function isNotProduction(node) {
  const expr = unwrap(node);
  return expr?.type === 'BinaryExpression' && expr.operator === '!==' && isNodeEnv(expr.left) && isString(expr.right, 'production');
}

function isProduction(node) {
  const expr = unwrap(node);
  return expr?.type === 'BinaryExpression' && expr.operator === '===' && isNodeEnv(expr.left) && isString(expr.right, 'production');
}

function isDevAliasInit(node) {
  const expr = unwrap(node);
  return expr?.type === 'BinaryExpression' && expr.operator === '!==' && isNodeEnv(expr.left) && isString(expr.right, 'production');
}

function split(node, operator) {
  const expr = unwrap(node);
  if (expr?.type === 'LogicalExpression' && expr.operator === operator) {
    return [...split(expr.left, operator), ...split(expr.right, operator)];
  }
  return expr ? [expr] : [];
}

function isDevIdent(node, devAlias) {
  const expr = unwrap(node);
  return devAlias && expr?.type === 'Identifier' && expr.name === 'DEV';
}

function isNotDevIdent(node, devAlias) {
  const expr = unwrap(node);
  return expr?.type === 'UnaryExpression' && expr.operator === '!' && isDevIdent(expr.argument, devAlias);
}

/** The consequent runs only when the build is not production. */
function consequentIsDevOnly(test, devAlias) {
  return split(test, '&&').some((part) => {
    const expr = unwrap(part);
    const negatedProduction = expr?.type === 'UnaryExpression' && expr.operator === '!' && isProduction(expr.argument);
    return isNotProduction(part) || isDevIdent(part, devAlias) || negatedProduction;
  });
}

/** Entering this `if` returns in production, so the statements after it are development-only. */
function isDevReturn(statement, devAlias) {
  if (statement?.type !== 'IfStatement' || statement.alternate) return false;
  const body = statement.consequent;
  const returns =
    body.type === 'ReturnStatement' ||
    (body.type === 'BlockStatement' && body.body.some((stmt) => stmt.type === 'ReturnStatement'));
  if (!returns) return false;
  return split(statement.test, '||').some((part) => isProduction(part) || isNotDevIdent(part, devAlias));
}

function fileHasDevAlias(sourceCode) {
  const text = sourceCode.getText();
  if (!text.includes('const DEV') && !text.includes('let DEV')) return false;
  const stack = [sourceCode.ast];
  while (stack.length > 0) {
    const node = stack.pop();
    if (!node || typeof node.type !== 'string') continue;
    if (
      node.type === 'VariableDeclarator' &&
      node.id?.type === 'Identifier' &&
      node.id.name === 'DEV' &&
      isDevAliasInit(node.init)
    ) {
      return true;
    }
    for (const key of Object.keys(node)) {
      if (key === 'parent') continue;
      const value = node[key];
      if (Array.isArray(value)) {
        for (const item of value) {
          if (item && typeof item.type === 'string') stack.push(item);
        }
      } else if (value && typeof value.type === 'string') {
        stack.push(value);
      }
    }
  }
  return false;
}

function devGuarded(node, sourceCode, devAlias) {
  const ancestors = sourceCode.getAncestors(node);
  for (const ancestor of ancestors) {
    if (
      ancestor.type === 'IfStatement' &&
      contains(ancestor.consequent, node) &&
      consequentIsDevOnly(ancestor.test, devAlias)
    ) {
      return true;
    }
  }
  const chain = [...ancestors, node];
  for (let i = 0; i < chain.length - 1; i++) {
    const block = chain[i];
    if (block.type !== 'BlockStatement') continue;
    const index = block.body.indexOf(chain[i + 1]);
    if (index < 0) continue;
    for (let s = 0; s < index; s++) {
      if (isDevReturn(block.body[s], devAlias)) return true;
    }
  }
  return false;
}

function clientDirectiveAllowed(filename) {
  const path = filename.replaceAll('\\', '/');
  if (path.endsWith('/packages/design-system/src/index.ts')) return true;
  return /\/packages\/design-system\/src\/providers\/[^/]+Provider\.tsx$/.test(path);
}

function isUseClient(node) {
  if (node.type !== 'ExpressionStatement') return false;
  return isString(node.expression, 'use client');
}

function insideFocusWithoutScroll(node, sourceCode) {
  return sourceCode.getAncestors(node).some((ancestor) => {
    return (
      (ancestor.type === 'FunctionDeclaration' || ancestor.type === 'FunctionExpression') &&
      ancestor.id?.type === 'Identifier' &&
      ancestor.id.name === 'focusWithoutScroll'
    );
  });
}

function preventScrollTrue(arg) {
  const expr = unwrap(arg);
  if (expr?.type !== 'ObjectExpression') return false;
  return expr.properties.some((prop) => {
    if (prop.type !== 'Property' || prop.computed) return false;
    const name = prop.key.type === 'Identifier' ? prop.key.name : prop.key.type === 'Literal' ? prop.key.value : null;
    if (name !== 'preventScroll') return false;
    return unwrap(prop.value)?.type === 'Literal' && unwrap(prop.value).value === true;
  });
}

function memberName(member) {
  if (member.type !== 'TSPropertySignature' && member.type !== 'TSMethodSignature') return null;
  if (!member.key) return null;
  if (member.key.type === 'Identifier') return member.key.name;
  if (member.key.type === 'Literal') return String(member.key.value);
  return null;
}

function reportProp(context, key, name) {
  context.report({ node: key, messageId: 'banned', data: { name } });
}

function visitPropType(typeNode, context) {
  if (!typeNode) return;
  if (typeNode.type === 'TSTypeLiteral') {
    for (const member of typeNode.members) {
      const name = memberName(member);
      if (name && FORBIDDEN_PROP_NAMES.has(name)) reportProp(context, member.key, name);
    }
    return;
  }
  if (typeNode.type === 'TSIntersectionType' || typeNode.type === 'TSUnionType') {
    for (const part of typeNode.types) visitPropType(part, context);
    return;
  }
  if (typeNode.type === 'TSParenthesizedType') visitPropType(typeNode.typeAnnotation, context);
}

function propsType(node) {
  if (node.type !== 'TSInterfaceDeclaration' && node.type !== 'TSTypeAliasDeclaration') return false;
  return node.id.type === 'Identifier' && node.id.name.endsWith('Props');
}

const useClientPlacement = {
  meta: {
    type: 'problem',
    docs: { description: "Keep 'use client' in src/index.ts or a provider file, as the first statement." },
    schema: [],
    messages: {
      misplaced: "Keep 'use client' in src/index.ts or a provider file, as the first statement.",
    },
  },
  create(context) {
    return {
      ExpressionStatement(node) {
        if (!isUseClient(node)) return;
        const program = context.sourceCode.ast;
        if (clientDirectiveAllowed(context.filename) && program.body[0] === node) return;
        context.report({ node, messageId: 'misplaced' });
      },
    };
  },
};

const focusWithoutScroll = {
  meta: {
    type: 'problem',
    docs: { description: 'Move focus with focusWithoutScroll when the move must not scroll.' },
    schema: [],
    messages: {
      banned: 'Call focusWithoutScroll(el) instead of el.focus({ preventScroll: true }).',
    },
  },
  create(context) {
    return {
      CallExpression(node) {
        const callee = unwrap(node.callee);
        if (callee?.type !== 'MemberExpression' || callee.computed || callee.optional) return;
        if (callee.property.type !== 'Identifier' || callee.property.name !== 'focus') return;
        if (!node.arguments.some(preventScrollTrue)) return;
        if (insideFocusWithoutScroll(node, context.sourceCode)) return;
        context.report({ node, messageId: 'banned' });
      },
    };
  },
};

const noHiddenType = {
  meta: {
    type: 'problem',
    docs: { description: 'A value a form should validate is not type="hidden".' },
    schema: [],
    messages: {
      banned: 'Do not set type="hidden" on a value a form should validate. Render a value input instead.',
    },
  },
  create(context) {
    return {
      JSXAttribute(node) {
        if (node.name.type !== 'JSXIdentifier' || node.name.name !== 'type' || !node.value) return;
        const box = node.value.type === 'JSXExpressionContainer' ? node.value.expression : node.value;
        if (!isString(box, 'hidden')) return;
        context.report({ node, messageId: 'banned' });
      },
    };
  },
};

const propNaming = {
  meta: {
    type: 'problem',
    docs: { description: 'Form state props are disabled and invalid, not isDisabled or error.' },
    schema: [],
    messages: {
      banned: 'Name form state "disabled" or "invalid", not "{{name}}".',
    },
  },
  create(context) {
    function check(node) {
      if (!propsType(node)) return;
      if (node.type === 'TSInterfaceDeclaration') {
        for (const member of node.body.body) {
          const name = memberName(member);
          if (name && FORBIDDEN_PROP_NAMES.has(name)) reportProp(context, member.key, name);
        }
        return;
      }
      visitPropType(node.typeAnnotation, context);
    }
    return {
      TSInterfaceDeclaration: check,
      TSTypeAliasDeclaration: check,
    };
  },
};

const devOnlyDiagnostics = {
  meta: {
    type: 'problem',
    docs: { description: 'console diagnostics run only when NODE_ENV is not production.' },
    schema: [],
    messages: {
      banned:
        'Log this only in development. Guard it with process.env.NODE_ENV !== \'production\', or call warnOnce.',
    },
  },
  create(context) {
    const devAlias = fileHasDevAlias(context.sourceCode);
    return {
      CallExpression(node) {
        const callee = unwrap(node.callee);
        if (callee?.type !== 'MemberExpression' || callee.optional) return;
        const object = unwrap(callee.object);
        if (object?.type !== 'Identifier' || object.name !== 'console') return;
        if (!callee.computed) {
          if (callee.property.type !== 'Identifier' || !CONSOLE_METHODS.has(callee.property.name)) return;
        }
        if (devGuarded(node, context.sourceCode, devAlias)) return;
        context.report({ node, messageId: 'banned' });
      },
    };
  },
};

/** @type {import('eslint').ESLint.Plugin} */
const plugin = {
  meta: { name: 'todae', version: '0.0.0' },
  rules: {
    'use-client-placement': useClientPlacement,
    'focus-without-scroll': focusWithoutScroll,
    'no-hidden-type': noHiddenType,
    'prop-naming': propNaming,
    'dev-only-diagnostics': devOnlyDiagnostics,
  },
};

export default plugin;
