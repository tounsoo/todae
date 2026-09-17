'use client';

import { createContext, useContext, useSyncExternalStore, type ComponentProps, type CSSProperties } from 'react';
import { themeOverrideStyle, type ThemeOverride } from './themeOverride';

export type Appearance = 'system' | 'light' | 'dark';
export type ResolvedAppearance = 'light' | 'dark';

export type ThemeProviderProps = {
  appearance?: Appearance;
  overrides?: ThemeOverride;
} & ComponentProps<'div'>;

const QUERY = '(prefers-color-scheme: dark)';
const AppearanceContext = createContext<ResolvedAppearance>('light');

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

export function ThemeProvider({
  appearance = 'system',
  overrides,
  style,
  ...props
}: ThemeProviderProps) {
  const system = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const resolved: ResolvedAppearance = appearance === 'system' ? system : appearance;
  const vars = themeOverrideStyle(overrides);
  return (
    <AppearanceContext.Provider value={resolved}>
      <div
        {...props}
        style={{ ...style, ...vars } as CSSProperties}
        data-appearance={resolved}
      />
    </AppearanceContext.Provider>
  );
}

export function useAppearance(): ResolvedAppearance {
  return useContext(AppearanceContext);
}
