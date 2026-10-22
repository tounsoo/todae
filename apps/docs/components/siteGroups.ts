/**
 * The docs sections, in order. The sidebar and the home page both list these.
 * Foundations reads as a path, so it keeps its own order; every other section is alphabetical by name.
 * A link's optional third element lists its child pages, which the sidebar nests under it.
 */
export const SITE_GROUPS = [
  {
    id: 'foundations',
    label: 'Foundations',
    links: [
      ['/guides/get-started', 'Get started'],
      ['/guides/build-on-todae', 'Build on Todae'],
      ['/composition', 'Composition'],
      ['/tokens', 'Tokens'],
      ['/guides/css-layers', 'CSS layers'],
      ['/platform', 'Native platform'],
    ],
  },
  {
    id: 'components',
    label: 'Components',
    links: [
      ['/alert', 'Alert'],
      ['/attachment', 'Attachment'],
      ['/avatar', 'Avatar'],
      ['/badge', 'Badge'],
      ['/bottomsheet', 'BottomSheet'],
      ['/breadcrumbs', 'Breadcrumbs'],
      ['/button', 'Button'],
      ['/calendar', 'Calendar'],
      ['/card', 'Card'],
      ['/checkbox', 'Checkbox'],
      ['/chip', 'Chip'],
      ['/chip-list', 'ChipList'],
      ['/code', 'Code and Kbd'],
      ['/color-picker', 'ColorPicker'],
      ['/composer', 'Composer'],
      ['/contents', 'Contents'],
      ['/conversation', 'Conversation'],
      ['/data-list', 'DataList'],
      ['/description', 'Description'],
      ['/dialog', 'Dialog'],
      ['/disclosure', 'Disclosure'],
      ['/drawer', 'Drawer'],
      ['/drilldown', 'Drilldown'],
      ['/empty-state', 'EmptyState'],
      ['/errormessage', 'ErrorMessage'],
      [
        '/field',
        'Field',
        [
          ['/field/chip-input', 'ChipInput'],
          ['/field/color-picker', 'ColorPicker'],
          ['/field/date-picker', 'DatePicker'],
          ['/field/date-range-picker', 'DateRangePicker'],
          ['/field/date-time-picker', 'DateTimePicker'],
          ['/field/number-input', 'NumberInput'],
          ['/field/one-time-code', 'OneTimeCode'],
          ['/field/select', 'Select'],
          ['/field/textarea', 'Textarea'],
          ['/field/text-input', 'TextInput'],
          ['/field/time-picker', 'TimePicker'],
        ],
      ],
      ['/fieldset', 'Fieldset'],
      ['/form', 'Form'],
      ['/grid', 'Grid'],
      ['/label', 'Label'],
      ['/link', 'Link'],
      ['/loader', 'Loader and Skeleton'],
      ['/menu', 'Menu'],
      ['/message', 'Message'],
      ['/nav', 'Nav'],
      ['/optionlist', 'OptionList'],
      ['/pagination', 'Pagination'],
      ['/popover', 'Popover'],
      ['/progress', 'Progress and Meter'],
      ['/prose', 'Prose'],
      ['/radio', 'Radio'],
      ['/scroll-area', 'ScrollArea'],
      ['/separator', 'Separator'],
      ['/slider', 'Slider'],
      ['/stack', 'Stack'],
      ['/steps', 'Steps'],
      ['/switch', 'Switch'],
      ['/table', 'Table'],
      ['/tabs', 'Tabs'],
      ['/text', 'Text'],
      ['/toast', 'Toast'],
      ['/toggle-group', 'ToggleGroup'],
      ['/toolbar', 'Toolbar'],
      ['/tooltip', 'Tooltip'],
      ['/tree', 'Tree'],
      ['/visually-hidden', 'VisuallyHidden'],
    ],
  },
  {
    id: 'utilities',
    label: 'Utilities',
    links: [
      ['/utilities/compose-refs', 'composeRefs'],
      ['/utilities/glyphs-provider', 'GlyphsProvider'],
      ['/utilities/strings-provider', 'StringsProvider'],
      ['/utilities/theme-override-style', 'themeOverrideStyle'],
      ['/utilities/use-announcer', 'useAnnouncer'],
      ['/utilities/use-chip-field', 'useChipField'],
      ['/utilities/use-chip-list', 'useChipList'],
      ['/utilities/use-clipboard', 'useClipboard'],
      ['/utilities/use-combobox', 'useCombobox'],
      ['/utilities/use-controlled-state', 'useControlledState'],
      ['/utilities/use-controlled-value', 'useControlledValue'],
      ['/utilities/use-dropzone', 'useDropzone'],
      ['/utilities/use-field', 'useField'],
      ['/utilities/use-focus-handoff', 'useFocusHandoff'],
      ['/utilities/use-highlight', 'useHighlight'],
      ['/utilities/use-hotkey', 'useHotkey'],
      ['/utilities/use-inline-edit', 'useInlineEdit'],
      ['/utilities/use-mentions', 'useMentions'],
      ['/utilities/use-modal-layer', 'useModalLayer'],
      ['/utilities/use-popover', 'usePopover'],
      ['/utilities/use-roving-focus', 'useRovingFocus'],
      ['/utilities/use-selection', 'useSelection'],
      ['/utilities/use-sheet-presentation', 'useSheetPresentation'],
      ['/utilities/use-tooltip', 'useTooltip'],
    ],
  },
  {
    id: 'recipes',
    label: 'Recipes',
    links: [
      ['/recipes/citations', 'Citations'],
      ['/recipes/combobox', 'Combobox'],
      ['/recipes/command-palette', 'Command palette'],
      ['/recipes/data-table', 'Data table'],
      ['/recipes/date-range-presets', 'Date range with presets'],
      ['/recipes/file-upload', 'File upload'],
      ['/recipes/inline-edit', 'Inline edit'],
      ['/recipes/message-actions', 'Message actions'],
      ['/recipes/reasoning', 'Reasoning'],
      ['/recipes/suggestions', 'Suggestions'],
      ['/recipes/tool-call', 'Tool call'],
      ['/recipes/wizard', 'Wizard'],
    ],
  },
  {
    id: 'tools',
    label: 'Tools',
    links: [
      ['/mcp', 'MCP server'],
      ['/playground', 'Playground'],
    ],
  },
] as const;

type SiteGroupLink = (typeof SITE_GROUPS)[number]['links'][number];
type ParentLink = Extract<SiteGroupLink, readonly [string, string, unknown]>;

/** Every href in the sidebar, child pages included. */
export type SiteHref = SiteGroupLink[0] | ParentLink[2][number][0];

/** A link's child pages, or none. */
export function childLinks(link: SiteGroupLink): readonly (readonly [SiteHref, string])[] {
  return link.length === 3 ? link[2] : [];
}

/** A group's links in sidebar order, each followed by its child pages. */
export function flatLinks(links: readonly SiteGroupLink[]): (readonly [SiteHref, string])[] {
  return links.flatMap((link) => [[link[0], link[1]] as const, ...childLinks(link)]);
}
