'use client';

import {
  Alert,
  Badge,
  Button,
  Dialog,
  ErrorMessage,
  Field,
  Form,
  Label,
  Menu,
  ScrollArea,
  Text,
  ToggleGroup,
  formatTime,
  useAnnouncer,
  useFocusHandoff,
  useLaneDrag,
  useLaneDragState,
  type CategoryTone,
  type FormErrors,
  type LanePlace,
  type LaneVerdict,
  type UseLaneDragResult,
} from '@tounsoo/todae';
import { Ban, EllipsisVertical, GripVertical, TriangleAlert, Undo2, Video } from 'lucide-react';
import { memo, useId, useLayoutEffect, useMemo, useRef, useState, type ReactNode, type RefObject, type SubmitEvent } from 'react';
import styles from './Scheduler.module.css';

// ─── The time axis ─────────────────────────────────────────────────────────
// The board counts minutes of open hours only, so three days with the nights
// left out are one number line: day 1 is 0 to 540, day 2 is 540 to 1080.
// useLaneDrag sees those numbers; these helpers turn them into times and back.

/** One day's open hours on the axis, from `start` to `end`, opening at `opens`. */
export type Segment = { day: Temporal.PlainDate; start: number; end: number; opens: Temporal.ZonedDateTime };
export type Timeline = { segments: readonly Segment[]; range: { start: number; end: number } };

/**
 * The axis for `days`, each open from `opens` to `closes` in `timeZone`. Units are elapsed minutes,
 * so a day that changes its clock is as long as it really is. A wall time a clock change skips
 * or repeats becomes the later or the earlier one, as Temporal's `compatible` does.
 */
export function timeline({
  days,
  opens,
  closes,
  timeZone,
}: {
  days: readonly Temporal.PlainDate[];
  opens: Temporal.PlainTime;
  closes: Temporal.PlainTime;
  timeZone: string;
}): Timeline {
  let start = 0;
  const segments = days.map((day) => {
    const from = day.toZonedDateTime({ timeZone, plainTime: opens });
    const to = day.toZonedDateTime({ timeZone, plainTime: closes });
    const segment = { day, start, end: start + (to.epochMilliseconds - from.epochMilliseconds) / 60_000, opens: from };
    start = segment.end;
    return segment;
  });
  return { segments, range: { start: 0, end: start } };
}

/**
 * The segment a point is in. The end of one day and the start of the next are the same point, so
 * `edge` says which side it belongs to: a start is in the later day, an end in the earlier one.
 */
export function segmentAt(axis: Timeline, units: number, edge: 'start' | 'end' = 'start'): Segment | null {
  return axis.segments.find((segment) => (edge === 'start' ? units >= segment.start && units < segment.end : units > segment.start && units <= segment.end)) ?? null;
}

/** Where `at` sits on the axis, or null outside open hours. */
export function toUnits(axis: Timeline, at: Temporal.ZonedDateTime, edge: 'start' | 'end' = 'start'): number | null {
  for (const segment of axis.segments) {
    const minutes = (at.epochMilliseconds - segment.opens.epochMilliseconds) / 60_000;
    const length = segment.end - segment.start;
    if (edge === 'start' ? minutes >= 0 && minutes < length : minutes > 0 && minutes <= length) return segment.start + minutes;
  }
  return null;
}

/** The time at a point on the axis, or null outside it. */
export function fromUnits(axis: Timeline, units: number, edge: 'start' | 'end' = 'start'): Temporal.ZonedDateTime | null {
  const segment = segmentAt(axis, units, edge);
  return segment ? segment.opens.add({ minutes: units - segment.start }) : null;
}

/** Every `step` minutes from each day's opening, with each closing, for `useLaneDrag`'s `grid`. */
export function snapGrid(axis: Timeline, step: number): number[] {
  const points = new Set<number>();
  for (const segment of axis.segments) {
    for (let at = segment.start; at < segment.end; at += step) points.add(at);
    points.add(segment.end);
  }
  return [...points].sort((a, b) => a - b);
}

// ─── The conflict rule ─────────────────────────────────────────────────────
// Each booking lists the things it uses, such as its stage and each speaker.
// Two bookings that share one and overlap conflict, on whatever lanes they sit.

export type Booking = { id: string; start: number; end: number; keys: readonly string[] };
/** A window nothing may use: `keys` it closes, or every key. */
export type ClosedWindow = { start: number; end: number; keys: readonly string[] | 'all'; reason: string };

/**
 * What stands in `item`'s way: the closed windows it overlaps, the bookings that share a key with
 * it and overlap it, and those that share a key and sit less than `buffer` away.
 */
