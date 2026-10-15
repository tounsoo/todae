'use client';

import {
  Badge,
  BottomSheet,
  Button,
  Code,
  COMPONENT_OVERRIDE_KEYS,
  Field,
  RAW_OVERRIDE_KEYS,
  ScrollArea,
  SEMANTIC_OVERRIDE_KEYS,
  Stack,
  StringsProvider,
  Tabs,
  ThemeProvider,
  ToggleGroup,
  cssVarName,
  parseThemeValue,
  themeOverrideType,
  themeValueCss,
  useClipboard,
  VisuallyHidden,
  type Appearance,
  type Density,
  type ThemeOverride,
  type ThemeOverrideKey,
} from '@omsoo.design/todae';
import { useLayoutEffect, useRef, useState, useSyncExternalStore } from 'react';
import type { Locale } from '../lib/i18n/config';
import { DICTIONARIES } from '../lib/i18n/dictionaries';
import { TODAE_STRINGS } from '../lib/i18n/todaeStrings';
import { PRESETS, type ThemePreset } from './playground/presets';
import { ICON_LIBRARIES } from './iconLibraries';
import { Preview } from './playground/Preview';

const LAYERS = {
  raw: RAW_OVERRIDE_KEYS,
  semantic: SEMANTIC_OVERRIDE_KEYS,
  component: COMPONENT_OVERRIDE_KEYS,
} as const;

type Layer = keyof typeof LAYERS;
const LAYER_NAMES = Object.keys(LAYERS) as Layer[];
const APPEARANCES = ['system', 'light', 'dark'] as const;
const DENSITIES = ['compact', 'comfortable', 'spacious'] as const;

const NO_EDITS = { light: {}, dark: {} };

const DARK = '(prefers-color-scheme: dark)';
// Below the width that fits the rail beside the stage, the token editor moves into a sheet.
// globals.css uses the same breakpoint.
const NARROW = 'screen and (width < 64rem)';

function subscribeTo(media: string) {
  return (onChange: () => void) => {
    const query = window.matchMedia(media);
    query.addEventListener('change', onChange);
    return () => query.removeEventListener('change', onChange);
  };
}
const subscribeScheme = subscribeTo(DARK);
const subscribeNarrow = subscribeTo(NARROW);

/** The appearance the stage resolves to, so the preset's matching override set applies. */
function useResolvedAppearance(appearance: Appearance): 'light' | 'dark' {
  const systemDark = useSyncExternalStore(
    subscribeScheme,
    () => window.matchMedia(DARK).matches,
    () => false,
  );
  if (appearance === 'system') return systemDark ? 'dark' : 'light';
  return appearance;
}

let swatchContext: CanvasRenderingContext2D | null | undefined;
const hexCache = new Map<string, string>();

/**
 * Any CSS color as #rrggbb, for Field.ColorPicker. Painting one pixel
 * resolves every syntax the browser knows (oklch, relative colors) to sRGB.
 * One canvas serves every swatch, and each value is resolved once.
 */
