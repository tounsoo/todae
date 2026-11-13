'use client';

import {
  Button,
  Menu,
  Text,
  useAnnouncer,
  useFocusHandoff,
  useLaneDrag,
  useLaneDragState,
  type LanePlace,
  type LaneVerdict,
  type UseLaneDragResult,
} from '@tounsoo/todae';
import { Ban, EllipsisVertical, GripVertical, TriangleAlert } from 'lucide-react';
import { memo, useId, useRef, useState, type RefObject } from 'react';
import styles from './Schedule.module.css';

// One day from 9:00 to 17:00, counted in minutes from 9:00. Talks snap to quarter hours.
const DAY = { start: 0, end: 480 };
const GRID = Array.from({ length: DAY.end / 15 + 1 }, (_, i) => i * 15);
const CHANGEOVER = 15;

type Stage = { id: string; name: string };
type Talk = { id: string; title: string; speaker: string; length: number; at: LanePlace | null };

const STAGES: Stage[] = [
  { id: 'main', name: 'Main hall' },
  { id: 'a', name: 'Room A' },
  { id: 'b', name: 'Room B' },
];

const TALKS: Talk[] = [
  { id: 'keynote', title: 'Opening keynote', speaker: 'Ana Ruiz', length: 60, at: { lane: 'main', start: 0, end: 60 } },
  { id: 'tokens', title: 'Tokens that travel', speaker: 'Kenji Sato', length: 45, at: { lane: 'a', start: 75, end: 120 } },
  { id: 'forms', title: 'Forms people finish', speaker: 'Mira Patel', length: 30, at: { lane: 'b', start: 90, end: 120 } },
  { id: 'motion', title: 'Motion with purpose', speaker: 'Ana Ruiz', length: 45, at: { lane: 'a', start: 180, end: 225 } },
  { id: 'audit', title: 'Auditing a design system', speaker: 'Leo Brandt', length: 30, at: null },
  { id: 'panel', title: 'Panel: shipping 1.0', speaker: 'Kenji Sato', length: 60, at: null },
  { id: 'dark', title: 'Dark mode, done right', speaker: 'Mira Patel', length: 30, at: null },
];

const clock = (minutes: number) => `${9 + Math.floor(minutes / 60)}:${String(minutes % 60).padStart(2, '0')}`;
const stageName = (id: string) => STAGES.find((stage) => stage.id === id)!.name;

/** Whether `talk` may go to `to`: a stage holds one talk at a time, a speaker gives one talk at a time, and a stage needs a changeover between talks. */
function verdictFor(talks: readonly Talk[], id: string, to: LanePlace): LaneVerdict | null {
  const talk = talks.find((each) => each.id === id)!;
  const blocked: Talk[] = [];
  const warned: Talk[] = [];
  let reason = '';
  for (const other of talks) {
    const at = other.at;
    if (other.id === id || at === null) continue;
    const overlaps = at.start < to.end && to.start < at.end;
    if (overlaps && at.lane === to.lane) {
      blocked.push(other);
      reason ||= `Overlaps ${other.title}`;
    } else if (overlaps && other.speaker === talk.speaker) {
      blocked.push(other);
      reason ||= `${talk.speaker} is in ${stageName(at.lane)} then`;
    } else if (at.lane === to.lane && at.start < to.end + CHANGEOVER && to.start < at.end + CHANGEOVER) {
      warned.push(other);
    }
  }
  if (blocked.length > 0) return { level: 'blocked', reason, with: blocked.map((other) => other.id) };
  if (warned.length > 0) return { level: 'warning', reason: `No changeover beside ${warned[0]!.title}`, with: warned.map((other) => other.id) };
  return null;
}

/** The earliest place on `lane` that no rule blocks, for the menu's Schedule items. */
function firstFree(talks: readonly Talk[], talk: Talk, lane: string): LanePlace | null {
  for (let start = DAY.start; start + talk.length <= DAY.end; start += 15) {
    const to = { lane, start, end: start + talk.length };
    if (verdictFor(talks, talk.id, to)?.level !== 'blocked') return to;
  }
  return null;
}

type Move = (id: string, to: LanePlace | null, verdict: LaneVerdict | null) => void;