export function findConflicts(item: Booking, others: readonly Booking[], { closed = [], buffer = 0 }: { closed?: readonly ClosedWindow[]; buffer?: number } = {}) {
  const shut = closed.filter((window) => window.start < item.end && item.start < window.end && (window.keys === 'all' || window.keys.some((key) => item.keys.includes(key))));
  const overlaps: { id: string; key: string }[] = [];
  const near: { id: string; key: string }[] = [];
  for (const other of others) {
    const key = other.id === item.id ? undefined : other.keys.find((each) => item.keys.includes(each));
    if (key === undefined) continue;
    if (other.start < item.end && item.start < other.end) overlaps.push({ id: other.id, key });
    else if (other.start < item.end + buffer && item.start < other.end + buffer) near.push({ id: other.id, key });
  }
  return { shut, overlaps, near };
}

// ─── The event ─────────────────────────────────────────────────────────────
// Built when the module loads, so Temporal or its polyfill has to be loaded first.

const ZONE = 'America/Los_Angeles';
const DAYS = ['2027-06-02', '2027-06-03', '2027-06-04'].map((day) => Temporal.PlainDate.from(day));
const OPENS = Temporal.PlainTime.from('09:00');
const CLOSES = Temporal.PlainTime.from('18:00');
const AXIS = timeline({ days: DAYS, opens: OPENS, closes: CLOSES, timeZone: ZONE });
/** The longest talk, a whole day, so a talk an end drag made long still fits the dialog. */
const LONGEST = 540;
/** Minutes a stage needs between talks. */
const CHANGEOVER = 10;
const SHORTEST = 15;

type Stage = { id: string; name: string; seats: number; recorded: boolean; hours?: [string, string] };
type Track = 'Design' | 'Engineering' | 'Research';
type Place = { stage: string; starts: Temporal.ZonedDateTime; ends: Temporal.ZonedDateTime };
export type Talk = {
  id: string;
  title: string;
  speakers: readonly string[];
  track: Track;
  format: 'Talk' | 'Panel' | 'Workshop';
  length: number;
  audience: number;
  recorded: boolean;
  at: Place | null;
};

const STAGES: Stage[] = [
  { id: 'main', name: 'Main stage', seats: 800, recorded: true },
  { id: 'hall', name: 'Hall B', seats: 300, recorded: true },
  { id: 'workshop', name: 'Workshop room', seats: 40, recorded: false, hours: ['10:00', '17:00'] },
];
const TRACKS: Record<Track, CategoryTone> = { Design: 'category-1', Engineering: 'category-4', Research: 'category-6' };

const zoned = (day: number, time: string) => DAYS[day]!.toZonedDateTime({ timeZone: ZONE, plainTime: Temporal.PlainTime.from(time) });
const place = (stage: string, day: number, time: string, minutes: number): Place => {
  const starts = zoned(day, time);
  return { stage, starts, ends: starts.add({ minutes }) };
};

/** Breaks and keynotes on every stage, drawn as bands, and each stage's and speaker's closed hours. */
const BANDS = [
  { day: 0, from: '09:00', to: '10:00', label: 'Opening keynote' },
  ...DAYS.map((_, day) => ({ day, from: '12:30', to: '13:30', label: 'Lunch' })),
  { day: 2, from: '17:00', to: '18:00', label: 'Closing keynote' },
];
/** A window on `day` from `from` to `to` on the axis. */
const span = (day: number, from: string, to: string) => ({ start: toUnits(AXIS, zoned(day, from), 'start')!, end: toUnits(AXIS, zoned(day, to), 'end')! });
const CLOSED: ClosedWindow[] = [
  ...BANDS.map(({ day, from, to, label }) => ({ ...span(day, from, to), keys: 'all' as const, reason: `Overlaps ${label}` })),
  ...STAGES.flatMap((stage) =>
    stage.hours
      ? DAYS.flatMap((_, day) => [
          { ...span(day, '09:00', stage.hours![0]), keys: [`stage:${stage.id}`], reason: `${stage.name} isn't open yet` },
          { ...span(day, stage.hours![1], '18:00'), keys: [`stage:${stage.id}`], reason: `${stage.name} has closed` },
        ])
      : [],
  ),
  { ...span(0, '09:00', '18:00'), keys: ['speaker:Leo Brandt'], reason: 'Leo Brandt arrives on day 2' },
];

