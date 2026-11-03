import stylelint from 'stylelint';

const ruleName = 'todae/token-root-scope';

const messages = stylelint.utils.ruleMessages(ruleName, {
  rejected: (root, sheet) => `Unexpected token root "${root}" in ${sheet}.`,
});

const TOKEN = /var\(--todae-([a-z0-9]+)-/g;

function isStringArrayMap(value) {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return false;
  return Object.values(value).every(
    (item) => Array.isArray(item) && item.every((entry) => typeof entry === 'string'),
  );
}

// Stylelint validates each item of an array option, so this sees one root.
function isRootName(value) {
  return typeof value === 'string';
}

function componentName(node) {
  const file = node.root().source?.input?.file ?? '';
  const slash = Math.max(file.lastIndexOf('/'), file.lastIndexOf('\\'));
  const base = slash < 0 ? file : file.slice(slash + 1);
  if (base.endsWith('.module.css')) return base.slice(0, -'.module.css'.length);
  if (base.endsWith('.css')) return base.slice(0, -'.css'.length);
  return base;
}

function allowedRoots(name, options) {
  const own = options.ownRoots[name] ?? [name.toLowerCase()];
  const core = options.coreReads[name] ?? [];
  return new Set([...own, ...core, ...options.sharedRoots]);
}

const rule = (primary, secondary) => (root, result) => {
  const valid = stylelint.utils.validateOptions(
    result,
    ruleName,
    { actual: primary, possible: [true] },
    {
      actual: secondary,
      possible: {
        ownRoots: isStringArrayMap,
        coreReads: isStringArrayMap,
        sharedRoots: isRootName,
      },
    },
  );
  if (!valid) return;

  const name = componentName(root);
  const allowed = allowedRoots(name, secondary);

  const check = (node, text, valueStart) => {
    if (!text.includes('--todae-')) return;
    for (const match of text.matchAll(TOKEN)) {
      const tokenRoot = match[1];
      if (allowed.has(tokenRoot)) continue;
      const index = valueStart + match.index;
      stylelint.utils.report({
        ruleName,
        result,
        message: messages.rejected(tokenRoot, name),
        node,
        index,
        endIndex: index + match[0].length,
      });
    }
  };

  root.walkDecls((decl) => {
    const valueStart = decl.prop.length + (decl.raws.between?.length ?? 0);
    check(decl, decl.value, valueStart);
  });
  root.walkRules((ruleNode) => {
    check(ruleNode, ruleNode.selector, 0);
  });
  root.walkAtRules((atRule) => {
    check(atRule, atRule.params, atRule.name.length + 1);
  });
};

rule.ruleName = ruleName;
rule.messages = messages;

export default stylelint.createPlugin(ruleName, rule);
