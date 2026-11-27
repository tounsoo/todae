// Browser tests that check behavior macOS itself changes, so they cannot pass on a Mac whatever the code does.
// The browser setups of the package (src/test/browser-setup.ts) and the docs app (test/macosHost.ts) skip them
// only when the host running the browsers is macOS (Vitest's server.platform). CI runs every browser job in
// Linux, where each of them runs and fails the job like any other test, so CI still covers them.
//
// playwright.host.ts already gives each engine on a Mac what a launch option can set: a Firefox home it can
// start from, WebKit's full keyboard access and scrollbars that take width. What is left is macOS's own text,
// editing and focus behavior, which no launch option or test page can change:
//
// - Home and End: on macOS they leave the caret where it is in WebKit and Firefox, as in Safari. Linux moves
//   the caret to the start or end of the line.
// - Focus in WebKit: macOS WebKit skips links on Tab unless Safari's "Press Tab to highlight each item" is on,
//   which Playwright's WebKit has no way to turn on, and it does not focus a button it clicks, as Safari does not,
//   so focus has no button to go back to. Linux WebKit stops on links and focuses a clicked button.
// - Undo in WebKit: macOS WebKit undoes typed text and text a script inserted after it as one step.
// - Text drag: a drag of a text control's selection is a native macOS drag in Chromium and WebKit, which
//   Playwright's synthetic mouse does not start. Linux starts it.
// - Font metrics: todae's sans-serif stack lands on SF Pro on macOS and on Liberation Sans in CI (ci.yml's
//   "Use a sans-serif with a bold face" step), and CoreText keeps fractional line heights where Linux's FreeType
//   rounds them to whole pixels. A check of an exact position against text comes out a fraction of a pixel to
//   two pixels off on a Mac only. Pinning a font in the page would change what the tests read, so it is not done.
//
// Add an entry only for a failure that happens the same way on origin/main on a Mac, passes in CI, and comes
// from one of the macOS behaviors above. A test that fails because of the code is a bug, not an entry here.
// packages/design-system/src/test/macosHost.test.ts fails on an entry that names no test.

/** The engines the browser tests run in. */
export const ENGINES = ['chromium', 'firefox', 'webkit'] as const;
export type Engine = (typeof ENGINES)[number];

export interface MacosEntry {
  /** Test file, relative to the repo root. */
  file: string;
  /** Vitest's name for the test without the file: its describe blocks and its own name, joined by " > ". */
  test: string;
  /** The engines where macOS changes the behavior. */
  engines: readonly Engine[];
  reason: string;
}

const HOME_END = 'macOS Home and End leave the caret where it is; Linux moves it to the start or end of the line.';
const FOCUS =
  "macOS WebKit, as Safari, does not focus a button it clicks and skips links on Tab unless Safari's tab-to-links setting is on, which Playwright cannot turn on; Linux WebKit does both.";
const TEXT_DRAG = "A drag of a text control's selection is a native macOS drag, which Playwright's synthetic mouse does not start.";
const UNDO = 'macOS WebKit undoes the typed word and the inserted pick as one step, as Safari does; Linux WebKit undoes the pick alone.';
const FONT_METRICS = "macOS measures text in SF Pro with CoreText's fractional line heights; CI's Linux uses Liberation Sans rounded to whole pixels.";
// Not one of the macOS behaviors above: the same test is on the Firefox quarantine for issue 367, and its Chromium
// run fails the same way on a Mac only, on origin/main as well. Its cause is not known yet. It comes off with 367.
const ISSUE_367 = 'Issue 367: a right-to-left tab list scrolled by arrow keys ends under its start arrow; on a Mac Chromium fails it too.';

