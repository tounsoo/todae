import stylelint from 'stylelint';
import valueParser from 'postcss-value-parser';
import { allowlist } from './raw-value-allowlist.mjs';

const ruleName = 'todae/no-raw-value';

const messages = stylelint.utils.ruleMessages(ruleName, {
  rejected: (kind, raw) =>
    `Unexpected raw ${kind} "${raw}". Use a token, var(--todae-…). Other allowed literals are in stylelint/raw-value-allowlist.mjs.`,
});

const COLOR_FNS = new Set([
  'rgb',
  'rgba',
  'hsl',
  'hsla',
  'hwb',
  'lab',
  'lch',
  'oklab',
  'oklch',
  'color',
  'color-mix',
]);

const MATH_FNS = new Set(['calc', 'min', 'max', 'clamp']);

const BORDER_SHORTHANDS = new Set([
  'border',
  'border-top',
  'border-right',
  'border-bottom',
  'border-left',
  'border-block',
  'border-block-start',
  'border-block-end',
  'border-inline',
  'border-inline-start',
  'border-inline-end',
  'outline',
  'column-rule',
]);

const NAMED_COLORS = new Set(
  `aliceblue antiquewhite aqua aquamarine azure beige bisque black blanchedalmond blue blueviolet brown burlywood cadetblue chartreuse chocolate coral cornflowerblue cornsilk crimson cyan darkblue darkcyan darkgoldenrod darkgray darkgreen darkgrey darkkhaki darkmagenta darkolivegreen darkorange darkorchid darkred darksalmon darkseagreen darkslateblue darkslategray darkslategrey darkturquoise darkviolet deeppink deepskyblue dimgray dimgrey dodgerblue firebrick floralwhite forestgreen fuchsia gainsboro ghostwhite gold goldenrod gray green greenyellow grey honeydew hotpink indianred indigo ivory khaki lavender lavenderblush lawngreen lemonchiffon lightblue lightcoral lightcyan lightgoldenrodyellow lightgray lightgreen lightgrey lightpink lightsalmon lightseagreen lightskyblue lightslategray lightslategrey lightsteelblue lightyellow lime limegreen linen magenta maroon mediumaquamarine mediumblue mediumorchid mediumpurple mediumseagreen mediumslateblue mediumspringgreen mediumturquoise mediumvioletred midnightblue mintcream mistyrose moccasin navajowhite navy oldlace olive olivedrab orange orangered orchid palegoldenrod palegreen paleturquoise palevioletred papayawhip peachpuff peru pink plum powderblue purple rebeccapurple red rosybrown royalblue saddlebrown salmon sandybrown seagreen seashell sienna silver skyblue slateblue slategray slategrey snow springgreen steelblue tan teal thistle tomato turquoise violet wheat white whitesmoke yellow yellowgreen`
    .split(/\s+/),
);

const SYSTEM_COLORS = new Set(
  `accentcolor accentcolortext activetext buttonborder buttonface buttontext canvas canvastext field fieldtext graytext highlight highlighttext linktext mark marktext selecteditem selecteditemtext visitedtext activeborder activecaption appworkspace background buttonhighlight buttonshadow captiontext inactiveborder inactivecaption inactivecaptiontext infobackground infotext menu menutext scrollbar threeddarkshadow threedface threedhighlight threedlightshadow threedshadow window windowframe windowtext`
    .split(/\s+/),
);

const ANYWHERE = new Set(allowlist.filter((entry) => !entry.where).map((entry) => entry.value));
const HAIRLINE = new Set(allowlist.filter((entry) => entry.where === 'hairline').map((entry) => entry.value));
const CIRCLE = new Set(allowlist.filter((entry) => entry.where === 'circle').map((entry) => entry.value));
const HUE = new Set(allowlist.filter((entry) => entry.where === 'hue').map((entry) => entry.value));

function isHairline(prop) {
  if (BORDER_SHORTHANDS.has(prop)) return true;
  if (prop === 'border-width' || prop === 'outline-width' || prop === 'column-rule-width') return true;
  return /^border(?:-[a-z]+)+-width$/.test(prop);
}

function isSpacing(prop) {
  return /^(margin|padding|inset|gap|row-gap|column-gap|scroll-margin|scroll-padding)(-|$)/.test(prop);
}

function isRadius(prop) {
  return prop === 'border-radius' || prop.endsWith('-radius');
}

function isColorProperty(prop) {
  return prop === 'color' || prop === 'fill' || prop === 'stroke' || prop.endsWith('-color');
}

