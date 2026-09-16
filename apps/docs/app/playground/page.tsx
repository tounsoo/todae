'use client';

import { Button, DensityProvider, Stack, Text, ThemeProvider } from '@tounsoo/todae';
import { useLayoutEffect, useRef, useState, type CSSProperties } from 'react';

const PRIMARY = [
  'color.accent.default',
  'color.fg.default',
  'color.bg.canvas',
  'color.bg.surface',
  'color.border.default',
] as const;

const MORE = ['color.accent.hover', 'color.accent.active'] as const;
const PATHS = [...PRIMARY, ...MORE];

type AppearanceChoice = 'system' | 'light' | 'dark';
type DensityChoice = 'compact' | 'comfortable' | 'spacious';

function cssVar(path: string): string {
  return `--todae-${path.replaceAll('.', '-')}`;
}

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
  path: string;
  value: string;
  onChange: (next: string) => void;
}) {
  const id = path.replaceAll('.', '-');
  return (
    <div className="token-row">
      <label htmlFor={`${id}-text`}>
        <code>{path}</code>
      </label>
      <div className="token-row-inputs">
        <input
          id={`${id}-color`}
          type="color"
          aria-label={`${path} color`}
          value={toHex(value || '#000000')}
          onChange={(event) => onChange(event.target.value)}
        />
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
  const [overrides, setOverrides] = useState<Record<string, string>>({});
  const [computed, setComputed] = useState<Record<string, string>>({});
  const [copyStatus, setCopyStatus] = useState('');

  useLayoutEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    const cs = getComputedStyle(el);
    const next: Record<string, string> = {};
    for (const path of PATHS) {
      const key = cssVar(path);
      next[key] = cs.getPropertyValue(key).trim();
    }
    setComputed(next);
  }, [appearance, density, overrides]);

  function valueFor(path: (typeof PATHS)[number]): string {
    const key = cssVar(path);
    return overrides[key] ?? computed[key] ?? '';
  }

  function setToken(path: string, value: string) {
    setOverrides((prev) => ({ ...prev, [cssVar(path)]: value }));
  }

  async function copyCss() {
    const body = Object.entries(overrides)
      .map(([name, value]) => `  ${name}: ${value};`)
      .join('\n');
    const css = `[data-appearance],\n[data-density] {\n${body}\n}\n`;
    try {
      await navigator.clipboard.writeText(css);
      setCopyStatus('Copied CSS overrides.');
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
        <section className="playground-tokens" aria-labelledby="playground-tokens-label">
          <h2 id="playground-tokens-label">Tokens</h2>
          {PRIMARY.map((path) => (
            <TokenField key={path} path={path} value={valueFor(path)} onChange={(value) => setToken(path, value)} />
          ))}
          <details>
            <summary>More</summary>
            {MORE.map((path) => (
              <TokenField key={path} path={path} value={valueFor(path)} onChange={(value) => setToken(path, value)} />
            ))}
          </details>
        </section>
        <div className="playground-actions">
          <Button type="button" variant="secondary" onClick={() => setOverrides({})}>
            Reset all
          </Button>
          <Button type="button" onClick={() => void copyCss()}>
            Copy CSS overrides
          </Button>
        </div>
        <p className="playground-status" aria-live="polite">
          {copyStatus}
        </p>
      </aside>
      <section className="playground-stage" aria-label="Live demos">
        <ThemeProvider
          ref={stageRef}
          appearance={appearance}
          style={overrides as CSSProperties}
        >
          <DensityProvider density={density}>
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
          </DensityProvider>
        </ThemeProvider>
      </section>
    </div>
  );
}
