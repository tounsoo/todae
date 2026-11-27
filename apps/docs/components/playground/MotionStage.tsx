'use client';

import {
  Button,
  Card,
  Code,
  Dialog,
  OptionList,
  Popover,
  Skeleton,
  Steps,
  Switch,
  Table,
  Tabs,
  Text,
  ThemeProvider,
  Tooltip,
  usePopover,
  useTooltip,
  type ThemeOverride,
  type Toaster,
} from '@tounsoo/todae';
import { useEffect, useId, useRef, useState, useSyncExternalStore, type ReactNode } from 'react';
import type { Dictionary } from '../../lib/i18n/dictionaries';
import { motionReadout, optInMotion, replayCues, slowMotion, type Cue, type ReadoutRow, type Surface, type Timing } from './replay';

const SLOW = 4;
const TOAST_ID = 'motion-replay';
const REDUCE = '(prefers-reduced-motion: reduce)';

function subscribeReduce(onChange: () => void) {
  const query = window.matchMedia(REDUCE);
  query.addEventListener('change', onChange);
  return () => query.removeEventListener('change', onChange);
}

/** Todae's part names, which stay in English like the presets'. */
const PART_NAMES: Record<Surface, string> = {
  popover: 'Popover',
  tooltip: 'Tooltip',
  dialog: 'Dialog',
  toast: 'Toast',
  tabs: 'Tabs panel',
  steps: 'Steps',
  option: 'OptionList check',
  menu: 'Menu check',
};

function TimingCell({ timing, off }: { timing: Timing; off: string }) {
  return (
    <>
      <Code.Root>{`${timing.duration}ms`}</Code.Root>
      {timing.duration === 0 ? ` (${off})` : <span className="pg-motion-curve"> {timing.easing}</span>}
    </>
  );
}

/**
 * The Playground stage's motion replay, above whatever it wraps. Play motion
 * runs once through the surfaces that appear and go under `overrides`, the
 * stage's theme with its Motion feel. Slow motion and the opt-in motions are
 * laid over the wrapped preview too, so a surface opened by hand shows them,
 * but never reach the exported JSON.
 */
