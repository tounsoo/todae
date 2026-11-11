import stylelint from 'stylelint';
import { forcedColorsQuery, insideForcedColors } from './forced-colors.mjs';

const ruleName = 'todae/no-raw-literal';

const messages = stylelint.utils.ruleMessages(ruleName, {
  pill: (raw) => `Unexpected pill length "${raw}".`,
  leading: (raw) => `Unexpected line-height "${raw}". Use 1 or a token.`,
  fade: (raw) => `Unexpected opacity "${raw}". Use 0, 1, or a token.`,
  easing: (raw) => `Unexpected easing "${raw}". Use a token. linear stays allowed.`,
  hairline: 'Unexpected hairline "1px".',
});

// 1 centres a glyph in its box. Any other number is text leading.
const LEADING = /line-height:\s*(?!1\s*[;}])[\d.]+\s*[;}]/g;
const FADE = /\bopacity:\s*(?:0?\.\d+|0\.0*[1-9]\d*)\s*[;}]/g;
const PILL = /\b9{3,}px/g;
const EASING = /\b(?:ease|ease-in|ease-out|ease-in-out)\b(?![-\w])/g;
const HAIRLINE = /\bborder[-a-z]*:[^;]*\b1px\b|calc\([^;]*\b1px\b/g;

function declText(decl) {
  const important = decl.important ? ' !important' : '';
  return `${decl.prop}:${decl.value}${important};`;
}

const rule = (primary) => (root, result) => {
  const valid = stylelint.utils.validateOptions(result, ruleName, {
    actual: primary,
    possible: [true],
  });
  if (!valid) return;

  const report = (node, message, index, length) => {
    stylelint.utils.report({
      ruleName,
      result,
      message,
      node,
      index,
      endIndex: index + length,
    });
  };

  const reportInDecl = (decl, message, matchIndex, length) => {
    const between = decl.raws.between?.length ?? 1;
    const valueStartInText = decl.prop.length + 1;
    const inValue = matchIndex - valueStartInText;
    const index = inValue >= 0 ? decl.prop.length + between + inValue : matchIndex;
    report(decl, message, index, length);
  };

  const scanAnywhere = (node, text, indexOf, calc) => {
    for (const match of text.matchAll(PILL)) {
      report(node, messages.pill(match[0]), indexOf(match.index), match[0].length);
    }
    for (const match of text.matchAll(EASING)) {
      report(node, messages.easing(match[0]), indexOf(match.index), match[0].length);
    }
    if (!calc) return;
    for (const match of text.matchAll(/calc\([^;]*\b(1px)\b/g)) {
      const raw = match[1];
      const rawIndex = match.index + match[0].lastIndexOf(raw);
      report(node, messages.hairline, indexOf(rawIndex), raw.length);
    }
  };

  root.walkDecls((decl) => {
    if (insideForcedColors(decl)) return;
    const text = declText(decl);
    for (const match of text.matchAll(LEADING)) {
      const raw = match[0].match(/[\d.]+/)?.[0] ?? match[0];
      const rawIndex = match.index + match[0].indexOf(raw);
      reportInDecl(decl, messages.leading(raw), rawIndex, raw.length);
    }
    for (const match of text.matchAll(FADE)) {
      const raw = match[0].match(/(?:0?\.\d+|0\.0*[1-9]\d*)/)?.[0] ?? match[0];
      const rawIndex = match.index + match[0].indexOf(raw);
      reportInDecl(decl, messages.fade(raw), rawIndex, raw.length);
    }
    for (const match of text.matchAll(HAIRLINE)) {
      const rawIndex = match.index + match[0].lastIndexOf('1px');
      reportInDecl(decl, messages.hairline, rawIndex, 3);
    }
    scanAnywhere(
      decl,
      decl.value,
      (offset) => decl.prop.length + (decl.raws.between?.length ?? 1) + offset,
      false,
    );
  });

  root.walkRules((ruleNode) => {
    if (insideForcedColors(ruleNode)) return;
    scanAnywhere(ruleNode, ruleNode.selector, (offset) => offset, true);
  });

  root.walkAtRules((atRule) => {
    if (insideForcedColors(atRule) || forcedColorsQuery(atRule)) return;
    scanAnywhere(atRule, atRule.params, (offset) => atRule.name.length + 1 + offset, true);
  });
};

rule.ruleName = ruleName;
rule.messages = messages;

export default stylelint.createPlugin(ruleName, rule);
