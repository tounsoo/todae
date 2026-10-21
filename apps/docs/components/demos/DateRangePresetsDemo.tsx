'use client';

import { Field, Label, Stack, ToggleGroup, type DateRange } from '@tounsoo/todae';
import { useId, useState } from 'react';
import { useLocale } from '../../lib/i18n/useLocale';

const PRESETS: { id: string; label: string; range: (today: Temporal.PlainDate) => DateRange }[] = [
  { id: 'last-7', label: 'Last 7 days', range: (today) => ({ start: today.subtract({ days: 6 }), end: today }) },
  { id: 'last-30', label: 'Last 30 days', range: (today) => ({ start: today.subtract({ days: 29 }), end: today }) },
  { id: 'this-month', label: 'This month', range: (today) => ({ start: today.with({ day: 1 }), end: today }) },
];

// The preset whose range is the value today, or null for a custom range.
function presetOf(range: DateRange | null) {
  if (!range) return null;
  const today = Temporal.Now.plainDateISO();
  const preset = PRESETS.find((each) => {
    const { start, end } = each.range(today);
    return start.equals(range.start) && end.equals(range.end);
  });
  return preset?.id ?? null;
}

export function DateRangePresets() {
  const id = useId();
  const locale = useLocale();
  const [range, setRange] = useState<DateRange | null>(null);
  return (
    <Stack.Root gap="condensed">
      <Field.Group>
        <Label.Root htmlFor={id}>Report dates</Label.Root>
        <Field.Root id={id}>
          <Field.DateRangePicker value={range} onValueChange={setRange} locale={locale} placeholder="Pick dates" />
        </Field.Root>
      </Field.Group>
      <ToggleGroup.Root
        aria-label="Preset ranges"
        value={presetOf(range)}
        onValueChange={(next) => {
          // Pressing the pressed preset again gives null, which keeps its range.
          const preset = PRESETS.find((each) => each.id === next);
          if (preset) setRange(preset.range(Temporal.Now.plainDateISO()));
        }}
      >
        {PRESETS.map((preset) => (
          <ToggleGroup.Item key={preset.id} value={preset.id}>
            {preset.label}
          </ToggleGroup.Item>
        ))}
      </ToggleGroup.Root>
    </Stack.Root>
  );
}
