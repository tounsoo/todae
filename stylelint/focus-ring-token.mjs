import stylelint from 'stylelint';

const ruleName = 'todae/focus-ring-token';

const messages = stylelint.utils.ruleMessages(ruleName, {
  rejected: (prop, value) => `Unexpected ${prop} "${value}". A focus ring uses the focus or chip ring tokens.`,
});

const OUTLINE = /^var\(--todae-(?:focus-ring-width|chip-ring-width)\) solid /;
const OFFSET =
  /^(?:var\(--todae-(?:focus-ring-offset|chip-ring-offset)\)|calc\(-1 \* var\(--todae-focus-ring-width\)\))$/;

// Stylelint validates each item of an array option, so this sees one exception.
function isOutlineException(value) {
  return Boolean(value) && typeof value.file === 'string' && typeof value.value === 'string';
}

function fileName(node) {
  const file = node.root().source?.input?.file ?? '';
  const slash = Math.max(file.lastIndexOf('/'), file.lastIndexOf('\\'));
  return slash < 0 ? file : file.slice(slash + 1);
}

const rule = (primary, secondary) => (root, result) => {
  const valid = stylelint.utils.validateOptions(
    result,
    ruleName,
    { actual: primary, possible: [true] },
    {
      actual: secondary,
      possible: {
        outlineExceptions: isOutlineException,
      },
      optional: true,
    },
  );
  if (!valid) return;

  const exceptions = secondary?.outlineExceptions ?? [];
  const file = fileName(root);

  root.walkDecls((decl) => {
    if (decl.prop === 'outline') {
      if (decl.value === 'none') return;
      if (exceptions.some((item) => item.file === file && item.value === decl.value)) return;
      if (OUTLINE.test(decl.value)) return;
    } else if (decl.prop === 'outline-offset') {
      if (OFFSET.test(decl.value)) return;
    } else {
      return;
    }

    const valueStart = decl.prop.length + (decl.raws.between?.length ?? 0);
    stylelint.utils.report({
      ruleName,
      result,
      message: messages.rejected(decl.prop, decl.value),
      node: decl,
      index: valueStart,
      endIndex: valueStart + decl.value.length,
    });
  });
};

rule.ruleName = ruleName;
rule.messages = messages;

export default stylelint.createPlugin(ruleName, rule);