const TALKS: Talk[] = [
  { id: 'tokens', title: 'Tokens that travel', speakers: ['Kenji Sato'], track: 'Engineering', format: 'Talk', length: 45, audience: 250, recorded: true, at: place('main', 0, '10:15', 45) },
  { id: 'forms', title: 'Forms people finish', speakers: ['Mira Patel'], track: 'Design', format: 'Talk', length: 30, audience: 180, recorded: true, at: place('hall', 0, '10:15', 30) },
  { id: 'theming', title: 'Hands-on theming', speakers: ['Ana Ruiz'], track: 'Engineering', format: 'Workshop', length: 90, audience: 35, recorded: false, at: place('workshop', 0, '10:30', 90) },
  { id: 'ops', title: 'Research ops at scale', speakers: ['Priya Nair'], track: 'Research', format: 'Talk', length: 30, audience: 350, recorded: true, at: place('hall', 0, '11:00', 30) },
  { id: 'motion', title: 'Motion with purpose', speakers: ['Ana Ruiz'], track: 'Design', format: 'Talk', length: 40, audience: 400, recorded: true, at: place('main', 0, '14:00', 40) },
  { id: 'audit', title: 'Auditing a design system', speakers: ['Leo Brandt'], track: 'Research', format: 'Talk', length: 45, audience: 300, recorded: true, at: place('main', 1, '10:00', 45) },
  { id: 'charts', title: 'Accessible charts', speakers: ['Sam Okafor'], track: 'Design', format: 'Talk', length: 30, audience: 220, recorded: true, at: place('hall', 1, '10:00', 30) },
  { id: 'panel', title: 'Panel: shipping 1.0', speakers: ['Kenji Sato', 'Mira Patel', 'Leo Brandt'], track: 'Engineering', format: 'Panel', length: 60, audience: 600, recorded: true, at: place('main', 1, '15:00', 60) },
  { id: 'copy', title: 'Writing UI copy', speakers: ['Priya Nair'], track: 'Design', format: 'Talk', length: 30, audience: 260, recorded: true, at: place('main', 2, '10:00', 30) },
  { id: 'browsers', title: 'Testing in real browsers', speakers: ['Sam Okafor'], track: 'Engineering', format: 'Talk', length: 45, audience: 200, recorded: true, at: place('hall', 2, '11:00', 45) },
  { id: 'dark', title: 'Dark mode, done right', speakers: ['Mira Patel'], track: 'Design', format: 'Talk', length: 30, audience: 200, recorded: true, at: null },
  { id: 'a11y-forms', title: 'Hands-on accessible forms', speakers: ['Sam Okafor'], track: 'Design', format: 'Workshop', length: 120, audience: 30, recorded: false, at: null },
  { id: 'lightning', title: 'Lightning talks', speakers: ['Ana Ruiz', 'Priya Nair', 'Leo Brandt'], track: 'Research', format: 'Panel', length: 45, audience: 400, recorded: true, at: null },
  { id: 'migrate', title: 'Migrating to 1.0', speakers: ['Kenji Sato'], track: 'Engineering', format: 'Talk', length: 30, audience: 250, recorded: true, at: null },
];
const SPEAKERS = [...new Set(TALKS.flatMap((talk) => talk.speakers))].sort();

const stageOf = (id: string) => STAGES.find((stage) => stage.id === id)!;
const keysOf = (talk: Talk, stage: string) => [`stage:${stage}`, ...talk.speakers.map((name) => `speaker:${name}`)];

/** A talk's place on the axis, which `useLaneDrag` and the rules read. */
function laneOf(at: Place): LanePlace {
  return { lane: at.stage, start: toUnits(AXIS, at.starts, 'start')!, end: toUnits(AXIS, at.ends, 'end')! };
}

/** Whether `id` may go to `to`. Blocked: a closed window, a stage or speaker already busy, past closing, or an unrecorded stage. A warning: a full room, a tight changeover, or the same track at once. */
export function verdictFor(talks: readonly Talk[], id: string, to: LanePlace): LaneVerdict | null {
  const talk = talks.find((each) => each.id === id)!;
  const stage = stageOf(to.lane);
  const day = segmentAt(AXIS, to.start, 'start');
  if (!day || to.end > day.end) return { level: 'blocked', reason: 'Runs past closing' };
  const placed = talks.flatMap((other) => (other.at && other.id !== id ? [{ talk: other, at: laneOf(other.at) }] : []));
  const found = findConflicts(
    { id, start: to.start, end: to.end, keys: keysOf(talk, to.lane) },
    placed.map(({ talk: other, at }) => ({ id: other.id, start: at.start, end: at.end, keys: keysOf(other, at.lane) })),
    { closed: CLOSED, buffer: CHANGEOVER },
  );
  const title = (other: string) => talks.find((each) => each.id === other)!.title;
  const overlap = found.overlaps[0];
  const reason = found.shut[0]?.reason
    ?? (overlap && (overlap.key.startsWith('stage:') ? `Overlaps ${title(overlap.id)}` : `${overlap.key.slice('speaker:'.length)} is in ${title(overlap.id)} then`))
    ?? (talk.recorded && !stage.recorded ? `${stage.name} isn't recorded` : null);
  if (reason) return { level: 'blocked', reason, with: found.overlaps.map((each) => each.id) };

  const warnings: string[] = [];
  // The axis leaves the nights out, so a talk that ends one day sits next to one that opens the next.
  // A changeover counts only within a day.
  const startOf = (other: string) => placed.find(({ talk: each }) => each.id === other)!.at.start;
  const near = found.near.filter((each) => each.key === `stage:${to.lane}` && segmentAt(AXIS, startOf(each.id), 'start')?.day.equals(day.day));
  const sameTrack = placed.filter(({ talk: other, at }) => other.track === talk.track && at.lane !== to.lane && at.start < to.end && to.start < at.end);
  if (talk.audience > stage.seats) warnings.push(`Expects ${talk.audience}, ${stage.name} seats ${stage.seats}`);
  if (near[0]) warnings.push(`Under ${CHANGEOVER} minutes from ${title(near[0].id)}`);
  if (sameTrack[0]) warnings.push(`Same track as ${sameTrack[0].talk.title}`);
  if (warnings.length === 0) return null;
  return { level: 'warning', reason: warnings.join('. '), with: [...near.map((each) => each.id), ...sameTrack.map(({ talk: other }) => other.id)] };
}

