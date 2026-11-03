import stylelint from 'stylelint';

const ruleName = 'todae/local-custom-property';

const messages = stylelint.utils.ruleMessages(ruleName, {
  rejected: (prop) => `Unexpected custom property "${prop}". A property this sheet sets starts with --_.`,
});

const LOCAL_TOKEN = /^--todae-[a-z0-9-]+$/;

const rule = (primary) => (root, result) => {
  const valid = stylelint.utils.validateOptions(result, ruleName, {
    actual: primary,
    possible: [true],
  });
  if (!valid) return;

  root.walkDecls((decl) => {
    if (!LOCAL_TOKEN.test(decl.prop)) return;
    stylelint.utils.report({
      ruleName,
      result,
      message: messages.rejected(decl.prop),
      node: decl,
      index: 0,
      endIndex: decl.prop.length,
    });
  });
};

rule.ruleName = ruleName;
rule.messages = messages;

export default stylelint.createPlugin(ruleName, rule);
