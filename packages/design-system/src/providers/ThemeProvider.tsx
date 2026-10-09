'use client';

import { createContext, useContext, useMemo, useSyncExternalStore, type ComponentProps, type CSSProperties } from 'react';
import {
  RAW_OVERRIDE_KEYS,
  SEMANTIC_OVERRIDE_KEYS,
  cssVarName,
  themeOverrideStyle,
  type ThemeOverride,
  type ThemeOverrideTypes,
  type ThemeOverrideValue,
} from './themeOverride';

export type Appearance = 'system' | 'light' | 'dark';
export type ResolvedAppearance = 'light' | 'dark';

export type ThemeProviderProps<Extra extends string = never> = {
  appearance?: Appearance;
  overrides?: ThemeOverride & { [K in NoInfer<Extra>]?: ThemeOverrideValue };
  /** Types for extra override keys, such as a company's generated `THEME_OVERRIDE_TYPES`. */
  overrideTypes?: ThemeOverrideTypes<Extra>;
} & ComponentProps<'div'>;

const QUERY = '(prefers-color-scheme: dark)';
const AppearanceContext = createContext<ResolvedAppearance>('light');
const EMPTY_VARS: Readonly<Record<string, string>> = {};
/**
 * The contract-token custom properties set by the ThemeProviders above. Every
 * provider element re-declares the contract tokens, which would reset an
 * ancestor's overrides of them, so each provider sets these again on its own
 * element. Raw and semantic overrides are left out: they are not re-declared
 * there, and a density or appearance must still change them.
 */
export const ThemeOverrideVarsContext = createContext<Readonly<Record<string, string>>>(EMPTY_VARS);

const SCOPED_VARS = new Set<string>([...RAW_OVERRIDE_KEYS, ...SEMANTIC_OVERRIDE_KEYS].map(cssVarName));

function contractVars(vars: Readonly<Record<string, string>>): Readonly<Record<string, string>> {
  const entries = Object.entries(vars).filter(([name]) => !SCOPED_VARS.has(name));
  return entries.length === 0 ? EMPTY_VARS : Object.fromEntries(entries);
}

function subscribe(onStoreChange: () => void) {
  const mq = window.matchMedia(QUERY);
  mq.addEventListener('change', onStoreChange);
  return () => mq.removeEventListener('change', onStoreChange);
}

function getSnapshot(): ResolvedAppearance {
  return window.matchMedia(QUERY).matches ? 'dark' : 'light';
}

function getServerSnapshot(): ResolvedAppearance {
  return 'light';
}

export function ThemeProvider<Extra extends string = never>({
  appearance = 'system',
  overrides,
  overrideTypes,
  style,
  ...props
}: ThemeProviderProps<Extra>) {
  const system = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const resolved: ResolvedAppearance = appearance === 'system' ? system : appearance;
  const vars = useMemo(() => themeOverrideStyle(overrides, overrideTypes), [overrides, overrideTypes]);
  const inherited = useContext(ThemeOverrideVarsContext);
  const contract = useMemo(() => {
    const own = contractVars(vars);
    if (own === EMPTY_VARS) return inherited;
    return inherited === EMPTY_VARS ? own : { ...inherited, ...own };
  }, [inherited, vars]);
  return (
    <AppearanceContext.Provider value={resolved}>
      <ThemeOverrideVarsContext.Provider value={contract}>
        <div {...props} style={{ ...inherited, ...style, ...vars } as CSSProperties} data-appearance={resolved} />
      </ThemeOverrideVarsContext.Provider>
    </AppearanceContext.Provider>
  );
}

export function useAppearance(): ResolvedAppearance {
  return useContext(AppearanceContext);
}
