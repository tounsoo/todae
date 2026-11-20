'use client';

import { ToggleGroup } from '@tounsoo/todae';

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'] as const;

export default function ToggleGroupWrap() {
  return (
    <div style={{ maxInlineSize: '16rem' }}>
      <ToggleGroup.Root aria-label="Days" defaultValue="Monday">
        {DAYS.map((day) => (
          <ToggleGroup.Item key={day} value={day}>
            {day}
          </ToggleGroup.Item>
        ))}
      </ToggleGroup.Root>
    </div>
  );
}
