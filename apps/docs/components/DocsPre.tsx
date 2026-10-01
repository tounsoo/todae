'use client';

import type { ComponentProps } from 'react';
import { useOverflowRegion } from './OverflowRegion';

export function DocsPre({ className, children, ...props }: ComponentProps<'pre'>) {
  const region = useOverflowRegion<HTMLPreElement>('code');
  return (
    <div className="docs-pre">
      <pre
        {...props}
        ref={region.ref}
        className={className}
        data-overflow-kind="code"
        tabIndex={region.focusable ? 0 : undefined}
        role={region.focusable ? 'region' : undefined}
        aria-label={region.focusable ? region.label : undefined}
        onFocus={region.onFocus}
        onBlur={region.onBlur}
      >
        {children}
      </pre>
    </div>
  );
}
