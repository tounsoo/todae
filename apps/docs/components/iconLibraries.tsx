'use client';

// Three popular icon libraries, to show that Todae's glyphs and icon slots take
// any of them. Todae ships no icons; the docs site installs these for its demos.
import type { Glyphs } from '@tounsoo/todae';
import {
  ArrowCounterClockwise,
  ArrowRight as PhArrowRight,
  ArrowUp as PhArrowUp,
  CalendarBlank,
  Clock as PhClock,
  Copy as PhCopy,
  CaretDown,
  CaretLeft,
  CaretRight,
  Check as PhCheck,
  DotsThree,
  Envelope,
  ExclamationMark,
  GearSix,
  Info as PhInfo,
  MagnifyingGlass,
  Plus as PhPlus,
  Stop as PhStop,
  ThumbsDown as PhThumbsDown,
  ThumbsUp as PhThumbsUp,
  Warning,
  X as PhX,
} from '@phosphor-icons/react';
import {
  IconAlertTriangle,
  IconArrowRight,
  IconArrowUp,
  IconCalendar,
  IconClock,
  IconCopy,
  IconCheck,
  IconChevronDown,
  IconChevronLeft,
  IconChevronRight,
  IconDots,
  IconExclamationMark,
  IconInfoCircle,
  IconMail,
  IconPlayerStopFilled,
  IconPlus,
  IconRefresh,
  IconSearch,
  IconSettings,
  IconThumbDown,
  IconThumbUp,
  IconX,
} from '@tabler/icons-react';
import {
  ArrowRight,
  ArrowUp,
  Calendar,
  Clock,
  Check,
  Copy,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Ellipsis,
  Info,
  Mail,
  Plus,
  RotateCcw,
  Search,
  Settings,
  Square,
  ThumbsDown,
  ThumbsUp,
  TriangleAlert,
  X,
} from 'lucide-react';
import type { ReactNode } from 'react';

export type IconLibraryId = 'lucide' | 'phosphor' | 'tabler';

/** The icons a demo uses beside the glyphs. */
type Icons = Record<
  'plus' | 'arrowRight' | 'settings' | 'search' | 'mail' | 'info' | 'warning' | 'copy' | 'regenerate' | 'thumbsUp' | 'thumbsDown',
  ReactNode
>;

export type IconLibrary = {
  id: IconLibraryId;
  /** The library's own name, the same in every language. */
  name: string;
  /** Its npm package, for the import line a demo shows. */
  pkg: string;
  glyphs: Required<Glyphs>;
  icons: Icons;
};

export const ICON_LIBRARIES: readonly [IconLibrary, ...IconLibrary[]] = [
  {
    id: 'lucide',
    name: 'Lucide',
    pkg: 'lucide-react',
    glyphs: {
      close: <X />,
      check: <Check />,
      chevron: <ChevronDown />,
      separator: <ChevronRight />,
      ellipsis: <Ellipsis />,
      calendar: <Calendar />,
      clock: <Clock />,
      send: <ArrowUp />,
      stop: <Square fill="currentColor" />,
      error: <X />,
      back: <ChevronLeft />,
    },
    icons: {
      plus: <Plus />,
      arrowRight: <ArrowRight />,
      settings: <Settings />,
      search: <Search />,
      mail: <Mail />,
      info: <Info />,
      warning: <TriangleAlert />,
      copy: <Copy />,
      regenerate: <RotateCcw />,
      thumbsUp: <ThumbsUp />,
      thumbsDown: <ThumbsDown />,
    },
  },
  {
    id: 'phosphor',
    name: 'Phosphor',
    pkg: '@phosphor-icons/react',
    glyphs: {
      close: <PhX />,
      check: <PhCheck weight="bold" />,
      chevron: <CaretDown />,
      separator: <CaretRight />,
      ellipsis: <DotsThree weight="bold" />,
      calendar: <CalendarBlank />,
      clock: <PhClock />,
      send: <PhArrowUp />,
      stop: <PhStop weight="fill" />,
      error: <ExclamationMark weight="bold" />,
      back: <CaretLeft />,
    },
    icons: {
      plus: <PhPlus />,
      arrowRight: <PhArrowRight />,
      settings: <GearSix />,
      search: <MagnifyingGlass />,
      mail: <Envelope />,
      info: <PhInfo />,
      warning: <Warning />,
      copy: <PhCopy />,
      regenerate: <ArrowCounterClockwise />,
      thumbsUp: <PhThumbsUp />,
      thumbsDown: <PhThumbsDown />,
    },
  },
  {
    id: 'tabler',
    name: 'Tabler',
    pkg: '@tabler/icons-react',
    glyphs: {
      close: <IconX />,
      check: <IconCheck />,
      chevron: <IconChevronDown />,
      separator: <IconChevronRight />,
      ellipsis: <IconDots />,
      calendar: <IconCalendar />,
      clock: <IconClock />,
      send: <IconArrowUp />,
      stop: <IconPlayerStopFilled />,
      error: <IconExclamationMark />,
      back: <IconChevronLeft />,
    },
    icons: {
      plus: <IconPlus />,
      arrowRight: <IconArrowRight />,
      settings: <IconSettings />,
      search: <IconSearch />,
      mail: <IconMail />,
      info: <IconInfoCircle />,
      warning: <IconAlertTriangle />,
      copy: <IconCopy />,
      regenerate: <IconRefresh />,
      thumbsUp: <IconThumbUp />,
      thumbsDown: <IconThumbDown />,
    },
  },
];
