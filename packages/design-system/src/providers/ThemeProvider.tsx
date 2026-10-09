'use client';

import { createContext, useContext, useSyncExternalStore, type ComponentProps, type CSSProperties } from 'react';
import {
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
 * The custom properties the nearest ThemeProvider set from `overrides`. A
 * DensityProvider re-declares contract tokens, which would reset overrides of
 * them set on an ancestor, so it sets these again on its own element.
 */
export const ThemeOverrideVarsContext = createContext<Readonly<Record<string, string>>>(EMPTY_VARS);

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
  const vars = themeOverrideStyle(overrides, overrideTypes);
  return (
    <AppearanceContext.Provider value={resolved}>
      <ThemeOverrideVarsContext.Provider value={vars}>
        <div {...props} style={{ ...style, ...vars } as CSSProperties} data-appearance={resolved} />
      </ThemeOverrideVarsContext.Provider>
    </AppearanceContext.Provider>
  );
}

export function useAppearance(): ResolvedAppearance {
  return useContext(AppearanceContext);
}
