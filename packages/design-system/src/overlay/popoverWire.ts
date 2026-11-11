import type { CSSProperties, MouseEvent, PointerEvent } from 'react';

export type PopoverWire = {
  id: string;
  open: boolean;
  ref: (node: HTMLElement | null) => void;
  style: CSSProperties;
  onPointerDown: (event: PointerEvent<HTMLElement>) => void;
  onClick: (event: MouseEvent<HTMLElement>) => void;
};
