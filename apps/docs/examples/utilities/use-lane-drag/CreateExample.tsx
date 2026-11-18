'use client';

import { Button, useAnnouncer, useLaneDrag, useLaneDragState, type LanePlace } from '@tounsoo/todae';
import { useRef, useState } from 'react';
import styles from './Create.module.css';

// One morning, 9:00 to 12:00, counted in minutes from 9:00. Places snap to
// quarter hours, and a click takes half an hour.
const DAY = 180;
const GRID = Array.from({ length: DAY / 15 + 1 }, (_, i) => i * 15);
const SLOT = 30;

type CalendarEvent = { id: string; at: LanePlace };

const clock = (minute: number) => {
  const total = 9 * 60 + minute;
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
};

const placeStyle = (at: LanePlace) => ({
  insetBlockStart: `${(at.start / DAY) * 100}%`,
  blockSize: `${((at.end - at.start) / DAY) * 100}%`,
});

export default function CreateExample() {
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const nextId = useRef(1);
  const announce = useAnnouncer();
  const say = (at: LanePlace, verb: string) => announce(`${verb} ${clock(at.start)} to ${clock(at.end)}.`);
  const add = (at: LanePlace) => {
    const id = `event-${nextId.current}`;
    nextId.current += 1;
    setEvents((list) => [...list, { id, at }]);
    say(at, 'Added');
  };
  const lanes = useLaneDrag({
    range: { start: 0, end: DAY },
    axis: 'block',
    grid: GRID,
    minSpan: SLOT,
    onCreate: add,
    onDrop: ({ id, to }) => {
      if (to === null) return;
      setEvents((list) => list.map((event) => (event.id === id ? { ...event, at: to } : event)));
      say(to, 'Moved to');
    },
  });
  const preview = useLaneDragState(lanes.drag, (state) => (state?.to?.lane === 'day' ? state.to : null));
  const nextStart = events.reduce((end, event) => Math.max(end, event.at.end), 0);

  return (
    <div className={styles.root}>
      <div className={styles.toolbar}>
        <Button.Root
          type="button"
          variant="secondary"
          disabled={nextStart + SLOT > DAY}
          onClick={() => add({ lane: 'day', start: nextStart, end: nextStart + SLOT })}
        >
          New event
        </Button.Root>
        <p className={styles.note}>Drag empty space to choose a time. New event does it from the keyboard.</p>
      </div>
      <div className={styles.frame}>
        <div className={styles.times} aria-hidden>
          {[0, 60, 120].map((minute) => (
            <span key={minute} style={{ insetBlockStart: `${(minute / DAY) * 100}%` }}>
              {clock(minute)}
            </span>
          ))}
        </div>
        <div {...lanes.getBoardProps()} className={styles.board}>
          <div {...lanes.getLaneProps('day')} className={styles.lane}>
            {events.map((event) => (
              <div key={event.id} {...lanes.getItemProps(event.id, event.at)} className={styles.event} style={placeStyle(event.at)}>
                <span {...lanes.getHandleProps(event.id, 'move')} className={styles.move} aria-hidden />
                <span className={styles.label}>
                  {clock(event.at.start)} to {clock(event.at.end)}
                </span>
              </div>
            ))}
            {preview ? <div className={styles.ghost} aria-hidden style={placeStyle(preview)} /> : null}
          </div>
        </div>
      </div>
    </div>
  );
}
