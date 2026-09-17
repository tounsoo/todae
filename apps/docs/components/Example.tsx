import type { ReactNode } from 'react';

export function Example({ children, block }: { children: ReactNode; block?: boolean }) {
  return (
    <div className={block ? 'example example-block' : 'example'} role="group" aria-label="Example">
      {children}
    </div>
  );
}
