import stylelint from 'stylelint';

const ruleName = 'todae/disabled-state';

const messages = stylelint.utils.ruleMessages(ruleName, {
  opacity: 'Unexpected opacity on a disabled state.',
  cursor: (value) => `Unexpected cursor "${value}" on a disabled state. Use not-allowed or inherit.`,
});

// `:not(:disabled)` selects the enabled state. One nested pair of parentheses
// covers `:not(:disabled, a:not(:any-link))`. A fresh expression each call, so a
// global replace cannot carry lastIndex into the next selector.
function mentionsDisabled(selector) {
  return /disabled/.test(selector.replace(/:not\((?:[^()]|\([^()]*\))*\)/g, ''));
}

const rule = (primary) => (root, result) => {
  const valid = stylelint.utils.validateOptions(result, ruleName, {
    actual: primary,
    possible: [true],
  });
  if (!valid) return;

  root.walkRules((ruleNode) => {
    if (!mentionsDisabled(ruleNode.selector)) return;
    ruleNode.each((child) => {
      if (child.type !== 'decl') return;
      if (child.prop === 'opacity') {
        stylelint.utils.report({
          ruleName,
          result,
          message: messages.opacity,
          node: child,
          index: 0,
          endIndex: child.prop.length,
        });
        return;
      }
      if (child.prop !== 'cursor') return;
      const value = child.important ? `${child.value} !important` : child.value;
      if (value === 'not-allowed' || value === 'inherit') return;
      const valueStart = child.prop.length + (child.raws.between?.length ?? 0);
      stylelint.utils.report({
        ruleName,
        result,
        message: messages.cursor(value),
        node: child,
        index: valueStart,
        endIndex: valueStart + child.value.length,
      });
    });
  });
};

rule.ruleName = ruleName;
rule.messages = messages;

export default stylelint.createPlugin(ruleName, rule);
