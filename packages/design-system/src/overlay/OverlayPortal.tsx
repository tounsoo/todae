import { useLayoutEffect, useState, useSyncExternalStore, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { useDensity } from '../providers/DensityProvider';
import { useAppearance, useThemeVars } from '../providers/ThemeProvider';
import { useInertOutside } from './useInertOutside';

function subscribe(): () => void {
  return () => undefined;
}

export function OverlayPortal({
  children,
  inertOutside = false,
}: {
  children: ReactNode;
  inertOutside?: boolean;
}) {
  const mounted = useSyncExternalStore(subscribe, () => true, () => false);
  const appearance = useAppearance();
  const density = useDensity();
  const vars = useThemeVars();
  const [node, setNode] = useState<HTMLDivElement | null>(null);

  useLayoutEffect(() => {
    if (!mounted) return;
    const el = document.createElement('div');
    el.setAttribute('data-todae-portal', '');
    document.body.appendChild(el);
    setNode(el);
    return () => {
      el.remove();
      setNode(null);
    };
  }, [mounted]);

  useLayoutEffect(() => {
    if (!node) return;
    node.dataset.appearance = appearance;
    node.dataset.density = density;
    node.style.cssText = '';
    for (const [name, value] of Object.entries(vars)) node.style.setProperty(name, value);
  }, [appearance, density, node, vars]);

  useInertOutside(node, Boolean(inertOutside && node));
  if (!mounted || !node) return null;
  return createPortal(children, node);
}
