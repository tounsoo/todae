'use client';

import { createContext, useContext, type ComponentProps } from 'react';

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
  /** Defaults to the enclosing DensityProvider's density, or `comfortable` with none. */
  density?: Density;
} & ComponentProps<'div'>;

// null with no provider above, so the outermost one defaults to comfortable.
const DensityContext = /* @__PURE__ */ createContext<Density | null>(null);

export function DensityProvider({ density: ownDensity, ...props }: DensityProviderProps) {
  const enclosing = useContext(DensityContext);
  const density = ownDensity ?? enclosing ?? 'comfortable';
  return (
    <DensityContext.Provider value={density}>
      <div {...props} data-density={density} />
    </DensityContext.Provider>
  );
}

export function useDensity(): Density {
  return useContext(DensityContext) ?? 'comfortable';
}
