import { useCallback, useRef, useState, type Dispatch, type SetStateAction } from 'react';
import type { FieldChipInputProps } from '../components/Field.js';

export type UseChipFieldOptions = {
  initialChips?: readonly string[];
  initialInputValue?: string;
  dedupe?: boolean;
  transform?: (raw: string) => string | null;
};

export type UseChipFieldResult = {
  chips: readonly string[];
  inputValue: string;
  setChips: Dispatch<SetStateAction<readonly string[]>>;
  setInputValue: Dispatch<SetStateAction<string>>;
  /** Restores the latest initial chips and input value. */
  reset: () => void;
  /** Props to spread on `Field.ChipInput`. */
  getChipInputProps: () => Pick<
    FieldChipInputProps,
    'chips' | 'inputValue' | 'onInputValueChange' | 'onCommit' | 'onChipRemove'
  >;
};

export function useChipField(options: UseChipFieldOptions = {}): UseChipFieldResult {
  const { initialChips = [], initialInputValue = '', dedupe = true, transform } = options;
  const [chips, setChips] = useState<readonly string[]>(initialChips);
  const initial = useRef({ chips: initialChips, inputValue: initialInputValue });
  initial.current = { chips: initialChips, inputValue: initialInputValue };
  const [inputValue, setInputValue] = useState(initialInputValue);

  const onCommit = useCallback(
    (value: string) => {
      const next = transform ? transform(value) : value.trim() || null;
      if (next == null) return false;
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

  const getChipInputProps = useCallback(
    () => ({ chips, inputValue, onInputValueChange: setInputValue, onCommit, onChipRemove }),
    [chips, inputValue, onCommit, onChipRemove],
  );

  return {
    chips,
    inputValue,
    setChips,
    setInputValue,
    reset,
    getChipInputProps,
  };
}
