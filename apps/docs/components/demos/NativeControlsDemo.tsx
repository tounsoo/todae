'use client';

import { Label, Meter, Progress, Slider, Stack, Text } from '@omsoo.design/todae';
import { useId, useState } from 'react';

export function ProgressStates() {
  const done = useId();
  const loading = useId();
  return (
    <Stack.Root>
      <Label.Root htmlFor={done}>Uploading report.pdf</Label.Root>
      <Progress.Root id={done} value={64} max={100}>
        64%
      </Progress.Root>
      <Label.Root htmlFor={loading}>Loading results</Label.Root>
      <Progress.Root id={loading} />
    </Stack.Root>
  );
}

export function MeterLevels() {
  const storage = useId();
  const battery = useId();
  return (
    <Stack.Root>
      <Label.Root htmlFor={storage}>Storage used</Label.Root>
      <Meter.Root id={storage} min={0} max={100} low={70} high={90} optimum={0} value={92}>
        92%
      </Meter.Root>
      <Label.Root htmlFor={battery}>Battery</Label.Root>
      <Meter.Root id={battery} min={0} max={100} low={20} high={60} optimum={100} value={80}>
        80%
      </Meter.Root>
    </Stack.Root>
  );
}

export function SliderVolume() {
  const id = useId();
  const [value, setValue] = useState(40);
  return (
    <Stack.Root>
      <Label.Root htmlFor={id}>Volume</Label.Root>
      <Slider.Root
        id={id}
        min={0}
        max={100}
        step={5}
        value={value}
        onChange={(event) => setValue(Number(event.target.value))}
      />
      <Text.Root>{value}%</Text.Root>
    </Stack.Root>
  );
}