/** Where a drag would put a talk in this stage, with what the rules say about it. */
const Preview = memo(function Preview({ drag, stage, talks }: { drag: UseLaneDragResult['drag']; stage: string; talks: readonly Talk[] }) {
  const change = useLaneDragState(drag, (state) => (state?.to?.lane === stage ? state : null));
  if (change?.to == null) return null;
  const { to, verdict } = change;
  const talk = talks.find((each) => each.id === change.id)!;
  return (
    <div
      className={styles.preview}
      data-level={verdict?.level}
      style={{ insetInlineStart: `${(to.start / DAY.end) * 100}%`, inlineSize: `${((to.end - to.start) / DAY.end) * 100}%` }}
    >
      <span className={styles.time}>
        {clock(to.start)}–{clock(to.end)}
      </span>
      {verdict ? (
        <span className={styles.reason}>
          {verdict.level === 'blocked' ? <Ban size="1em" aria-hidden /> : <TriangleAlert size="1em" aria-hidden />}
          {verdict.reason}
        </span>
      ) : (
        <span className={styles.reason}>{talk.title}</span>
      )}
    </div>
  );
});

function TalkMenu({ talk, talks, move, trigger }: { talk: Talk; talks: readonly Talk[]; move: Move; trigger?: RefObject<HTMLButtonElement | null> }) {
  const at = talk.at;
  // The talk's place with its start and end moved, or null where it doesn't fit the day or a rule blocks it.
  const shift = (start: number, end: number) => {
    if (at === null) return null;
    const to = { lane: at.lane, start: at.start + start, end: at.end + end };
    const fits = to.start >= DAY.start && to.end <= DAY.end && to.end - to.start >= 15;
    return fits && verdictFor(talks, talk.id, to)?.level !== 'blocked' ? to : null;
  };
  const items = [
    { label: '15 minutes earlier', to: shift(-15, -15) },
    { label: '15 minutes later', to: shift(15, 15) },
    { label: 'Start 15 minutes earlier', to: shift(-15, 0) },
    { label: 'Start 15 minutes later', to: shift(15, 0) },
    { label: 'End 15 minutes earlier', to: shift(0, -15) },
    { label: 'End 15 minutes later', to: shift(0, 15) },
  ];
  return (
    <Menu.Root>
      <Menu.Trigger ref={trigger} variant="ghost" aria-label={`Move ${talk.title}`} className={styles.menu}>
        <Button.Icon>
          <EllipsisVertical />
        </Button.Icon>
      </Menu.Trigger>
      <Menu.Content>
        {at !== null ? (
          <>
            {items.map(({ label, to }) => (
              <Menu.Item key={label} disabled={to === null} onSelect={() => to && move(talk.id, to, verdictFor(talks, talk.id, to))}>
                {label}
              </Menu.Item>
            ))}
            <Menu.Separator />
          </>
        ) : null}
        {STAGES.filter((stage) => stage.id !== at?.lane).map((stage) => {
          const to = at === null ? firstFree(talks, talk, stage.id) : { ...at, lane: stage.id };
          const open = to !== null && verdictFor(talks, talk.id, to)?.level !== 'blocked';
          return (
            <Menu.Item key={stage.id} disabled={!open} onSelect={() => to && move(talk.id, to, verdictFor(talks, talk.id, to))}>
              {at === null ? `Schedule in ${stage.name}` : `Move to ${stage.name}`}
            </Menu.Item>
          );
        })}
        {at !== null ? (
          <>
            <Menu.Separator />
            <Menu.Item onSelect={() => move(talk.id, null, null)}>Back to unscheduled</Menu.Item>
          </>
        ) : null}
      </Menu.Content>
    </Menu.Root>
  );
}

function Block({
  talk,
  talks,
  lanes,
  move,
  landing,
  landed,
}: {
  talk: Talk;
  talks: readonly Talk[];
  lanes: UseLaneDragResult;
  move: Move;
  landing: RefObject<HTMLButtonElement | null>;
  landed: string | null;
}) {
  // A talk moved to another stage, or off the board, leaves its old element while its menu holds
  // focus. Focus goes on to the talk's menu button in its new place.
  const handoff = useFocusHandoff({ to: landing });
  const at = talk.at!;
  return (
    <div
      ref={handoff}
      {...lanes.getItemProps(talk.id, at)}
      className={styles.block}
      style={{ insetInlineStart: `${(at.start / DAY.end) * 100}%`, inlineSize: `${((at.end - at.start) / DAY.end) * 100}%` }}
    >
      <span {...lanes.getHandleProps(talk.id, 'start')} aria-hidden className={styles.edge} data-edge="start" />
      <span {...lanes.getHandleProps(talk.id, 'move')} aria-hidden className={styles.grip}>
        <GripVertical size="1em" />
      </span>
      <span className={styles.body}>
        <Text.Root weight="medium" lines={1}>
          {talk.title}
        </Text.Root>
        <Text.Root tone="muted" lines={1}>
          {clock(at.start)}–{clock(at.end)} · {talk.speaker}
        </Text.Root>
      </span>
      <TalkMenu talk={talk} talks={talks} move={move} trigger={talk.id === landed ? landing : undefined} />
      <span {...lanes.getHandleProps(talk.id, 'end')} aria-hidden className={styles.edge} data-edge="end" />
    </div>
  );
}

