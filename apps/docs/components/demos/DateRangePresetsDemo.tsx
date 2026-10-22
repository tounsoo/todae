'use client';

import { Field, Label, Stack, ToggleGroup, type DateRange } from '@tounsoo/todae';
import { useId, useState } from 'react';
import { useLocale } from '../../lib/i18n/useLocale';

const PRESETS: { id: string; label: string; range: (today: Temporal.PlainDate) => DateRange }[] = [
  { id: 'last-7', label: 'Last 7 days', range: (today) => ({ start: today.subtract({ days: 6 }), end: today }) },
  { id: 'last-30', label: 'Last 30 days', range: (today) => ({ start: today.subtract({ days: 29 }), end: today }) },
  { id: 'this-month', label: 'This month', range: (today) => ({ start: today.with({ day: 1 }), end: today }) },
];

function isRangeOf(preset: (typeof PRESETS)[number], range: DateRange, today: Temporal.PlainDate) {
  const { start, end } = preset.range(today);
  return start.equals(range.start) && end.equals(range.end);
}

// The preset whose range is the value today, or null for a custom range. Two presets can give the
// same range on some days, such as "This month" and "Last 7 days" on the 7th, so the last one
// pressed wins while the value is still its range.
function presetOf(range: DateRange | null, pressed: string | null) {
  if (!range) return null;
  const today = Temporal.Now.plainDateISO();
  const last = PRESETS.find((each) => each.id === pressed);
  if (last && isRangeOf(last, range, today)) return last.id;
  return PRESETS.find((each) => isRangeOf(each, range, today))?.id ?? null;
}

export function DateRangePresets() {
  const id = useId();
  const locale = useLocale();
  const [range, setRange] = useState<DateRange | null>(null);
  const [pressed, setPressed] = useState<string | null>(null);
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
        value={presetOf(range, pressed)}
        onValueChange={(next) => {
          // Pressing the pressed preset again gives null, which keeps its range.
          const preset = PRESETS.find((each) => each.id === next);
          if (!preset) return;
          setRange(preset.range(Temporal.Now.plainDateISO()));
          setPressed(preset.id);
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
