'use client';

import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { DEFAULT_STRINGS, type Strings } from './strings';

export type { Strings } from './strings';

export type StringsProviderProps = {
  /** The strings to change. Each key left out comes from the nearest StringsProvider above, else English. */
  strings: Partial<Strings>;
  children?: ReactNode;
};

const StringsContext = createContext<Strings>(DEFAULT_STRINGS);

/** Sets the text Todae writes by itself, such as default names, for its subtree. Renders no element. */
export function StringsProvider({ strings, children }: StringsProviderProps) {
  const parent = useContext(StringsContext);
  const value = useMemo(() => {
    const merged: Strings = { ...parent };
    for (const key of Object.keys(strings) as (keyof Strings)[]) {
      // A key set to undefined keeps the parent's string.
      if (strings[key] !== undefined) Object.assign(merged, { [key]: strings[key] });
    }
    return merged;
  }, [parent, strings]);
  return <StringsContext.Provider value={value}>{children}</StringsContext.Provider>;
}

/** The strings in effect here: the nearest StringsProvider's, merged over its parents', else English. */
export function useStrings(): Strings {
  return useContext(StringsContext);
}