/** The earliest place on `stage` with no warning, or else the earliest no rule blocks, every quarter hour from day 1. */
function firstFree(talks: readonly Talk[], talk: Talk, stage: string): LanePlace | null {
  let allowed: LanePlace | null = null;
  for (let start = AXIS.range.start; start + talk.length <= AXIS.range.end; start += 15) {
    const to = { lane: stage, start, end: start + talk.length };
    const verdict = verdictFor(talks, talk.id, to);
    if (verdict === null) return to;
    if (verdict.level !== 'blocked') allowed ??= to;
  }
  return allowed;
}

// ─── Words ─────────────────────────────────────────────────────────────────

const dayLabel = (day: Temporal.PlainDate, locale: string) =>
  new Intl.DateTimeFormat(locale, { weekday: 'short', month: 'short', day: 'numeric', timeZone: 'UTC' }).format(Date.UTC(day.year, day.month - 1, day.day));
const clock = (at: Temporal.ZonedDateTime, locale: string) => formatTime(at.toPlainTime(), { locale });
const during = (at: Place, locale: string) => `${dayLabel(at.starts.toPlainDate(), locale)}, ${clock(at.starts, locale)} to ${clock(at.ends, locale)}`;

// ─── The board ─────────────────────────────────────────────────────────────

type Move = (id: string, to: LanePlace | null, verdict: LaneVerdict | null) => void;
type Shared = {
  talks: readonly Talk[];
  lanes: UseLaneDragResult;
  move: Move;
  edit: (id: string) => void;
  landing: RefObject<HTMLButtonElement | null>;
  landed: string | null;
  locale: string;
};

/** Where a drag would put a talk in this stage, with what the rules say about it. */
const Preview = memo(function Preview({ drag, stage, locale }: { drag: UseLaneDragResult['drag']; stage: string; locale: string }) {
  const change = useLaneDragState(drag, (state) => (state?.to?.lane === stage ? state : null));
  if (change?.to == null) return null;
  const { to, verdict } = change;
  const starts = fromUnits(AXIS, to.start, 'start');
  // A place that runs past closing ends on the next day's axis, so it shows its start alone.
  const ends = segmentAt(AXIS, to.start, 'start') === segmentAt(AXIS, to.end, 'end') ? fromUnits(AXIS, to.end, 'end') : null;
  return (
    <div className={styles.preview} data-level={verdict?.level} style={{ insetInlineStart: `${(to.start / AXIS.range.end) * 100}%`, inlineSize: `${((to.end - to.start) / AXIS.range.end) * 100}%` }}>
      <span className={styles.time}>{starts ? (ends ? `${clock(starts, locale)}–${clock(ends, locale)}` : clock(starts, locale)) : null}</span>
      {verdict ? (
        <span className={styles.reason}>
          {verdict.level === 'blocked' ? <Ban size="1em" aria-hidden /> : <TriangleAlert size="1em" aria-hidden />}
          {verdict.reason}
        </span>
      ) : null}
    </div>
  );
});

/** A talk's menu. A placed talk passes what it shows as `children`, so the talk is its button. */
function TalkMenu({ talk, talks, move, edit, trigger, name, children }: Pick<Shared, 'talks' | 'move' | 'edit'> & { talk: Talk; trigger?: RefObject<HTMLButtonElement | null>; name: string; children?: ReactNode }) {
  return (
    <Menu.Root>
      <Menu.Trigger ref={trigger} variant="ghost" aria-label={name} className={styles.menu}>
        {children ?? (
          <Button.Icon>
            <EllipsisVertical />
          </Button.Icon>
        )}
      </Menu.Trigger>
      <Menu.Content>
        <TalkMoves talk={talk} talks={talks} move={move} edit={edit} />
      </Menu.Content>
    </Menu.Root>
  );
}

