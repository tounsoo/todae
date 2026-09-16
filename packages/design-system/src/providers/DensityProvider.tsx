'use client';

import { createContext, useContext, type ComponentProps } from 'react';

export type Density = 'compact' | 'comfortable' | 'spacious';

export type DensityProviderProps = {
  density?: Density;
} & ComponentProps<'div'>;

const DensityContext = createContext<Density>('comfortable');

export function DensityProvider({ density = 'comfortable', ...props }: DensityProviderProps) {
  return (
    <DensityContext.Provider value={density}>
      <div {...props} data-density={density} />
    </DensityContext.Provider>
  );
}

export function useDensity(): Density {
  return useContext(DensityContext);
}
