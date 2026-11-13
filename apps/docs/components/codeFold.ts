/**
 * Shown when scripts don't run, so the button of a long code block (DocsPre) can't open it: every long block whole,
 * with no button and no fade. SiteShell puts it in a `noscript` in the page's head. It lives outside DocsPre, a client
 * module, so the server component can read the string.
 */
export const FOLD_NOSCRIPT_CSS =
  '.docs-code-fold .docs-code-rest[hidden]{display:inline}.docs-code-toggle{display:none}.docs-code-fold:not([data-expanded]) .docs-pre pre{mask-image:none}';
