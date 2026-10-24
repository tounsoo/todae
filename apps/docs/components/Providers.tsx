'use client';

// The site supports browsers without Temporal, which Field's date and time parts need. The shim
// installs only where Temporal is missing.
import 'temporal-polyfill/global';
import { DensityProvider, ThemeProvider, type Appearance } from '@tounsoo/todae';
import { createContext, useContext, useLayoutEffect, useSyncExternalStore, type ReactNode } from 'react';
import { APPEARANCE_KEY as KEY } from './appearanceScript';
const CHANGE = 'todae-docs-appearance-change';

function isAppearance(value: unknown): value is Appearance {
  return value === 'system' || value === 'light' || value === 'dark';
}

function subscribe(onChange: () => void) {
  window.addEventListener('storage', onChange);
  window.addEventListener(CHANGE, onChange);
  return () => {
    window.removeEventListener('storage', onChange);
    window.removeEventListener(CHANGE, onChange);
  };
}

// The pick for this page load when storage refuses it, so the switch still works.
let unstored: Appearance | null = null;

function getSnapshot(): Appearance {
  if (unstored) return unstored;
  try {
    const stored = window.localStorage.getItem(KEY);
    return isAppearance(stored) ? stored : 'system';
  } catch {
    return 'system';
  }
}

const getServerSnapshot = (): Appearance => 'system';

function setAppearance(next: Appearance) {
  try {
    window.localStorage.setItem(KEY, next);
    unstored = null;
  } catch {
    // Blocked storage keeps the pick for this page load only.
    unstored = next;
  }
  window.dispatchEvent(new Event(CHANGE));
}

const AppearanceChoice = createContext<{ appearance: Appearance; setAppearance: (next: Appearance) => void }>({
  appearance: 'system',
  setAppearance,
});

/** The reader's light or dark choice, kept in local storage. */
export function useAppearanceChoice() {
  return useContext(AppearanceChoice);
}

export function Providers({ children }: { children: ReactNode }) {
  const appearance = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  useLayoutEffect(() => {
    document.documentElement.setAttribute('data-appearance', getSnapshot());
  }, [appearance]);
  return (
    <AppearanceChoice.Provider value={{ appearance, setAppearance }}>
      {/* SiteShell's inline script may set data-appearance before hydration. */}
      <ThemeProvider appearance={appearance} className="shell" suppressHydrationWarning>
        <DensityProvider density="comfortable">{children}</DensityProvider>
      </ThemeProvider>
    </AppearanceChoice.Provider>
  );
}
