'use client';

import {
  Button,
  COMPONENT_OVERRIDE_KEYS,
  DensityProvider,
  Field,
  RAW_OVERRIDE_KEYS,
  SEMANTIC_OVERRIDE_KEYS,
  Tabs,
  ThemeProvider,
  ToggleGroup,
  cssVarName,
  parseThemeValue,
  themeOverrideType,
  themeValueCss,
  useAnnouncer,
  type Appearance,
  type Density,
  type ThemeOverride,
  type ThemeOverrideKey,
} from '@tounsoo/todae';
import { useLayoutEffect, useRef, useState, useSyncExternalStore } from 'react';
import type { Locale } from '../lib/i18n/config';
import { DICTIONARIES } from '../lib/i18n/dictionaries';
import { PRESET_FONTS_HREF, PRESETS, type ThemePreset } from './playground/presets';
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
function subscribeScheme(onChange: () => void) {
  const query = window.matchMedia(DARK);
  query.addEventListener('change', onChange);
  return () => query.removeEventListener('change', onChange);
}

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
 * Any CSS color as #rrggbb, for the native color input. Painting one pixel
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
        <code>{path}</code>
      </label>
      <div className="token-row-inputs">
        {color ? (
          <input
            type="color"
            className="token-swatch"
            aria-label={`${path} ${colorLabel}`}
            value={toHex(value || '#000000')}
            onChange={(event) => {
              const parsed = parseThemeValue(path, event.target.value);
              if (parsed !== null) onCommit(parsed);
            }}
          />
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
      <input
        type="radio"
        name="preset"
        className="todae-visually-hidden"
        aria-label={preset.name}
        checked={selected}
        onChange={onSelect}
      />
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

/** The theme playground. Each locale's /playground page renders it. */
export function Playground({ locale }: { locale: Locale }) {
  // Option values, layer names and preset names are Todae's own names and stay in English.
  const t = DICTIONARIES[locale].playground;
  const announce = useAnnouncer();
  const stageRef = useRef<HTMLDivElement>(null);
  const [appearance, setAppearance] = useState<Appearance>('system');
  const [density, setDensity] = useState<Density>('comfortable');
  const [layer, setLayer] = useState<Layer>('semantic');
  const [filter, setFilter] = useState('');
  const [presetId, setPresetId] = useState(PRESETS[0]?.id ?? 'todae');
  // Edits belong to the appearance they were made in, like a preset's own two sets.
  const [edits, setEdits] = useState<Record<'light' | 'dark', ThemeOverride>>(NO_EDITS);
  const [status, setStatus] = useState('');
  const [computed, setComputed] = useState<Partial<Record<ThemeOverrideKey, string>>>({});
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

  async function exportOverrides() {
    const light = { ...preset?.light, ...edits.light };
    const dark = { ...preset?.dark, ...edits.dark };
    // One flat set when light and dark are the same, such as plain Todae with no edits.
    const json = JSON.stringify(light) === JSON.stringify(dark) ? light : { light, dark };
    try {
      await navigator.clipboard.writeText(`${JSON.stringify(json, null, 2)}\n`);
      setStatus(t.copied);
      announce(t.copied);
    } catch {
      setStatus(t.copyFailed);
      announce(t.copyFailed, { politeness: 'assertive' });
    }
  }

  return (
    <div className="playground">
      {/* The presets' typefaces. React hoists this into <head>. */}
      <link rel="stylesheet" href={PRESET_FONTS_HREF} precedence="default" />
      <aside className="pg-rail" aria-label={t.rail}>
        <div className="pg-intro">
          <h1>{t.title}</h1>
          <p>{t.lead}</p>
        </div>

        <fieldset className="pg-section">
          <legend className="pg-heading">{t.presets}</legend>
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
        </div>

        <section className="pg-section pg-tokens" aria-labelledby="pg-tokens">
          <div className="pg-tokens-head">
            <h2 className="pg-heading" id="pg-tokens">
              {t.tokens}
            </h2>
            {changed > 0 ? <span className="pg-changed">{t.changed.replace('{count}', String(changed))}</span> : null}
          </div>
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
        </section>

        <div className="pg-actions">
          <Button.Root variant="secondary" onClick={() => setEdits(NO_EDITS)}>
            {t.reset}
          </Button.Root>
          <Button.Root onClick={() => void exportOverrides()}>{t.export}</Button.Root>
        </div>
        <p className="pg-hint">{status || t.exportHint}</p>
      </aside>
      {/* Density sits inside the theme, so density tokens resolve against the stage's raw overrides. */}
      <ThemeProvider className="pg-stage-theme" appearance={appearance} overrides={overrides}>
        <DensityProvider ref={stageRef} density={density} className="pg-stage" role="region" aria-label={t.stage}>
          <Preview />
        </DensityProvider>
      </ThemeProvider>
    </div>
  );
}
