import { useEffect, useState, useSyncExternalStore } from 'react';

export const SHEET_NARROW_WIDTH = 640;

export type SheetPresentation = 'popover' | 'sheet';

export type UseSheetPresentationOptions = {
  narrowWidth?: number;
  coarseQuery?: string;
  forced?: SheetPresentation | 'auto';
};

export type SheetPresentationResult = {
  presentation: SheetPresentation;
  isSheet: boolean;
  measured: boolean;
};

export function resolveSheetPresentation({
  coarse,
  narrow,
}: {
  coarse: boolean;
  narrow: boolean;
}): SheetPresentation {
  return coarse || narrow ? 'sheet' : 'popover';
}

function narrowQuery(narrowWidth: number): string {
  return `(max-width: ${narrowWidth - 1}px)`;
}

function subscribeMedia(coarseQuery: string, narrow: string, onStoreChange: () => void): () => void {
  const coarse = window.matchMedia(coarseQuery);
  const width = window.matchMedia(narrow);
  coarse.addEventListener('change', onStoreChange);
  width.addEventListener('change', onStoreChange);
  return () => {
    coarse.removeEventListener('change', onStoreChange);
    width.removeEventListener('change', onStoreChange);
  };
}

export function useSheetPresentation(
  options: UseSheetPresentationOptions = {},
): SheetPresentationResult {
  const { narrowWidth = SHEET_NARROW_WIDTH, coarseQuery = '(pointer: coarse)', forced = 'auto' } =
    options;
  const mediaNarrow = narrowQuery(narrowWidth);
  const [measured, setMeasured] = useState(false);

  useEffect(() => {
    setMeasured(true);
  }, []);

  const snapshot = useSyncExternalStore(
    (onStoreChange) => subscribeMedia(coarseQuery, mediaNarrow, onStoreChange),
    () =>
      JSON.stringify({
        coarse: window.matchMedia(coarseQuery).matches,
        narrow: window.matchMedia(mediaNarrow).matches,
      }),
    () => JSON.stringify({ coarse: false, narrow: false }),
  );

  const media = JSON.parse(snapshot) as { coarse: boolean; narrow: boolean };
  const auto = resolveSheetPresentation(media);
  const presentation = forced === 'auto' ? (measured ? auto : 'popover') : forced;
  return {
    presentation,
    isSheet: presentation === 'sheet',
    measured,
  };
}
