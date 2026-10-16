'use client';

import { createContext, useContext, useEffect, useRef, useSyncExternalStore, type ComponentProps, type CSSProperties } from 'react';
import { useComposedRefs } from '../components/props.js';
import { failureKey, overrideContrastFailures, overrideContrastMessage } from './overrideContrast.js';
import {
  themeOverrideStyle,
  type ThemeOverride,
  type ThemeOverrideTypes,
  type ThemeOverrideValue,
} from './themeOverride.js';

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
const AppearanceContext = /* @__PURE__ */ createContext<ResolvedAppearance>('light');
const ThemeVarsContext = /* @__PURE__ */ createContext<Record<string, string>>({});

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

/** The custom properties the overrides set, with their values and the caller's own value for any they replace. */
function contrastInputs(vars: Record<string, string>, inputs: Record<string, string>, style: CSSProperties | undefined) {
  const names = [...Object.keys(vars), ...Object.keys(inputs)];
  const own = (style ?? {}) as Record<string, unknown>;
  const underneath: Record<string, string> = {};
  for (const name of names) {
    const value = own[name];
    // React sets no property for null, a boolean or an empty string.
    if (value !== undefined && value !== null && typeof value !== 'boolean' && value !== '') underneath[name] = String(value);
  }
  // `values` is only in the key so a changed value re-runs the check.
  return { names, values: vars, underneath };
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
  // In development, check Todae's contrast pairs whenever the overrides change. The
  // key carries what the effect needs as one string, so it re-runs only on a change.
  const contrastKey = DEV && Object.keys(vars).length > 0 ? JSON.stringify(contrastInputs(vars, inputs, style)) : '';
  const warned = useRef<string | null>(null);
  useEffect(() => {
    if (!DEV || !element.current) return;
    if (contrastKey === '') {
      warned.current = null;
      return;
    }
    const { names, underneath } = JSON.parse(contrastKey) as ReturnType<typeof contrastInputs>;
    // During hydration `resolved` is still the server's guess, so read the appearance as it renders now.
    const now = appearance === 'system' ? getSnapshot() : appearance;
    const failures = overrideContrastFailures(element.current, names, underneath);
    const key = failures.length === 0 ? null : `${now}:${failureKey(failures)}`;
    // A ref survives StrictMode's second mount, so the same failing pairs warn once.
    if (key && key !== warned.current) console.warn(overrideContrastMessage(failures, now));
    warned.current = key;
  }, [contrastKey, appearance, resolved]);
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