/** A talk's moves, each asked of the rules. Menu mounts its items on the first open, so a menu nobody opened checks nothing. */
function TalkMoves({ talk, talks, move, edit }: Pick<Shared, 'talks' | 'move' | 'edit'> & { talk: Talk }) {
  const at = talk.at ? laneOf(talk.at) : null;
  const open = (to: LanePlace | null) => (to !== null && verdictFor(talks, talk.id, to)?.level !== 'blocked' ? to : null);
  const shift = (by: number) => (at ? open({ ...at, start: at.start + by, end: at.end + by }) : null);
  const go = (to: LanePlace | null) => to && move(talk.id, to, verdictFor(talks, talk.id, to));
  return (
    <>
      <Menu.Item onSelect={() => edit(talk.id)}>{at ? 'Change time or stage…' : 'Schedule…'}</Menu.Item>
      <Menu.Separator />
      {at ? (
        <>
          <Menu.Item disabled={shift(-15) === null} onSelect={() => go(shift(-15))}>
            15 minutes earlier
          </Menu.Item>
          <Menu.Item disabled={shift(15) === null} onSelect={() => go(shift(15))}>
            15 minutes later
          </Menu.Item>
          <Menu.Separator />
        </>
      ) : null}
      {STAGES.filter((stage) => stage.id !== at?.lane).map((stage) => {
        const to = at ? open({ ...at, lane: stage.id }) : firstFree(talks, talk, stage.id);
        return (
          <Menu.Item key={stage.id} disabled={to === null} onSelect={() => go(to)}>
            {at ? `Move to ${stage.name}` : `First free time on ${stage.name}`}
          </Menu.Item>
        );
      })}
      {at ? (
        <>
          <Menu.Separator />
          <Menu.Item onSelect={() => move(talk.id, null, null)}>Back to unscheduled</Menu.Item>
        </>
      ) : null}
    </>
  );
}

/** With a speaker picked, their talks are marked and the rest recede. */
type Highlight = 'picked' | 'dimmed' | undefined;

function Block({ talk, highlight, ...shared }: Shared & { talk: Talk; highlight: Highlight }) {
  // A talk that changes stage, or goes back to the queue, leaves its old element while its menu
  // holds focus. Focus goes on to the talk's menu button in its new place.
  const handoff = useFocusHandoff({ to: shared.landing });
  const at = laneOf(talk.at!);
  const verdict = verdictFor(shared.talks, talk.id, at);
  const name = [talk.title, talk.speakers.join(', '), talk.track, stageOf(at.lane).name, during(talk.at!, shared.locale), verdict ? `warning: ${verdict.reason}` : null].filter(Boolean).join(', ');
  return (
    <li
      ref={handoff}
      {...shared.lanes.getItemProps(talk.id, at)}
      className={styles.block}
      // Between drags a talk shows its own warning; the hook puts this back after each drag.
      data-conflict={verdict?.level}
      data-highlight={highlight}
      style={{
        insetInlineStart: `${(at.start / AXIS.range.end) * 100}%`,
        inlineSize: `${((at.end - at.start) / AXIS.range.end) * 100}%`,
        ['--track' as string]: `var(--todae-color-${TRACKS[talk.track]}-border)`,
      }}
    >
      <span {...shared.lanes.getHandleProps(talk.id, 'start')} aria-hidden className={styles.edge} data-edge="start" />
      <span {...shared.lanes.getHandleProps(talk.id, 'move')} aria-hidden className={styles.grip}>
        <GripVertical size="1em" />
      </span>
      {/* The talk is its menu button, so its title and time take the room a separate button would. The
          button's name says it all; a title the clamp cuts shows whole in a tooltip on hover or focus. */}
      <TalkMenu talk={talk} talks={shared.talks} move={shared.move} edit={shared.edit} trigger={talk.id === shared.landed ? shared.landing : undefined} name={name}>
        <span className={styles.body}>
          <Text.Root as="span" lines={2} weight="medium" className={styles.title}>
            {talk.title}
          </Text.Root>
          <Text.Root as="span" lines={1} tone="muted" className={styles.meta}>
            {clock(talk.at!.starts, shared.locale)} · {talk.speakers.join(', ')}
          </Text.Root>
        </span>
        {verdict ? <TriangleAlert className={styles.flag} size="1em" aria-hidden /> : null}
      </TalkMenu>
      <span {...shared.lanes.getHandleProps(talk.id, 'end')} aria-hidden className={styles.edge} data-edge="end" />
    </li>
  );
}

function QueueCard({ talk, highlight, ...shared }: Shared & { talk: Talk; highlight: Highlight }) {
  const handoff = useFocusHandoff({ to: shared.landing });
  return (
    <li ref={handoff} {...shared.lanes.getItemProps(talk.id, { span: talk.length })} className={styles.card} data-highlight={highlight}>
      <span {...shared.lanes.getHandleProps(talk.id, 'move')} aria-hidden className={styles.grip}>
        <GripVertical size="1em" />
      </span>
      <span className={styles.body}>
        <Text.Root weight="medium">{talk.title}</Text.Root>
        <Text.Root tone="muted">
          {talk.length} min · {talk.speakers.join(', ')}
        </Text.Root>
        <span className={styles.tags}>
          <Badge.Root tone={TRACKS[talk.track]}>{talk.track}</Badge.Root>
          <Badge.Root>{talk.format}</Badge.Root>
        </span>
      </span>
      <TalkMenu talk={talk} talks={shared.talks} move={shared.move} edit={shared.edit} trigger={talk.id === shared.landed ? shared.landing : undefined} name={`${talk.title}, ${talk.speakers.join(', ')}, ${talk.length} minutes, unscheduled`} />
    </li>
  );
}

// ─── The dialog ────────────────────────────────────────────────────────────

