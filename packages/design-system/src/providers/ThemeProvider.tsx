'use client';

import { createContext, useContext, useEffect, useRef, useSyncExternalStore, type ComponentProps, type CSSProperties } from 'react';
import { useComposedRefs } from '../components/props';
import { overrideContrastFailures, overrideContrastMessage } from './overrideContrast';
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
const DEV = process.env.NODE_ENV !== 'production';
const AppearanceContext = createContext<ResolvedAppearance>('light');
const ThemeVarsContext = createContext<Record<string, string>>({});

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
  ref,
  ...props
}: ThemeProviderProps<Extra>) {
  const system = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const resolved: ResolvedAppearance = appearance === 'system' ? system : appearance;
  const vars = themeOverrideStyle(overrides, overrideTypes);
  // Each override also sets its private --_todae-* input. Component tokens,
  // re-declared on every provider, read it first, so their overrides survive
  // nested providers; tokens that vary by appearance or density never read it.
  const inputs = Object.fromEntries(Object.entries(vars).map(([name, value]) => [`--_${name.slice(2)}`, value]));
  const element = useRef<HTMLDivElement>(null);
  const composedRef = useComposedRefs(element, ref);
  // In development, measure Todae's contrast pairs whenever the overrides change.
  const overridden = DEV ? Object.entries(vars).join(';') : '';
  const warned = useRef<string | null>(null);
  useEffect(() => {
    if (!DEV || overridden === '' || !element.current) return;
    // During hydration `resolved` is still the server's guess, so read the appearance as it renders now.
    const now = appearance === 'system' ? getSnapshot() : appearance;
    const message = overrideContrastMessage(overrideContrastFailures(element.current, now), now);
    // A ref survives StrictMode's second mount, so the same result warns once.
    if (message && message !== warned.current) console.warn(message);
    warned.current = message;
  }, [overridden, appearance, resolved]);
  return (
    <AppearanceContext.Provider value={resolved}>
      <ThemeVarsContext.Provider value={vars}>
        <div
          {...props}
          ref={composedRef}
          style={{ ...style, ...vars, ...inputs } as CSSProperties}
          // "system" resolves in CSS through prefers-color-scheme, so a
          // server-rendered page is dark from the first paint.
          data-appearance={appearance}
        />
      </ThemeVarsContext.Provider>
    </AppearanceContext.Provider>
  );
}

export function useAppearance(): ResolvedAppearance {
  return useContext(AppearanceContext);
}

export function useThemeVars(): Record<string, string> {
  return useContext(ThemeVarsContext);
}
