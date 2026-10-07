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
import type { Locale } from '../lib/i18n/config';

const TABS = {
  raw: RAW_OVERRIDE_KEYS,
  semantic: SEMANTIC_OVERRIDE_KEYS,
  component: COMPONENT_OVERRIDE_KEYS,
} as const;

type TokenTab = keyof typeof TABS;
type AppearanceChoice = 'system' | 'light' | 'dark';
type DensityChoice = 'compact' | 'comfortable' | 'spacious';

// Option values, tab names and variant names are Todae's own names and stay in English.
const STRINGS = {
  en: {
    rail: 'Theme controls',
    title: 'Playground',
    tokenLayer: 'Token layer',
    color: 'color',
    reset: 'Reset all',
    export: 'Export',
    copied: 'Copied theme override JSON.',
    copyFailed: 'Could not copy. Clipboard permission was denied.',
    stage: 'Live demos',
    buttons: 'Buttons',
    buttonHint: 'Hover, press, and tab to a button to see hover / active / focus.',
    defaultTone: 'Default tone',
    mutedTone: 'Muted tone',
    accentTone: 'Accent tone',
  },
  ko: {
    rail: '테마 컨트롤',
    title: '플레이그라운드',
    tokenLayer: '토큰 레이어',
    color: '색상',
    reset: '모두 초기화',
    export: '내보내기',
    copied: '테마 오버라이드 JSON을 복사했습니다.',
    copyFailed: '복사하지 못했습니다. 클립보드 권한이 거부되었습니다.',
    stage: '라이브 데모',
    buttons: '버튼',
    buttonHint: '버튼에 마우스를 올리거나, 누르거나, Tab으로 이동해 hover / active / focus 상태를 확인하세요.',
    defaultTone: '기본 톤',
    mutedTone: 'Muted 톤',
    accentTone: 'Accent 톤',
  },
} satisfies Record<Locale, Record<string, string>>;

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
  colorLabel,
  onChange,
}: {
  path: ThemeOverrideKey;
  value: string;
  colorLabel: string;
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
            aria-label={`${path} ${colorLabel}`}
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

/** The theme playground. Each locale's /playground page renders it. */
export function Playground({ locale }: { locale: Locale }) {
  const t = STRINGS[locale];
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
      setCopyStatus(t.copied);
    } catch {
      setCopyStatus(t.copyFailed);
    }
  }

  return (
    <div className="playground">
      <aside className="playground-rail" aria-label={t.rail}>
        <h1>{t.title}</h1>
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
          aria-label={t.tokenLayer}
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
            <TokenField key={path} path={path} value={valueFor(path)} colorLabel={t.color} onChange={(value) => setToken(path, value)} />
          ))}
        </section>
        <div className="playground-actions">
          <Button.Root type="button" variant="secondary" onClick={() => setOverrides({})}>
            {t.reset}
          </Button.Root>
          <Button.Root type="button" onClick={() => void exportOverrides()}>
            {t.export}
          </Button.Root>
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
          aria-label={t.stage}
        >
          <Stack>
            <Text as="strong" weight="medium">
              {t.buttons}
            </Text>
            <Stack direction="row">
              <Button.Root>Primary</Button.Root>
              <Button.Root variant="secondary">Secondary</Button.Root>
              <Button.Root variant="ghost">Ghost</Button.Root>
              <Button.Root disabled>Disabled</Button.Root>
            </Stack>
            <Text tone="muted" size="s">
              {t.buttonHint}
            </Text>
            <Text as="strong" weight="medium">
              Text
            </Text>
            <Text>{t.defaultTone}</Text>
            <Text tone="muted">{t.mutedTone}</Text>
            <Text tone="accent">{t.accentTone}</Text>
          </Stack>
        </ThemeProvider>
      </DensityProvider>
    </div>
  );
}
