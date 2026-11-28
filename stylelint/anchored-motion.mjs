import stylelint from 'stylelint';

const ruleName = 'todae/anchored-motion';

const messages = stylelint.utils.ruleMessages(ruleName, {
  customProperty: (name) =>
    `Unexpected transition of ${name} in a sheet with anchor positioning. WebKit lays out a box with position-try ` +
    'fallbacks from an animating custom property\'s end value, so a margin that reads it jumped instead of sliding (#529). ' +
    'Transition the properties that read it, such as margin-block-start and margin-block-end.',
  all: () =>
    'Unexpected transition of all properties in a sheet with anchor positioning, by all or by naming none. It transitions ' +
    'a registered length too, which WebKit lays out from its end value (#529). Name the properties that move, such as ' +
    'opacity, margin-block-start and margin-block-end.',
  tryMargin: (prop, name) =>
    `Unexpected ${prop} reading the local ${name} in a named @position-try. Firefox transitions a margin a named try sets from the ` +
    'margin outside the try, so a flipped surface slid in from the far side (#529). Flip with the flip-block or ' +
    'flip-inline tactic in position-try-fallbacks, which mirrors the margins too.',
});

const ANCHOR_PROPS = new Set(['position-anchor', 'position-area', 'position-try', 'position-try-fallbacks', 'anchor-name']);
const ANCHOR_FUNCTION = /\banchor(?:-size)?\(/i;
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
  const end = (i) => {
    if (start >= 0) out.push({ text: text.slice(start, i), start });
    start = -1;
  };
  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    if (char === '(') {
      if (depth === 0 && start < 0) start = i;
      depth += 1;
    } else if (char === ')') {
      depth -= 1;
      if (depth === 0) end(i + 1);
    } else if (depth === 0) {
      if (/\s/.test(char)) end(i);
      else if (start < 0) start = i;
    }
  }
  end(text.length);
  return out;
}

const TIMING_WORDS = new Set(['ease', 'ease-in', 'ease-out', 'ease-in-out', 'linear', 'step-start', 'step-end', 'normal', 'allow-discrete']);
const TIME = /^[+-]?(?:\d*\.)?\d+(?:ms|s)$/i;

/** Whether a word of a transition item is its duration, delay, easing or behavior, so not the property it names. */
function isTiming(word) {
  const lower = word.toLowerCase();
  return TIME.test(word) || TIMING_WORDS.has(lower) || /^(?:cubic-bezier|steps|linear)\(/.test(lower);
}

const rule = (primary) => (root, result) => {
  const valid = stylelint.utils.validateOptions(result, ruleName, { actual: primary, possible: [true] });
  if (!valid) return;

  let anchors = false;
  root.walkAtRules((atRule) => {
    if (atRule.name.toLowerCase() === 'position-try') anchors = true;
  });
  root.walkDecls((decl) => {
    if (ANCHOR_PROPS.has(decl.prop.toLowerCase()) || ANCHOR_FUNCTION.test(decl.value)) anchors = true;
  });

  const valueStart = (decl) => decl.prop.length + (decl.raws.between?.length ?? 0);

  if (anchors) {
    root.walkDecls((decl) => {
      const prop = decl.prop.toLowerCase();
      if (!TRANSITION_PROPS.has(prop)) return;
      for (const item of items(decl.value)) {
        const words = topLevelWords(item.text);
        for (const word of words) {
          const index = valueStart(decl) + item.start + word.start;
          if (word.text.startsWith('--')) {
            stylelint.utils.report({ ruleName, result, node: decl, message: messages.customProperty(word.text), index, endIndex: index + word.text.length });
          } else if (word.text.toLowerCase() === 'all') {
            stylelint.utils.report({ ruleName, result, node: decl, message: messages.all(), index, endIndex: index + 3 });
          }
        }
        // A shorthand item that names no property transitions all of them. A var() may name one, so it is not timing.
        if (prop === 'transition' && words.length > 0 && words.every((word) => isTiming(word.text))) {
          const index = valueStart(decl) + item.start + words[0].start;
          stylelint.utils.report({ ruleName, result, node: decl, message: messages.all(), index, endIndex: index + words[0].text.length });
        }
      }
    });
  }

  root.walkAtRules((atRule) => {
    if (atRule.name.toLowerCase() !== 'position-try') return;
    atRule.walkDecls((decl) => {
      if (!decl.prop.toLowerCase().startsWith('margin')) return;
      for (const match of decl.value.matchAll(/var\(\s*(--[\w-]+)/gi)) {
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