function isShadow(prop) {
  return prop === 'box-shadow' || prop === 'text-shadow';
}

function modeOf(prop) {
  if (prop.startsWith('--')) return null;
  if (prop === 'font-size' || prop === 'font') return 'font-size';
  if (isRadius(prop)) return 'radius';
  if (isSpacing(prop)) return 'spacing';
  if (isHairline(prop)) return 'line-width';
  if (isShadow(prop)) return 'shadow';
  if (prop === 'background' || prop === 'background-image') return 'background';
  if (isColorProperty(prop)) return 'color';
  return null;
}

function isNumeric(word) {
  return /^[+-]?(?:\d+|\d*\.\d+)(?:[a-z%]+)?$/i.test(word);
}

function isPlainNumber(word) {
  return /^[+-]?(?:\d+|\d*\.\d+)$/.test(word);
}

function isPercent(word) {
  return /^[+-]?(?:\d+|\d*\.\d+)%$/i.test(word);
}

function isHex(word) {
  return /^#(?:[0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/i.test(word);
}

function isAllowed(word, prop, value) {
  const lower = word.toLowerCase();
  if (ANYWHERE.has(lower)) return true;
  if (isHairline(prop) && HAIRLINE.has(lower)) return true;
  if (isRadius(prop) && CIRCLE.has(lower)) return true;
  return HUE.has(lower) && /\blonger\s+hue\b/i.test(value);
}

function forcesColors(params) {
  return params.split(',').every((query) => /\(\s*forced-colors\s*:\s*active\s*\)/i.test(query));
}

function insideForcedColors(node) {
  for (let parent = node.parent; parent; parent = parent.parent) {
    if (parent.type === 'atrule' && parent.name === 'media' && forcesColors(parent.params)) return true;
  }
  return false;
}

function varFallback(nodes) {
  const comma = nodes.findIndex((node) => node.type === 'div' && node.value === ',');
  if (comma < 0) return [];
  return nodes.slice(comma + 1);
}

function kindFor(mode, colorish) {
  if (colorish) return 'color';
  return mode;
}

const rule = (primary) => (root, result) => {
  const valid = stylelint.utils.validateOptions(result, ruleName, {
    actual: primary,
    possible: [true],
  });
  if (!valid) return;

  root.walkDecls((decl) => {
    const mode = modeOf(decl.prop);
    if (!mode || insideForcedColors(decl)) return;

    const valueOffset = decl.prop.length + (decl.raws.between?.length ?? 0);
    const flag = (raw, colorish, sourceIndex) => {
      const index = valueOffset + sourceIndex;
      stylelint.utils.report({
        ruleName,
        result,
        message: messages.rejected(kindFor(mode, colorish), raw),
        node: decl,
        index,
        endIndex: index + raw.length,
      });
    };

    const walk = (nodes, inColorFn, inMath) => {
      for (const node of nodes) {
        if (node.type === 'function') {
          const name = node.value.toLowerCase();
          if (name === 'url') continue;
          if (name === 'var') {
            walk(varFallback(node.nodes), inColorFn, inMath);
            continue;
          }
          walk(node.nodes, inColorFn || COLOR_FNS.has(name), inMath || MATH_FNS.has(name));
          continue;
        }
        if (node.type !== 'word') continue;
        const raw = node.value;
        if (isAllowed(raw, decl.prop, decl.value)) continue;
        const lower = raw.toLowerCase();
        if (SYSTEM_COLORS.has(lower)) continue;
        const colorish = isHex(raw) || NAMED_COLORS.has(lower);
        const numeric = isNumeric(raw);
        if (numeric && inMath && isPlainNumber(raw)) continue;
        if (numeric && inColorFn && isPercent(raw)) continue;
        const colorContext =
          mode === 'color' || mode === 'background' || mode === 'line-width' || mode === 'shadow' || inColorFn;
        if (colorish && colorContext) {
          flag(raw, true, node.sourceIndex);
          continue;
        }
        if (!numeric) continue;
        if (inColorFn && mode !== 'spacing' && mode !== 'radius' && mode !== 'font-size') {
          flag(raw, true, node.sourceIndex);
          continue;
        }
        if (mode === 'background' || mode === 'shadow') continue;
        if (mode === 'color' && !inColorFn) continue;
        flag(raw, false, node.sourceIndex);
      }
    };

    walk(valueParser(decl.value).nodes, false, false);
  });
};

rule.ruleName = ruleName;
rule.messages = messages;

export default stylelint.createPlugin(ruleName, rule);