function QueueCard({
  talk,
  talks,
  lanes,
  move,
  landing,
  landed,
}: {
  talk: Talk;
  talks: readonly Talk[];
  lanes: UseLaneDragResult;
  move: Move;
  landing: RefObject<HTMLButtonElement | null>;
  landed: string | null;
}) {
  const handoff = useFocusHandoff({ to: landing });
  return (
    <li ref={handoff} {...lanes.getItemProps(talk.id, { span: talk.length })} className={styles.card}>
      <span {...lanes.getHandleProps(talk.id, 'move')} aria-hidden className={styles.grip}>
        <GripVertical size="1em" />
      </span>
      <span className={styles.body}>
        <Text.Root weight="medium">{talk.title}</Text.Root>
        <Text.Root tone="muted">
          {talk.length} min · {talk.speaker}
        </Text.Root>
      </span>
      <TalkMenu talk={talk} talks={talks} move={move} trigger={talk.id === landed ? landing : undefined} />
    </li>
  );
}

export default function ScheduleExample() {
  const [talks, setTalks] = useState(TALKS);
  const announce = useAnnouncer();
  const queueId = useId();
  // The menu button of the talk that last changed place, which takes focus from its old element.
  const landing = useRef<HTMLButtonElement | null>(null);
  const [landed, setLanded] = useState<string | null>(null);

  // A drag and a menu item both move a talk here. A talk keeps the length it was last given.
  const move: Move = (id, to, verdict) => {
    const talk = talks.find((each) => each.id === id)!;
    setLanded(id);
    setTalks((list) => list.map((each) => (each.id === id ? { ...each, at: to, length: to === null ? each.length : to.end - to.start } : each)));
    const where = to === null ? 'unscheduled' : `${stageName(to.lane)}, ${clock(to.start)} to ${clock(to.end)}`;
    announce(`${talk.title} moved to ${where}${verdict ? `. ${verdict.reason}` : ''}`);
  };

  const lanes = useLaneDrag({
    range: DAY,
    grid: GRID,
    minSpan: 15,
    check: (id, to) => verdictFor(talks, id, to),
    onDrop: ({ id, to, verdict }) => move(id, to, verdict),
  });

  const queue = talks.filter((talk) => talk.at === null);
  return (
    <div className={styles.schedule}>
      <div {...lanes.getBoardProps()} className={styles.board}>
        <div className={styles.hours} aria-hidden>
          <span className={styles.corner} />
          <div className={styles.ticks}>
            {Array.from({ length: 8 }, (_, hour) => (
              <span key={hour}>{clock(hour * 60)}</span>
            ))}
          </div>
        </div>
        {STAGES.map((stage) => (
          <section key={stage.id} className={styles.stage} aria-label={stage.name}>
            <Text.Root variant="label" className={styles.name}>
              {stage.name}
            </Text.Root>
            <div {...lanes.getLaneProps(stage.id)} className={styles.lane}>
              {talks
                .filter((talk) => talk.at?.lane === stage.id)
                .map((talk) => (
                  <Block key={talk.id} talk={talk} talks={talks} lanes={lanes} move={move} landing={landing} landed={landed} />
                ))}
              <Preview drag={lanes.drag} stage={stage.id} talks={talks} />
            </div>
          </section>
        ))}
      </div>
      <section aria-labelledby={queueId} className={styles.queueArea}>
        <Text.Root id={queueId} variant="label">
          Unscheduled
        </Text.Root>
        <ul {...lanes.getQueueProps()} className={styles.queue}>
          {queue.map((talk) => (
            <QueueCard key={talk.id} talk={talk} talks={talks} lanes={lanes} move={move} landing={landing} landed={landed} />
          ))}
          {queue.length === 0 ? <li className={styles.empty}>Every talk is scheduled</li> : null}
        </ul>
      </section>
    </div>
  );
}