export function MotionStage({
  overrides,
  toaster,
  copy,
  children,
}: {
  overrides: ThemeOverride;
  toaster: Pick<Toaster, 'add' | 'dismiss'>;
  copy: Dictionary['motionLab'];
  children?: ReactNode;
}) {
  const [slow, setSlow] = useState(false);
  const [optIn, setOptIn] = useState(false);
  const reduced = useSyncExternalStore(subscribeReduce, () => window.matchMedia(REDUCE).matches, () => false);

  const optInLayer = optIn ? optInMotion(overrides) : {};
  const listed = { ...overrides, ...optInLayer };
  const layer: ThemeOverride = { ...optInLayer, ...slowMotion(listed, slow ? SLOW : 1) };
  const rows = motionReadout(listed);
  const played = motionReadout({ ...overrides, ...layer });

  const ids = { title: useId(), lead: useId() };
  const playRef = useRef<HTMLButtonElement>(null);
  const timers = useRef<number[]>([]);
  const [running, setRunning] = useState(false);
  const [popoverOpen, setPopoverOpen] = useState(false);
  const [tipOpen, setTipOpen] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [tab, setTab] = useState(0);
  // How many steps are done. None is current, whose spinner would loop on its own.
  const [step, setStep] = useState(1);
  const [option, setOption] = useState(0);

  // While the replay runs, the popover leaves focus on Play motion.
  const popover = usePopover({
    open: popoverOpen,
    onOpenChange: setPopoverOpen,
    initialFocusRef: running ? playRef : undefined,
  });
  const tip = useTooltip({ open: tipOpen, onOpenChange: setTipOpen });

  const tabs = copy.tabLabels.split(',');
  const steps = copy.stepLabels.split(',');
  const options = copy.optionLabels.split(',');

  function clearTimers() {
    for (const timer of timers.current) window.clearTimeout(timer);
    timers.current = [];
  }
  useEffect(() => clearTimers, []);

  function apply(cue: Cue) {
    switch (cue) {
      case 'open':
        setPopoverOpen(true);
        setTipOpen(true);
        setLoading(true);
        setTab((at) => (at + 1) % tabs.length);
        setStep((done) => (done + 1) % (steps.length + 1));
        setOption((at) => (at + 1) % options.length);
        return;
      case 'close':
        setPopoverOpen(false);
        setTipOpen(false);
        setLoading(false);
        return;
      case 'dialog-open':
        setDialogOpen(true);
        return;
      case 'dialog-close':
        setDialogOpen(false);
        return;
      case 'toast-show':
        toaster.add({ id: TOAST_ID, title: copy.toast, duration: Infinity });
        return;
      case 'toast-dismiss':
        toaster.dismiss(TOAST_ID);
        return;
      case 'done':
        setRunning(false);
    }
  }

  function stop() {
    clearTimers();
    apply('close');
    setDialogOpen(false);
    toaster.dismiss(TOAST_ID);
    setRunning(false);
  }

  function play() {
    clearTimers();
    setRunning(true);
    timers.current = replayCues(played, slow ? SLOW : 1).map(({ at, cue }) => window.setTimeout(() => apply(cue), at));
  }

  return (
    <ThemeProvider overrides={layer} className="pg-stage-motion">
      <Card.Root className="pg-motion" role="region" aria-labelledby={ids.title}>
        <Card.Header>
          <div className="pg-motion-head">
            <div>
              <Text.Root as="h2" id={ids.title}>
                {copy.title}
              </Text.Root>
              <Text.Root tone="muted" id={ids.lead}>
                {copy.lead}
              </Text.Root>
            </div>
            <div className="pg-motion-controls">
              <Button.Root ref={playRef} aria-describedby={ids.lead} onClick={running ? stop : play}>
                {running ? copy.stop : copy.play}
              </Button.Root>
              <Switch.Root checked={slow} onCheckedChange={setSlow}>
                {copy.slow}
              </Switch.Root>
              <Switch.Root checked={optIn} onCheckedChange={setOptIn}>
                {copy.optIn}
              </Switch.Root>
            </div>
          </div>
        </Card.Header>
        <Card.Body>
          <div className="pg-motion-body">
            {reduced ? (
              <p className="pg-motion-note" data-reduced="">
                {copy.reduced}
              </p>
            ) : null}
            <div className="pg-motion-specimens">
              <Button.Root variant="secondary" {...popover.getTriggerProps()}>
                Popover
              </Button.Root>
              <Popover.Root {...popover.getPopoverProps()} role="dialog" aria-label="Popover">
                <Text.Root>{copy.popoverBody}</Text.Root>
              </Popover.Root>
              <Button.Root variant="secondary" tooltip={false} {...tip.getTriggerProps()} lang="en">
                {copy.tooltip}
              </Button.Root>
              <Tooltip.Root {...tip.getTooltipProps()}>{copy.tip}</Tooltip.Root>
              <Tabs.Root value={String(tab)} onValueChange={(next) => setTab(Number(next))}>
                <Tabs.List aria-label={copy.tabs}>
                  {tabs.map((label, at) => (
                    <Tabs.Tab key={label} value={String(at)}>
                      {label}
                    </Tabs.Tab>
                  ))}
                </Tabs.List>
                {tabs.map((label, at) => (
                  <Tabs.Panel key={label} value={String(at)} className="pg-motion-panel">
                    {label}
                  </Tabs.Panel>
                ))}
              </Tabs.Root>
              <Steps.Root aria-label={copy.steps}>
                {steps.map((label, at) => (
                  <Steps.Item key={label} status={at < step ? 'done' : 'pending'}>
                    {label}
                  </Steps.Item>
                ))}
              </Steps.Root>
              <OptionList.Root value={String(option)} onValueChange={(next) => next !== null && setOption(Number(next))} aria-label={copy.options}>
                {options.map((label, at) => (
                  <OptionList.Option key={label} value={String(at)}>
                    {label}
                  </OptionList.Option>
                ))}
              </OptionList.Root>
              {/* Only while the replay shows it, so nothing loops on its own. */}
              <div className="pg-motion-skeleton">{loading ? <Skeleton.Root variant={optIn ? 'shimmer' : 'pulse'} /> : null}</div>
            </div>
            <Table.Root className="pg-motion-table">
              <Table.Caption>{copy.readout}</Table.Caption>
              <Table.Head>
                <Table.Row>
                  <Table.HeaderCell scope="col">{copy.part}</Table.HeaderCell>
                  <Table.HeaderCell scope="col">{copy.enter}</Table.HeaderCell>
                  <Table.HeaderCell scope="col">{copy.exit}</Table.HeaderCell>
                </Table.Row>
              </Table.Head>
              <Table.Body>
                {rows.map((row: ReadoutRow) => (
                  <Table.Row key={row.surface} data-surface={row.surface}>
                    <Table.Cell lang="en">{PART_NAMES[row.surface]}</Table.Cell>
                    <Table.Cell data-phase="enter">
                      <TimingCell timing={row.enter} off={copy.off} />
                    </Table.Cell>
                    <Table.Cell data-phase="exit">{row.exit ? <TimingCell timing={row.exit} off={copy.off} /> : copy.none}</Table.Cell>
                  </Table.Row>
                ))}
              </Table.Body>
            </Table.Root>
            <Text.Root tone="muted" className="pg-motion-hints">
              {[slow ? copy.slowNote : null, optIn ? copy.optInHint : null, copy.focusNote, copy.menuHint].filter(Boolean).join(' ')}
            </Text.Root>
          </div>
        </Card.Body>
      </Card.Root>
      <Dialog.Root open={dialogOpen} onOpenChange={(open) => (open ? undefined : stop())}>
        <Dialog.Header>
          <Dialog.Title>{copy.dialogTitle}</Dialog.Title>
          <Dialog.Close />
        </Dialog.Header>
        <Dialog.Description>{copy.dialogBody}</Dialog.Description>
      </Dialog.Root>
      {children}
    </ThemeProvider>
  );
}
