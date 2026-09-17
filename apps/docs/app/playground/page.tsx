'use client';

import {
  Button,
  COMPONENT_OVERRIDE_KEYS,
  DensityProvider,
  RAW_OVERRIDE_KEYS,
  SEMANTIC_OVERRIDE_KEYS,
  Stack,
  Text,
  ThemeProvider,
  cssVarName,
  parseThemeValue,
  themeOverrideType,
  themeValueCss,
  type ThemeOverride,
  type ThemeOverrideKey,
} from '@tounsoo/todae';
import { useLayoutEffect, useRef, useState } from 'react';

const TABS = {
  raw: RAW_OVERRIDE_KEYS,
  semantic: SEMANTIC_OVERRIDE_KEYS,
  component: COMPONENT_OVERRIDE_KEYS,
} as const;

type TokenTab = keyof typeof TABS;
type AppearanceChoice = 'system' | 'light' | 'dark';
type DensityChoice = 'compact' | 'comfortable' | 'spacious';

function toHex(value: string): string {
  if (/^#[0-9a-fA-F]{6}$/.test(value)) return value.toLowerCase();
  if (typeof document === 'undefined') return '#000000';
  const ctx = document.createElement('canvas').getContext('2d');
  if (!ctx) return '#000000';
  ctx.fillStyle = '#000000';
  ctx.fillStyle = value;
  const fill = String(ctx.fillStyle);
  if (/^#[0-9a-fA-F]{6}$/.test(fill)) return fill;
  const rgb = fill.match(/^rgba?\((\d+),\s*(\d+),\s*(\d+)/);
  if (!rgb) return '#000000';
  return `#${[rgb[1], rgb[2], rgb[3]]
    .map((n) => Number(n).toString(16).padStart(2, '0'))
    .join('')}`;
}

function TokenField({
  path,
  value,
  onChange,
}: {
  path: ThemeOverrideKey;
  value: string;
  onChange: (next: string) => void;
}) {
  const id = path.replaceAll('.', '-');
  const color = themeOverrideType(path) === 'color';
  return (
    <div className="token-row">
      <label htmlFor={`${id}-text`}>
        <code>{path}</code>
      </label>
      <div className="token-row-inputs">
        {color ? (
          <input
            id={`${id}-color`}
            type="color"
            aria-label={`${path} color`}
            value={toHex(value || '#000000')}
            onChange={(event) => onChange(event.target.value)}
          />
        ) : null}
        <input
          id={`${id}-text`}
          type="text"
          spellCheck={false}
          value={value}
          onChange={(event) => onChange(event.target.value)}
        />
      </div>
    </div>
  );
}

export default function PlaygroundPage() {
  const stageRef = useRef<HTMLDivElement>(null);
  const [appearance, setAppearance] = useState<AppearanceChoice>('system');
  const [density, setDensity] = useState<DensityChoice>('comfortable');
  const [tab, setTab] = useState<TokenTab>('semantic');
  const [overrides, setOverrides] = useState<ThemeOverride>({});
  const [computed, setComputed] = useState<Partial<Record<ThemeOverrideKey, string>>>({});
  const [copyStatus, setCopyStatus] = useState('');
  const paths = TABS[tab];

  useLayoutEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    const cs = getComputedStyle(el);
    const next: Partial<Record<ThemeOverrideKey, string>> = {};
    for (const path of paths) {
      next[path] = cs.getPropertyValue(cssVarName(path)).trim();
    }
    setComputed((prev) => ({ ...prev, ...next }));
  }, [appearance, density, overrides, paths]);

  function valueFor(path: ThemeOverrideKey): string {
    const typed = overrides[path];
    if (typed !== undefined) return themeValueCss(path, typed);
    return computed[path] ?? '';
  }

  function setToken(path: ThemeOverrideKey, raw: string) {
    const parsed = parseThemeValue(path, raw);
    if (parsed === null) return;
    setOverrides((prev) => ({ ...prev, [path]: parsed }));
  }

  async function exportOverrides() {
    try {
      await navigator.clipboard.writeText(`${JSON.stringify(overrides, null, 2)}\n`);
      setCopyStatus('Copied theme override JSON.');
    } catch {
      setCopyStatus('Could not copy. Clipboard permission was denied.');
    }
  }

  return (
    <div className="playground">
      <aside className="playground-rail" aria-label="Theme controls">
        <h1>Playground</h1>
        <fieldset>
          <legend>Appearance</legend>
          <div className="playground-options">
            {(['system', 'light', 'dark'] as const).map((value) => (
              <label key={value}>
                <input
                  type="radio"
                  name="appearance"
                  value={value}
                  checked={appearance === value}
                  onChange={() => setAppearance(value)}
                />
                {value}
              </label>
            ))}
          </div>
        </fieldset>
        <fieldset>
          <legend>Density</legend>
          <div className="playground-options">
            {(['compact', 'comfortable', 'spacious'] as const).map((value) => (
              <label key={value}>
                <input
                  type="radio"
                  name="density"
                  value={value}
                  checked={density === value}
                  onChange={() => setDensity(value)}
                />
                {value}
              </label>
            ))}
          </div>
        </fieldset>
        <div
          className="playground-tabs"
          role="tablist"
          aria-label="Token layer"
          onKeyDown={(event) => {
            if (event.key !== 'ArrowRight' && event.key !== 'ArrowLeft') return;
            const names = Object.keys(TABS) as TokenTab[];
            const index = names.indexOf(tab);
            const next = names[(index + (event.key === 'ArrowRight' ? 1 : names.length - 1)) % names.length];
            if (next) setTab(next);
          }}
        >
          {(Object.keys(TABS) as TokenTab[]).map((name) => (
            <button
              key={name}
              type="button"
              role="tab"
              id={`token-tab-${name}`}
              aria-selected={tab === name}
              aria-controls={`token-panel-${name}`}
              tabIndex={tab === name ? 0 : -1}
              onClick={() => setTab(name)}
            >
              {name}
            </button>
          ))}
        </div>
        <section
          className="playground-tokens"
          role="tabpanel"
          id={`token-panel-${tab}`}
          aria-labelledby={`token-tab-${tab}`}
        >
          {paths.map((path) => (
            <TokenField key={path} path={path} value={valueFor(path)} onChange={(value) => setToken(path, value)} />
          ))}
        </section>
        <div className="playground-actions">
          <Button type="button" variant="secondary" onClick={() => setOverrides({})}>
            Reset all
          </Button>
          <Button type="button" onClick={() => void exportOverrides()}>
            Export
          </Button>
        </div>
        <p className="playground-status" aria-live="polite">
          {copyStatus}
        </p>
      </aside>
      <DensityProvider density={density} className="playground-density">
        <ThemeProvider
          ref={stageRef}
          className="playground-stage"
          appearance={appearance}
          overrides={overrides}
          aria-label="Live demos"
        >
          <Stack>
            <Text as="strong" weight="medium">
              Buttons
            </Text>
            <Stack direction="row">
              <Button>Primary</Button>
              <Button variant="secondary">Secondary</Button>
              <Button variant="ghost">Ghost</Button>
              <Button disabled>Disabled</Button>
            </Stack>
            <Text tone="muted" size="s">
              Hover, press, and tab to a button to see hover / active / focus.
            </Text>
            <Text as="strong" weight="medium">
              Text
            </Text>
            <Text>Default tone</Text>
            <Text tone="muted">Muted tone</Text>
            <Text tone="accent">Accent tone</Text>
          </Stack>
        </ThemeProvider>
      </DensityProvider>
    </div>
  );
}
