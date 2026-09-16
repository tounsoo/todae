'use client';

import { DensityProvider, ThemeProvider } from '@tounsoo/todae';
import type { ReactNode } from 'react';

export function Providers({ children }: { children: ReactNode }) {
  return (
    <ThemeProvider appearance="system" className="shell">
      <DensityProvider density="comfortable">{children}</DensityProvider>
    </ThemeProvider>
  );
}
