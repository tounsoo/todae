'use client';

import { Label, Meter, Progress, Slider, Stack, Text } from '@omsoo/todae';
import { useId, useState } from 'react';

export function ProgressStates() {
  const done = useId();
  const loading = useId();
  return (
    <Stack>
      <Label htmlFor={done}>Uploading report.pdf</Label>
      <Progress.Root id={done} value={64} max={100}>
        64%
      </Progress.Root>
      <Label htmlFor={loading}>Loading results</Label>
      <Progress.Root id={loading} />
    </Stack>
  );
}

export function MeterLevels() {
  const storage = useId();
  const battery = useId();
  return (
    <Stack>
      <Label htmlFor={storage}>Storage used</Label>
      <Meter.Root id={storage} min={0} max={100} low={70} high={90} optimum={0} value={92}>
        92%
      </Meter.Root>
      <Label htmlFor={battery}>Battery</Label>
      <Meter.Root id={battery} min={0} max={100} low={20} high={60} optimum={100} value={80}>
        80%
      </Meter.Root>
    </Stack>
  );
}

export function SliderVolume() {
  const id = useId();
  const [value, setValue] = useState(40);
  return (
    <Stack>
      <Label htmlFor={id}>Volume</Label>
      <Slider.Root
        id={id}
        min={0}
        max={100}
        step={5}
        value={value}
        onChange={(event) => setValue(Number(event.target.value))}
      />
      <Text>{value}%</Text>
    </Stack>
  );
}