export const macosOnly: readonly MacosEntry[] = [
  {
    file: 'packages/design-system/src/browser/one-time-code.browser.test.tsx',
    test: 'Field.OneTimeCode in a browser > copies text dragged inside the field to the box it is dropped on',
    engines: ['chromium', 'webkit'],
    reason: TEXT_DRAG,
  },
  {
    file: 'packages/design-system/src/browser/scrollEdges.browser.test.tsx',
    test: 'scroll edge arrows > in a tab list > keep a tab that arrow keys focus in view, clear of the arrows, dir rtl',
    engines: ['chromium'],
    reason: ISSUE_367,
  },
  {
    file: 'packages/design-system/src/browser/coachmark.browser.test.tsx',
    test: 'Coachmark in a browser > moves focus in, cycles Tab between the popup and the target, and returns focus on Escape',
    engines: ['webkit'],
    reason: FOCUS,
  },
  {
    file: 'packages/design-system/src/browser/combobox.browser.test.tsx',
    test: 'useCombobox reset reopening a dialog > returns focus to what had it when reset reopened the dialog',
    engines: ['webkit'],
    reason: FOCUS,
  },
  {
    file: 'packages/design-system/src/browser/composites.browser.test.tsx',
    test: 'Field.Picker with a swatch in a browser > opens the picker, reports a picked color, and closes on Escape back to the button',
    engines: ['webkit'],
    reason: FOCUS,
  },
  {
    file: 'packages/design-system/src/browser/composites.browser.test.tsx',
    test: 'Field.Picker with a swatch in a browser > leaves the field to a text input beside it (swatch first)',
    engines: ['webkit'],
    reason: FOCUS,
  },
  {
    file: 'packages/design-system/src/browser/composites.browser.test.tsx',
    test: 'Field.Picker with a swatch in a browser > leaves the field to a text input beside it (swatch last)',
    engines: ['webkit'],
    reason: FOCUS,
  },
  {
    file: 'packages/design-system/src/browser/composites.browser.test.tsx',
    test: 'Field.Picker beside a Field.DateInput in a browser > opens a calendar on the date, picks a date from the keyboard, and returns focus to the button',
    engines: ['webkit'],
    reason: FOCUS,
  },
  {
    file: 'packages/design-system/src/browser/composites.browser.test.tsx',
    test: 'Field.Picker beside a Field.DateInput in a browser > closes on Escape without picking, and reports why it closed',
    engines: ['webkit'],
    reason: FOCUS,
  },
  {
    file: 'packages/design-system/src/browser/content.browser.test.tsx',
    test: 'content parts in a browser > lets a container component style a Link.Root inside it, as Pagination does',
    engines: ['webkit'],
    reason: FOCUS,
  },
  {
    file: 'packages/design-system/src/browser/content.browser.test.tsx',
    test: 'content parts in a browser > hides visually hidden text from the screen but keeps it in the page',
    engines: ['webkit'],
    reason: FOCUS,
  },
  {
    file: 'packages/design-system/src/browser/drilldown-focus.browser.test.tsx',
    test: 'Drilldown focus and surface reset in a browser > leaves focus on a control outside the views that set a controlled stack',
    engines: ['webkit'],
    reason: FOCUS,
  },
  {
    file: 'packages/design-system/src/browser/form.browser.test.tsx',
    test: 'Form in a browser > focuses the control from a summary link, with the keyboard too',
    engines: ['webkit'],
    reason: FOCUS,
  },
  {
    file: 'packages/design-system/src/browser/layout.browser.test.tsx',
    test: 'Pagination in a browser > keeps focus on the control the user pressed, at the ends too',
    engines: ['webkit'],
    reason: FOCUS,
  },
  {
    file: 'packages/design-system/src/browser/mentions.browser.test.tsx',
    test: 'useMentions in a browser > undoes a pick back to the typed word, and redo brings the token back',
    engines: ['webkit'],
    reason: UNDO,
  },
  {
    file: 'packages/design-system/src/browser/nav.browser.test.tsx',
    test: 'Nav in a browser > is a Tab stop per link and toggle, and opens a branch from the keyboard',
    engines: ['webkit'],
    reason: FOCUS,
  },
  {
    file: 'packages/design-system/src/browser/nav.browser.test.tsx',
    test: 'Nav in a browser > draws the focus ring inside the row, so a narrow scroll area keeps it whole',
    engines: ['webkit'],
    reason: FOCUS,
  },
  {
    file: 'packages/design-system/src/browser/number.browser.test.tsx',
    test: 'Field.NumberInput in a browser > keeps the caret where it was when a keystroke is refused, and Home and End move it',
    engines: ['firefox', 'webkit'],
    reason: HOME_END,
  },
  {
    file: 'packages/design-system/src/browser/one-time-code.browser.test.tsx',
    test: 'Field.OneTimeCode in a browser > replaces the box at the caret when a character is typed into a full code',
    engines: ['firefox', 'webkit'],
    reason: HOME_END,
  },
  {
    file: 'packages/design-system/src/browser/one-time-code.browser.test.tsx',
    test: 'Field.OneTimeCode in a browser > shows the focus on the row of boxes, in no box, with the caret after a full code',
    engines: ['firefox', 'webkit'],
    reason: HOME_END,
  },
  {
    file: 'packages/design-system/src/browser/one-time-code.browser.test.tsx',
    test: 'Field.OneTimeCode in a browser > replaces the characters from the caret with a short paste on a full code',
    engines: ['firefox', 'webkit'],
    reason: HOME_END,
  },
  {
    file: 'packages/design-system/src/browser/one-time-code.browser.test.tsx',
    test: 'Field.OneTimeCode in a browser > marks the active box inside a shadow root',
    engines: ['firefox', 'webkit'],
    reason: HOME_END,
  },
  {
    file: 'packages/design-system/src/browser/overlays.browser.test.tsx',
    test: 'BottomSheet in a browser > gives focus back to its trigger once the exit motion ends',
    engines: ['webkit'],
    reason: FOCUS,
  },
  {
    file: 'packages/design-system/src/browser/stacking.browser.test.tsx',
    test: 'stacked overlays in a browser > closes the innermost overlay first on Escape, then restores focus',
    engines: ['webkit'],
    reason: FOCUS,
  },
  {
    file: 'packages/design-system/src/browser/temporal-inputs.browser.test.tsx',
    test: 'Field.Picker with times in a browser > picks a time from the list with the keyboard and gives focus back to the button',
    engines: ['webkit'],
    reason: FOCUS,
  },
  {
    file: 'packages/design-system/src/browser/temporal-inputs.browser.test.tsx',
    test: 'Field.Picker with times in a browser > beside a calendar with closeOnPick off, picks a date, then a time, and closes on the time',
    engines: ['webkit'],
    reason: FOCUS,
  },
  {
    file: 'packages/design-system/src/browser/text.browser.test.tsx',
    test: 'Text.Root lines > shows the tip of the first cut text a focused element holds, and hides it on blur',
    engines: ['webkit'],
    reason: FOCUS,
  },
  {
    file: 'packages/design-system/src/browser/text.browser.test.tsx',
    test: 'Text.Root lines > keeps a focus-held tip open when the pointer leaves',
    engines: ['webkit'],
    reason: FOCUS,
  },
  {
    file: 'packages/design-system/src/browser/text.browser.test.tsx',
    test: 'Text.Root lines > takes the first Escape for a tip opened by focus, as a visible tip must be dismissable',
    engines: ['webkit'],
    reason: FOCUS,
  },
  {
    file: 'packages/design-system/src/browser/text.browser.test.tsx',
    test: 'Text.Root lines > shows no tip when a click focuses a link that holds cut text',
    engines: ['webkit'],
    reason: FOCUS,
  },
  {
    file: 'packages/design-system/src/browser/text.browser.test.tsx',
    test: 'Text.Root lines > shows no tip from an aria-activedescendant host, and looks past an element that cannot take focus',
    engines: ['webkit'],
    reason: FOCUS,
  },
  {
    file: 'packages/design-system/src/browser/toast.browser.test.tsx',
    test: 'Toast with a modal dialog > keeps toasts inside a dialog of your own until it closes after open turns false',
    engines: ['webkit'],
    reason: FOCUS,
  },
  {
    file: 'packages/design-system/src/browser/toast.browser.test.tsx',
    test: "Toast with a modal dialog > keeps the dialog's own focus to return to, not a toast's",
    engines: ['webkit'],
    reason: FOCUS,
  },
  {
    file: 'packages/design-system/src/browser/drilldown-motion.browser.test.tsx',
    test: 'Drilldown motion, height and scroll in a browser > scrolls a page that scrolls itself to the top of an inline Drilldown on push, and back on pop',
    engines: ['firefox'],
    reason: FONT_METRICS,
  },
  {
    file: 'packages/design-system/src/browser/layout.browser.test.tsx',
    test: 'Stack in a browser > wraps, aligns and spreads items',
    engines: ['firefox'],
    reason: FONT_METRICS,
  },
  {
    file: 'apps/docs/components/demos/EventCalendar.browser.test.tsx',
    test: 'month bar polish > circles today on the number and leaves the cell border alone',
    engines: ['chromium'],
    reason: FONT_METRICS,
  },
];

/** The entry that skips this test on this host, if any. `filepath` is Vitest's absolute path of the test file. */
export function macosEntry(platform: string, browser: string, filepath: string, test: string | undefined): MacosEntry | undefined {
  if (platform !== 'darwin' || test === undefined) return undefined;
  const file = filepath.replaceAll('\\', '/');
  return macosOnly.find(
    (entry) => (file === entry.file || file.endsWith(`/${entry.file}`)) && entry.test === test && (entry.engines as readonly string[]).includes(browser),
  );
}
