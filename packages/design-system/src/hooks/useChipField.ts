import { useCallback, useRef, useState } from 'react';

export type UseChipFieldOptions = {
  initialChips?: readonly string[];
  initialInputValue?: string;
  dedupe?: boolean;
  transform?: (raw: string) => string | null;
};

export function useChipField(options: UseChipFieldOptions = {}) {
  const { initialChips = [], initialInputValue = '', dedupe = true, transform } = options;
  const [chips, setChips] = useState<readonly string[]>(initialChips);
  const initial = useRef({ chips: initialChips, inputValue: initialInputValue });
  initial.current = { chips: initialChips, inputValue: initialInputValue };
  const [inputValue, setInputValue] = useState(initialInputValue);

  const onInputValueChange = setInputValue;

  const onCommit = useCallback(
    (value: string) => {
      const next = transform ? transform(value) : value.trim() || null;
      if (next == null) return;
      setChips((prev) => (dedupe && prev.includes(next) ? prev : [...prev, next]));
      setInputValue('');
    },
    [dedupe, transform],
  );

  const onChipRemove = useCallback((index: number) => {
    setChips((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const reset = useCallback(() => {
    setChips(initial.current.chips);
    setInputValue(initial.current.inputValue);
  }, []);

  return {
    chips,
    inputValue,
    onInputValueChange,
    onCommit,
    onChipRemove,
    setChips,
    setInputValue,
    reset,
  };
}
