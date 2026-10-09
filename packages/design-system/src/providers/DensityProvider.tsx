'use client';

import { createContext, useContext, type ComponentProps, type CSSProperties } from 'react';
import { ThemeOverrideVarsContext } from './ThemeProvider';

/**
 * Densities, one per `density` context in the token resolver. A company that
 * adds a context declares it here too:
 * `declare module '@tounsoo/todae' { interface Densities { roomy: true } }`.
 */
export interface Densities {
  compact: true;
  comfortable: true;
  spacious: true;
}

export type Density = keyof Densities;

export type DensityProviderProps = {
  density?: Density;
} & ComponentProps<'div'>;

const DensityContext = createContext<Density>('comfortable');

export function DensityProvider({ density = 'comfortable', style, ...props }: DensityProviderProps) {
  const overrides = useContext(ThemeOverrideVarsContext);
  return (
    <DensityContext.Provider value={density}>
      <div {...props} style={{ ...overrides, ...style } as CSSProperties} data-density={density} />
    </DensityContext.Provider>
  );
}

export function useDensity(): Density {
  return useContext(DensityContext);
}