function toHex(value: string): string {
  if (/^#[0-9a-f]{6}$/i.test(value)) return value.toLowerCase();
  if (typeof document === 'undefined') return '#000000';
  const cached = hexCache.get(value);
  if (cached) return cached;
  if (swatchContext === undefined) {
    swatchContext = document.createElement('canvas').getContext('2d', { willReadFrequently: true });
  }
  const ctx = swatchContext;
  if (!ctx) return '#000000';
  ctx.clearRect(0, 0, 1, 1);
  ctx.fillStyle = '#000000';
  ctx.fillStyle = value;
  ctx.fillRect(0, 0, 1, 1);
  const [r = 0, g = 0, b = 0] = ctx.getImageData(0, 0, 1, 1).data;
  const hex = `#${[r, g, b].map((n) => n.toString(16).padStart(2, '0')).join('')}`;
  hexCache.set(value, hex);
  return hex;
}

function TokenField({
  path,
  value,
  edited,
  colorLabel,
  onCommit,
}: {
  path: ThemeOverrideKey;
  value: string;
  edited: boolean;
  colorLabel: string;
  onCommit: (next: ThemeOverride[ThemeOverrideKey]) => void;
}) {
  const id = `token-${path.replaceAll('.', '-')}`;
  const color = themeOverrideType(path) === 'color';
  // What the reader is typing. It commits as soon as it parses, and shows as invalid until then.
  const [draft, setDraft] = useState<string | null>(null);
  const invalid = draft !== null && parseThemeValue(path, draft) === null;
  return (
    <div className="token-row" data-edited={edited || undefined}>
      <label htmlFor={id}>
        <Code.Root>{path}</Code.Root>
      </label>
      <div className="token-row-inputs">
        {color ? (
          <Field.Root aria-label={`${path} ${colorLabel}`}>
            <Field.ColorPicker
              value={toHex(value || '#000000')}
              onValueChange={(next) => {
                const parsed = parseThemeValue(path, next);
                if (parsed !== null) onCommit(parsed);
              }}
            />
          </Field.Root>
        ) : null}
        <Field.Root id={id} invalid={invalid}>
          <Field.TextInput
            spellCheck={false}
            value={draft ?? value}
            onChange={(event) => {
              const next = event.target.value;
              setDraft(next);
              const parsed = parseThemeValue(path, next);
              if (parsed !== null) onCommit(parsed);
            }}
            onBlur={() => setDraft(null)}
          />
        </Field.Root>
      </div>
    </div>
  );
}

function PresetCard({
  preset,
  appearance,
  selected,
  onSelect,
}: {
  preset: ThemePreset;
  appearance: 'light' | 'dark';
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <label className="preset" data-selected={selected || undefined}>
      <VisuallyHidden.Root>
        <input type="radio" name="preset" aria-label={preset.name} checked={selected} onChange={onSelect} />
      </VisuallyHidden.Root>
      {/* A tiny stage of its own: the preset paints its own swatch with Todae's tokens. */}
      <ThemeProvider appearance={appearance} overrides={preset[appearance]} className="preset-swatch" aria-hidden="true">
        <span className="preset-swatch-surface">
          <span className="preset-swatch-type">Aa</span>
          <span className="preset-swatch-accent" />
          <span className="preset-swatch-line" />
          <span className="preset-swatch-line preset-swatch-line-short" />
        </span>
      </ThemeProvider>
      <span className="preset-name" lang="en">
        {preset.name}
      </span>
    </label>
  );
}

/**
 * Whether the screen is too narrow for the rail beside the stage. The server
 * renders the wide layout; globals.css hides its token editor on narrow
 * screens until this takes over.
 */
function useNarrow(): boolean {
  return useSyncExternalStore(subscribeNarrow, narrowSnapshot, () => false);
}

let lastNarrow = false;
/**
 * Printing flips NARROW off, which would close an open sheet for good. The
 * layout keeps what the screen had while printing, and globals.css handles print.
 */
function narrowSnapshot(): boolean {
  if (!window.matchMedia('print').matches) lastNarrow = window.matchMedia(NARROW).matches;
  return lastNarrow;
}

/**
 * Writes the fixed bar's height to --docs-pg-bar on the root, for the space
 * globals.css keeps at the end of the page and the root's scroll padding. Measured,
 * since the copy status and the safe area change it.
 */
function reserveBar(bar: HTMLElement | null) {
  if (!bar) return;
  const root = document.documentElement;
  const observer = new ResizeObserver(() => {
    root.style.setProperty('--docs-pg-bar', `${Math.ceil(bar.getBoundingClientRect().height)}px`);
  });
  // The border box, since the safe area changes the bar's padding and not its content.
  observer.observe(bar, { box: 'border-box' });
  return () => {
    observer.disconnect();
    root.style.removeProperty('--docs-pg-bar');
  };
}

/** The theme playground. Each locale's /playground page renders it. */
export function Playground({ locale }: { locale: Locale }) {
  // Option values, layer names and preset names are Todae's own names and stay in English; the preview follows the locale.
  const t = DICTIONARIES[locale].playground;
  const clipboard = useClipboard({ resetAfter: false, copiedMessage: t.copied, failedMessage: t.copyFailed });
  const stageRef = useRef<HTMLDivElement>(null);
  const [appearance, setAppearance] = useState<Appearance>('system');
  const [density, setDensity] = useState<Density>('comfortable');
  // Todae's own glyphs, or one of three icon libraries for the preview's icons and glyphs.
  const [iconsId, setIconsId] = useState('todae');
  const [layer, setLayer] = useState<Layer>('semantic');
  const [filter, setFilter] = useState('');
  const [presetId, setPresetId] = useState(PRESETS[0]?.id ?? 'graphite');
  // Edits belong to the appearance they were made in, like a preset's own two sets.
  const [edits, setEdits] = useState<Record<'light' | 'dark', ThemeOverride>>(NO_EDITS);
  const [computed, setComputed] = useState<Partial<Record<ThemeOverrideKey, string>>>({});
  const [sheetOpen, setSheetOpen] = useState(false);
  const narrow = useNarrow();
  const Rail = narrow ? 'div' : 'aside';
  const resolved = useResolvedAppearance(appearance);
  const preset = PRESETS.find((candidate) => candidate.id === presetId) ?? PRESETS[0];
  const overrides: ThemeOverride = { ...preset?.[resolved], ...edits[resolved] };
  const paths = LAYERS[layer].filter((path) => path.includes(filter.trim().toLowerCase()));
  const changed = Object.keys(edits.light).length + Object.keys(edits.dark).length;

  // Read what the stage resolves each shown token to, after every change that could move it.
  useLayoutEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    const style = getComputedStyle(el);
    const next: Partial<Record<ThemeOverrideKey, string>> = {};
    for (const path of LAYERS[layer]) next[path] = style.getPropertyValue(cssVarName(path)).trim();
    setComputed(next);
  }, [layer, resolved, density, presetId, edits]);

  function valueFor(path: ThemeOverrideKey): string {
    const typed = overrides[path];
    if (typed !== undefined) return themeValueCss(path, typed);
    return computed[path] ?? '';
  }

  const exportLight = { ...preset?.light, ...edits.light };
  const exportDark = { ...preset?.dark, ...edits.dark };
  // One flat set when light and dark are the same, such as plain Todae with no edits.
  const exportJson = `${JSON.stringify(
    JSON.stringify(exportLight) === JSON.stringify(exportDark) ? exportLight : { light: exportLight, dark: exportDark },
    null,
    2,
  )}\n`;

  function exportOverrides() {
    void clipboard.copy(exportJson);
  }

  // The result shows only for the JSON it was for, so it clears once the theme changes.
  const copyResult = { idle: null, copied: t.copied, failed: t.copyFailed }[clipboard.status];
  const copyStatus = clipboard.text === exportJson ? copyResult : null;
  const copyStatusLine = copyStatus ? <p className="pg-hint">{copyStatus}</p> : null;
  // A sheet left open when the window widens does not come back on its own.
  if (!narrow && sheetOpen) setSheetOpen(false);

  const changedLabel =
    changed > 0 ? <span className="pg-changed">{t.changed.replace('{count}', String(changed))}</span> : null;

  // One editor, in the rail on wide screens and in the sheet on narrow ones, so no id repeats.
  const tokenEditor = (
    <Tabs.Root value={layer} onValueChange={(next) => setLayer(next as Layer)}>
      <Tabs.List aria-label={t.tokenLayer}>
        {LAYER_NAMES.map((name) => (
          <Tabs.Tab key={name} value={name} lang="en">
            {name}
          </Tabs.Tab>
        ))}
      </Tabs.List>
      {LAYER_NAMES.map((name) => (
        <Tabs.Panel key={name} value={name} className="pg-token-panel">
          {name === layer ? (
            <>
              <Field.Root aria-label={t.filter} className="pg-filter">
                <Field.TextInput
                  type="search"
                  placeholder={t.filter}
                  value={filter}
                  onChange={(event) => setFilter(event.target.value)}
                />
              </Field.Root>
              <div className="pg-token-list">
                {paths.length === 0 ? <p className="pg-empty">{t.noMatch}</p> : null}
                {paths.map((path) => (
                  <TokenField
                    key={`${presetId}:${resolved}:${path}`}
                    path={path}
                    value={valueFor(path)}
                    edited={edits[resolved][path] !== undefined}
                    colorLabel={t.color}
                    onCommit={(next) =>
                      setEdits((prev) => ({ ...prev, [resolved]: { ...prev[resolved], [path]: next } }))
                    }
                  />
                ))}
              </div>
            </>
          ) : null}
        </Tabs.Panel>
      ))}
    </Tabs.Root>
  );

  const actions = (
    <div className="pg-actions">
      <Button.Root variant="secondary" onClick={() => setEdits(NO_EDITS)}>
        {t.reset}
      </Button.Root>
      <Button.Root onClick={exportOverrides}>{t.export}</Button.Root>
    </div>
  );

  // The presets and modes, in the rail on wide screens and in the sheet on narrow ones.
  const themeControls = (
    <>
      <fieldset className="pg-section">
        <legend className="pg-heading">{t.presets}</legend>
        {/* Sideways in the sheet's one row; a grid that fits in the rail. */}
        <ScrollArea.Root className="preset-scroll" axis={narrow ? 'inline' : 'block'} focusable={false}>
          <div className="preset-grid">
            {PRESETS.map((candidate) => (
              <PresetCard
                key={candidate.id}
                preset={candidate}
                appearance={resolved}
                selected={candidate.id === preset?.id}
                // A new preset starts clean, so its tokens show instead of earlier edits.
                onSelect={() => {
                  setPresetId(candidate.id);
                  setEdits(NO_EDITS);
                }}
              />
            ))}
          </div>
        </ScrollArea.Root>
      </fieldset>

      <div className="pg-section pg-modes">
        <div>
          <span className="pg-heading" id="pg-appearance">
            {t.appearance}
          </span>
          <ToggleGroup.Root
            aria-labelledby="pg-appearance"
            value={appearance}
            onValueChange={(next) => next && setAppearance(next as Appearance)}
          >
            {APPEARANCES.map((value) => (
              <ToggleGroup.Item key={value} value={value} lang="en">
                {value}
              </ToggleGroup.Item>
            ))}
          </ToggleGroup.Root>
        </div>
        <div>
          <span className="pg-heading" id="pg-density">
            {t.density}
          </span>
          <ToggleGroup.Root
            aria-labelledby="pg-density"
            value={density}
            onValueChange={(next) => next && setDensity(next as Density)}
          >
            {DENSITIES.map((value) => (
              <ToggleGroup.Item key={value} value={value} lang="en">
                {value}
              </ToggleGroup.Item>
            ))}
          </ToggleGroup.Root>
        </div>
        <div>
          <span className="pg-heading" id="pg-icons">
            {t.icons}
          </span>
          <ToggleGroup.Root aria-labelledby="pg-icons" value={iconsId} onValueChange={(next) => next && setIconsId(next)}>
            <ToggleGroup.Item value="todae" lang="en">
              Todae
            </ToggleGroup.Item>
            {ICON_LIBRARIES.map((library) => (
              <ToggleGroup.Item key={library.id} value={library.id} lang="en">
                {library.name}
              </ToggleGroup.Item>
            ))}
          </ToggleGroup.Root>
        </div>
      </div>
    </>
  );

  const tokenSection = (
    <section className="pg-section pg-tokens" aria-labelledby="pg-tokens">
      <Stack.Root direction="row" justify="between" align="baseline">
        <h2 className="pg-heading" id="pg-tokens">
          {t.tokens}
        </h2>
        {changedLabel}
      </Stack.Root>
      {tokenEditor}
    </section>
  );

  return (
    <div className="playground">
      {/* On narrow screens the controls are in the sheet, so the rail is only the intro, not a landmark. */}
      <Rail className="pg-rail" aria-label={narrow ? undefined : t.rail}>
        <ScrollArea.Root className="pg-rail-scroll" focusable={false}>
          <div className="pg-rail-body">
            <div className="pg-intro">
              <h1>{t.title}</h1>
              <p>{t.lead}</p>
            </div>

            {narrow ? null : (
              <>
                {themeControls}
                {tokenSection}
                {actions}
                <p className="pg-hint">{copyStatus ?? t.exportHint}</p>
              </>
            )}
          </div>
        </ScrollArea.Root>
      </Rail>
      {/* Overrides only beat density tokens on the element that carries
          data-density, so the stage carries both. */}
      <div className="pg-stage-theme">
        <ThemeProvider
          ref={stageRef}
          className="pg-stage"
          role="region"
          aria-label={t.stage}
          appearance={appearance}
          overrides={overrides}
          data-density={density}
        >
          {/* The preview is a product in the reader's language, so Todae's own text is too. */}
          <StringsProvider strings={TODAE_STRINGS[locale]}>
            <Preview locale={locale} library={ICON_LIBRARIES.find((library) => library.id === iconsId)} />
          </StringsProvider>
        </ThemeProvider>
      </div>
      {narrow ? (
        <>
          {/* Narrow screens: the stage sits right under the theme controls, and the
            tokens open in a sheet over its lower half. */}
          <div className="pg-sheet-bar" ref={reserveBar}>
            <Button.Root
              variant="secondary"
              aria-haspopup="dialog"
              onClick={() => {
                // The sheet covers the lower half, so a stage whose top is still below the viewport's
                // top is scrolled to sit under the top bar. One already scrolled past that stays put.
                const stage = stageRef.current;
                if (stage && stage.getBoundingClientRect().top > 0) stage.scrollIntoView({ block: 'start' });
                setSheetOpen(true);
              }}
            >
              {t.editTheme}
              {changed > 0 ? (
                <>
                  <Badge.Root aria-hidden="true">{changed}</Badge.Root>
                  <VisuallyHidden.Root>{`(${t.changed.replace('{count}', String(changed))})`}</VisuallyHidden.Root>
                </>
              ) : null}
            </Button.Root>
            <Button.Root onClick={exportOverrides}>{t.export}</Button.Root>
            {copyStatusLine}
          </div>
          <BottomSheet.Root className="pg-sheet" open={sheetOpen} onOpenChange={setSheetOpen}>
            {/* The site sets no StringsProvider, so the sheet's own controls get this locale's names here. */}
            <BottomSheet.Grabber aria-label={t.resizeSheet} />
            <BottomSheet.Header className="pg-sheet-head">
              <BottomSheet.Title>{t.rail}</BottomSheet.Title>
              <BottomSheet.Close aria-label={t.closeSheet} />
            </BottomSheet.Header>
            <BottomSheet.Body className="pg-sheet-body">
              {themeControls}
              {tokenSection}
              {/* At the end of the list, so it leaves the short sheet's room to the tokens. */}
              <BottomSheet.Description className="pg-hint">{t.exportHint}</BottomSheet.Description>
            </BottomSheet.Body>
            <BottomSheet.Footer className="pg-sheet-foot">
              {actions}
              {copyStatusLine}
            </BottomSheet.Footer>
          </BottomSheet.Root>
        </>
      ) : null}
    </div>
  );
}
