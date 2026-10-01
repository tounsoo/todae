'use client';

import {
  Children,
  isValidElement,
  useLayoutEffect,
  useRef,
  useState,
  type ComponentProps,
  type ReactNode,
} from 'react';

function fenceLanguage(className: string | undefined, children: ReactNode): string | undefined {
  const own = /(?:^|\s)language-([\w-]+)/.exec(className ?? '');
  if (own?.[1]) return own[1];
  for (const child of Children.toArray(children)) {
    if (!isValidElement<{ className?: string }>(child)) continue;
    const match = /(?:^|\s)language-([\w-]+)/.exec(child.props.className ?? '');
    if (match?.[1]) return match[1];
  }
  return undefined;
}

export function DocsPre({ className, children, ...props }: ComponentProps<'pre'>) {
  const ref = useRef<HTMLPreElement>(null);
  const [overflows, setOverflows] = useState(false);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => setOverflows(el.scrollWidth > el.clientWidth);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, [children]);
  const language = fenceLanguage(className, children);
  const label = language ? `Code example, ${language}` : 'Code example';
  return (
    <div className="docs-pre">
      <pre
        {...props}
        ref={ref}
        className={className}
        tabIndex={overflows ? 0 : undefined}
        role={overflows ? 'region' : undefined}
        aria-label={overflows ? label : undefined}
      >
        {children}
      </pre>
    </div>
  );
}