/** Picks a talk's stage, day, start and length, for the keyboard and anyone who can't drag. */
function PlaceForm({ talk, talks, locale, onSave }: { talk: Talk; talks: readonly Talk[]; locale: string; onSave: (to: LanePlace, verdict: LaneVerdict | null) => void }) {
  const ids = { stage: useId(), day: useId(), start: useId(), length: useId(), title: useId() };
  // Where the fields start: the talk's place, or for a queued talk the first free time on the main
  // stage. Read once, so the title and button don't change as the dialog closes after a save.
  const [from] = useState(() => {
    if (talk.at) return { placed: true, stage: talk.at.stage, starts: talk.at.starts };
    const first = firstFree(talks, talk, 'main');
    return { placed: false, stage: first?.lane ?? 'main', starts: first ? fromUnits(AXIS, first.start)! : null };
  });
  const [stage, setStage] = useState(from.stage);
  const [day, setDay] = useState(() => String(from.starts ? DAYS.findIndex((each) => each.equals(from.starts!.toPlainDate())) : 0));
  const [start, setStart] = useState<Temporal.PlainTime | null>(from.starts?.toPlainTime() ?? OPENS);
  const [length, setLength] = useState<number | null>(talk.length);
  const [errors, setErrors] = useState<FormErrors>({});
  // An error is about the fields as they were, so a change clears it.
  const edited =
    <T,>(set: (value: T) => void) =>
    (value: T) => {
      setErrors({});
      set(value);
    };

  // The place the fields name, or why they name none.
  const target = ((): { to: LanePlace } | { error: string } | null => {
    if (start === null || length === null) return null;
    const at = toUnits(AXIS, DAYS[Number(day)]!.toZonedDateTime({ timeZone: ZONE, plainTime: start }));
    if (at === null) return { error: `Start at ${formatTime(OPENS, { locale })} or later, and before ${formatTime(CLOSES, { locale })}.` };
    return { to: { lane: stage, start: at, end: at + length } };
  })();
  const verdict = target && 'to' in target ? verdictFor(talks, talk.id, target.to) : null;

  const submit = (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (target === null) return;
    if ('error' in target) return setErrors({ start: target.error });
    if (verdict?.level === 'blocked') return setErrors({ start: `${verdict.reason}.` });
    onSave(target.to, verdict);
  };

  return (
    <Form.Root errors={errors} onSubmit={submit} aria-labelledby={ids.title} className={styles.dialogForm}>
      <Dialog.Header>
        <Dialog.Title id={ids.title}>{from.placed ? `Move ${talk.title}` : `Schedule ${talk.title}`}</Dialog.Title>
        <Dialog.Close />
      </Dialog.Header>
      <Dialog.Body>
        <div className={styles.fields}>
          <Field.Group>
            <Label.Root htmlFor={ids.stage}>Stage</Label.Root>
            <Field.Root id={ids.stage} name="stage">
              <Field.Select value={stage} onChange={(event) => edited(setStage)(event.target.value)}>
                {STAGES.map((each) => (
                  <option key={each.id} value={each.id}>
                    {each.name}
                  </option>
                ))}
              </Field.Select>
            </Field.Root>
          </Field.Group>
          <Field.Group>
            <Label.Root htmlFor={ids.day}>Day</Label.Root>
            <Field.Root id={ids.day} name="day">
              <Field.Select value={day} onChange={(event) => edited(setDay)(event.target.value)}>
                {DAYS.map((each, index) => (
                  <option key={index} value={index}>
                    {dayLabel(each, locale)}
                  </option>
                ))}
              </Field.Select>
            </Field.Root>
          </Field.Group>
          <Field.Group>
            <Label.Root htmlFor={ids.start}>Starts</Label.Root>
            <Field.Root id={ids.start} name="start">
              <Field.TimeInput required value={start} onValueChange={edited(setStart)} locale={locale} />
            </Field.Root>
            <ErrorMessage.Root />
          </Field.Group>
          <Field.Group>
            <Label.Root htmlFor={ids.length}>Minutes</Label.Root>
            <Field.Root id={ids.length} name="length">
              <Field.NumberInput required value={length} onValueChange={edited(setLength)} min={SHORTEST} max={LONGEST} step={5} locale={locale} />
            </Field.Root>
            <ErrorMessage.Root />
          </Field.Group>
        </div>
        {verdict?.level === 'warning' ? (
          <Alert.Root tone="warning" className={styles.alert}>
            {verdict.reason}.
          </Alert.Root>
        ) : null}
      </Dialog.Body>
      <Dialog.Footer>
        <Dialog.Close>Cancel</Dialog.Close>
        <Button.Root type="submit">{from.placed ? 'Move' : 'Schedule'}</Button.Root>
      </Dialog.Footer>
    </Form.Root>
  );
}

// ─── The schedule ──────────────────────────────────────────────────────────

// One day gives every talk room for its grip and text and snaps to 5 minutes. The whole event is
// the overview and snaps to 15; an hour there is 7.5rem, so a half-hour talk still shows the start
// of its title.
const ZOOM = { event: { step: 15, minute: '0.125rem' }, day: { step: 5, minute: '0.25rem' } } as const;

