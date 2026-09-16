import type { ReactNode } from 'react';

export function Example({ children }: { children: ReactNode }) {
  return (
    <div className="example" role="group" aria-label="Example">
      {children}
    </div>
  );
}
