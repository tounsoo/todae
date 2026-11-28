import stylelint from 'stylelint';

const ruleName = 'todae/anchored-motion';

const messages = stylelint.utils.ruleMessages(ruleName, {
  customProperty: (name) =>
    `Unexpected transition of ${name} in a sheet with anchor positioning. WebKit lays out a box with position-try ` +
    'fallbacks from an animating custom property\'s end value, so a margin that reads it jumped instead of sliding (#529). ' +
    'Transition the properties that read it, such as margin-block-start and margin-block-end.',
  all: () =>
    'Unexpected transition of all in a sheet with anchor positioning that registers a custom property. It transitions the ' +
    'registered length too, which WebKit lays out from its end value (#529). Name the properties that move, such as ' +
    'opacity, margin-block-start and margin-block-end.',
  tryMargin: (prop, name) =>
    `Unexpected ${prop} reading the local ${name} in a named @position-try. Firefox transitions a margin a named try sets from the ` +
    'margin outside the try, so a flipped surface slid in from the far side (#529). Flip with the flip-block or ' +
    'flip-inline tactic in position-try-fallbacks, which mirrors the margins too.',
});

const ANCHOR_PROPS = new Set(['position-anchor', 'position-area', 'position-try', 'position-try-fallbacks', 'anchor-name']);
const ANCHOR_FUNCTION = /\banchor(?:-size)?\(/;
const TRANSITION_PROPS = new Set(['transition', 'transition-property']);

/** Splits a value on its top-level commas. */
function items(value) {
  const out = [];
  let depth = 0;
  let start = 0;
  for (let i = 0; i < value.length; i += 1) {
    const char = value[i];
    if (char === '(') depth += 1;
    else if (char === ')') depth -= 1;
    else if (char === ',' && depth === 0) {
      out.push({ text: value.slice(start, i), start });
      start = i + 1;
    }
  }
  out.push({ text: value.slice(start), start });
  return out;
}

/** The words of a transition item outside parentheses, so `var(--_d)` is not the property it names. */
function topLevelWords(text) {
  const out = [];
  let depth = 0;
  let start = -1;
  for (let i = 0; i <= text.length; i += 1) {
    const char = text[i];
    const space = char === undefined || /\s/.test(char);
    if (depth === 0 && start >= 0 && (space || char === '(')) {
      if (char !== '(') out.push({ text: text.slice(start, i), start });
      start = char === '(' ? start : -1;
    }
    if (char === '(') depth += 1;
    else if (char === ')') depth -= 1;
    else if (depth === 0 && !space && start < 0) start = i;
  }
  return out;
}

const rule = (primary) => (root, result) => {
  const valid = stylelint.utils.validateOptions(result, ruleName, { actual: primary, possible: [true] });
  if (!valid) return;

  let anchors = false;
  const registered = new Set();
  root.walkAtRules((atRule) => {
    if (atRule.name === 'position-try') anchors = true;
    if (atRule.name === 'property') registered.add(atRule.params.trim());
  });
  root.walkDecls((decl) => {
    if (ANCHOR_PROPS.has(decl.prop) || ANCHOR_FUNCTION.test(decl.value)) anchors = true;
  });

  const valueStart = (decl) => decl.prop.length + (decl.raws.between?.length ?? 0);

  if (anchors) {
    root.walkDecls((decl) => {
      if (!TRANSITION_PROPS.has(decl.prop)) return;
      for (const item of items(decl.value)) {
        for (const word of topLevelWords(item.text)) {
          const index = valueStart(decl) + item.start + word.start;
          if (word.text.startsWith('--')) {
            stylelint.utils.report({ ruleName, result, node: decl, message: messages.customProperty(word.text), index, endIndex: index + word.text.length });
          } else if (word.text === 'all' && registered.size > 0) {
            stylelint.utils.report({ ruleName, result, node: decl, message: messages.all(), index, endIndex: index + 3 });
          }
        }
      }
    });
  }

  root.walkAtRules('position-try', (atRule) => {
    atRule.walkDecls((decl) => {
      if (!decl.prop.startsWith('margin')) return;
      for (const match of decl.value.matchAll(/var\(\s*(--[\w-]+)/g)) {
        if (!match[1].startsWith('--_')) continue;
        const index = valueStart(decl) + match.index;
        stylelint.utils.report({ ruleName, result, node: decl, message: messages.tryMargin(decl.prop, match[1]), index, endIndex: index + match[0].length });
      }
    });
  });
};

rule.ruleName = ruleName;
rule.messages = messages;

export default stylelint.createPlugin(ruleName, rule);
