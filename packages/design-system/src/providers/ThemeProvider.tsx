import { createContext, useContext, useSyncExternalStore, type ComponentProps } from 'react';

export type Appearance = 'system' | 'light' | 'dark';
export type ResolvedAppearance = 'light' | 'dark';

export type ThemeProviderProps = {
  appearance?: Appearance;
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

export function ThemeProvider({ appearance = 'system', ...props }: ThemeProviderProps) {
  const system = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const resolved: ResolvedAppearance = appearance === 'system' ? system : appearance;
  return (
    <AppearanceContext.Provider value={resolved}>
      <div {...props} data-appearance={resolved} />
    </AppearanceContext.Provider>
  );
}

export function useAppearance(): ResolvedAppearance {
  return useContext(AppearanceContext);
}