export default function SchedulerExample({ locale = 'en-US' }: { locale?: string }) {
  const [talks, setTalks] = useState(TALKS);
  const [history, setHistory] = useState<{ talks: Talk[]; said: string }[]>([]);
  const [zoom, setZoom] = useState<keyof typeof ZOOM>('day');
  const [speaker, setSpeaker] = useState('');
  // The talk the dialog edits, and the one it shows, which stays while the dialog closes.
  const [editing, setEditing] = useState<string | null>(null);
  const [shown, setShown] = useState<{ id: string; opened: number } | null>(null);
  const announce = useAnnouncer();
  const ids = { speaker: useId(), queue: useId() };
  const board = useRef<HTMLDivElement>(null);
  const days = useRef<(HTMLElement | null)[]>([]);
  // The menu button of the talk that last changed place, which takes focus from its old element.
  const landing = useRef<HTMLButtonElement | null>(null);
  const [landed, setLanded] = useState<string | null>(null);

  // A drag, a menu item and the dialog all move a talk here.
  const move: Move = (id, to, verdict) => {
    const talk = talks.find((each) => each.id === id)!;
    const at = to && { stage: to.lane, starts: fromUnits(AXIS, to.start, 'start')!, ends: fromUnits(AXIS, to.end, 'end')! };
    const said = `${talk.title} moved to ${at ? `${stageOf(at.stage).name}, ${during(at, locale)}` : 'unscheduled'}`;
    setLanded(id);
    setHistory((past) => [...past, { talks, said }]);
    setTalks((list) => list.map((each) => (each.id === id ? { ...each, at, length: to ? to.end - to.start : each.length } : each)));
    announce(`${said}${verdict ? `. ${verdict.reason}` : ''}`);
  };

  const undo = () => {
    const last = history.at(-1);
    if (!last) return;
    setHistory((past) => past.slice(0, -1));
    setTalks(last.talks);
    announce(`Undid: ${last.said}`);
  };

  const grid = useMemo(() => snapGrid(AXIS, ZOOM[zoom].step), [zoom]);
  const lanes = useLaneDrag({
    range: AXIS.range,
    grid,
    minSpan: SHORTEST,
    check: (id, to) => verdictFor(talks, id, to),
    onDrop: ({ id, to, verdict }) => move(id, to, verdict),
  });

  // The dialog hands focus back to the talk it edits, wherever that talk is once it closes.
  const edit = (id: string) => {
    setLanded(id);
    setShown((last) => ({ id, opened: (last?.opened ?? 0) + 1 }));
    setEditing(id);
  };

  // A zoom keeps the time at the board's start in view.
  const kept = useRef<number | null>(null);
  // In layout pixels, as scrollLeft is, so a scaled page doesn't skew it.
  const perMinute = () => (board.current?.querySelector<HTMLElement>('[data-todae-lane]')?.offsetWidth ?? 0) / AXIS.range.end;
  const zoomTo = (next: keyof typeof ZOOM) => {
    kept.current = board.current && perMinute() > 0 ? board.current.scrollLeft / perMinute() : null;
    setZoom(next);
  };
  useLayoutEffect(() => {
    if (kept.current === null || !board.current) return;
    board.current.scrollLeft = kept.current * perMinute();
    kept.current = null;
  }, [zoom]);

  const shared: Shared = { talks, lanes, move, edit, landing, landed, locale };
  const highlight = (talk: Talk): Highlight => (speaker === '' ? undefined : talk.speakers.includes(speaker) ? 'picked' : 'dimmed');
  const shownTalk = shown && talks.find((talk) => talk.id === shown.id);
  const queue = talks.filter((talk) => talk.at === null);

  return (
    <div className={styles.schedule} style={{ ['--minute' as string]: ZOOM[zoom].minute, ['--units' as string]: AXIS.range.end }}>
      <div className={styles.controls}>
        <div className={styles.jump} role="group" aria-label="Go to day">
          {DAYS.map((day, index) => (
            <Button.Root key={index} variant="secondary" onClick={() => days.current[index]?.scrollIntoView({ inline: 'start', block: 'nearest' })}>
              {dayLabel(day, locale)}
            </Button.Root>
          ))}
        </div>
        <ToggleGroup.Root aria-label="Zoom" value={zoom} onValueChange={(value: string | null) => value && zoomTo(value as keyof typeof ZOOM)}>
          <ToggleGroup.Item value="event">Whole event</ToggleGroup.Item>
          <ToggleGroup.Item value="day">One day</ToggleGroup.Item>
        </ToggleGroup.Root>
        <Field.Group className={styles.speaker}>
          <Label.Root htmlFor={ids.speaker}>Highlight speaker</Label.Root>
          <Field.Root id={ids.speaker} name="speaker">
            <Field.Select value={speaker} onChange={(event) => setSpeaker(event.target.value)}>
              <option value="">Everyone</option>
              {SPEAKERS.map((name) => (
                <option key={name}>{name}</option>
              ))}
            </Field.Select>
          </Field.Root>
        </Field.Group>
        <Button.Root variant="ghost" aria-disabled={history.length === 0 || undefined} onClick={undo}>
          <Button.Icon>
            <Undo2 />
          </Button.Icon>
          Undo
        </Button.Root>
      </div>

      <div className={styles.workspace}>
        <ScrollArea.Root {...lanes.getBoardProps()} ref={board} axis="both" focusable aria-label="Schedule" className={styles.board}>
          {/* Every row is as wide as the whole axis, so a sticky stage name can stay in view to its end. */}
          <div className={styles.rows}>
            <div className={styles.row}>
              <div className={styles.corner} />
              <div className={styles.axis}>
                {AXIS.segments.map((segment, index) => (
                  <div
                    key={index}
                    ref={(node) => {
                      days.current[index] = node;
                    }}
                    className={styles.day}
                    style={{ insetInlineStart: `${(segment.start / AXIS.range.end) * 100}%`, inlineSize: `${((segment.end - segment.start) / AXIS.range.end) * 100}%` }}
                  >
                    <Text.Root variant="label">{dayLabel(segment.day, locale)}</Text.Root>
                    <span className={styles.bands}>
                      {BANDS.filter((band) => band.day === index)
                        .map((band) => `${band.label} ${formatTime(Temporal.PlainTime.from(band.from), { locale })}–${formatTime(Temporal.PlainTime.from(band.to), { locale })}`)
                        .join(' · ')}
                    </span>
                    <span className={styles.hours} aria-hidden>
                      {Array.from({ length: (segment.end - segment.start) / 60 }, (_, hour) => (
                        <span key={hour}>{clock(segment.opens.add({ hours: hour }), locale)}</span>
                      ))}
                    </span>
                  </div>
                ))}
              </div>
            </div>
            {STAGES.map((stage) => (
              <StageRow key={stage.id} stage={stage} shared={shared} highlight={highlight} />
            ))}
          </div>
        </ScrollArea.Root>

        <section aria-labelledby={ids.queue} className={styles.queueArea}>
          <Text.Root as="h3" id={ids.queue} variant="label">
            Unscheduled
          </Text.Root>
          <ul {...lanes.getQueueProps()} className={styles.queue} aria-labelledby={ids.queue}>
            {queue.map((talk) => (
              <QueueCard key={talk.id} talk={talk} highlight={highlight(talk)} {...shared} />
            ))}
            {queue.length === 0 ? <li className={styles.empty}>Every talk is scheduled</li> : null}
          </ul>
        </section>
      </div>

      <Dialog.Root open={editing !== null} onOpenChange={(open) => !open && setEditing(null)} restoreFocusRef={landing}>
        {shownTalk ? (
          <PlaceForm
            key={shown.opened}
            talk={shownTalk}
            talks={talks}
            locale={locale}
            onSave={(to, verdict) => {
              move(shownTalk.id, to, verdict);
              setEditing(null);
            }}
          />
        ) : null}
      </Dialog.Root>
    </div>
  );
}

function StageRow({ stage, shared, highlight }: { stage: Stage; shared: Shared; highlight: (talk: Talk) => Highlight }) {
  const nameId = useId();
  const talks = shared.talks.filter((talk) => talk.at?.stage === stage.id).sort((a, b) => a.at!.starts.epochMilliseconds - b.at!.starts.epochMilliseconds);
  const closed = CLOSED.filter((window) => window.keys === 'all' || window.keys.includes(`stage:${stage.id}`));
  return (
    <section className={styles.row} aria-labelledby={nameId}>
      <div className={styles.name}>
        <Text.Root as="h3" id={nameId} weight="medium" className={styles.stageName}>
          {stage.name}
        </Text.Root>
        <Text.Root tone="muted" className={styles.stageMeta}>
          {stage.seats} seats
          {stage.recorded ? (
            <>
              {' · '}
              <Video size="1em" aria-hidden /> Recorded
            </>
          ) : null}
          {stage.hours ? ` · Open ${stage.hours.map((time) => formatTime(Temporal.PlainTime.from(time), { locale: shared.locale })).join('–')}` : null}
        </Text.Root>
      </div>
      <div {...shared.lanes.getLaneProps(stage.id)} className={styles.lane}>
        {closed.map((window, index) => (
          <span
            key={index}
            aria-hidden
            className={styles.closed}
            data-band={window.keys === 'all' || undefined}
            style={{ insetInlineStart: `${(window.start / AXIS.range.end) * 100}%`, inlineSize: `${((window.end - window.start) / AXIS.range.end) * 100}%` }}
          />
        ))}
        <ol className={styles.talks} aria-labelledby={nameId}>
          {talks.map((talk) => (
            <Block key={talk.id} talk={talk} highlight={highlight(talk)} {...shared} />
          ))}
        </ol>
        <Preview drag={shared.lanes.drag} stage={stage.id} locale={shared.locale} />
      </div>
    </section>
  );
}
