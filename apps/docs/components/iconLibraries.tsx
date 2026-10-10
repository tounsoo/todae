'use client';

// Three popular icon libraries, to show that Todae's glyphs and icon slots take
// any of them. Todae ships no icons; the docs site installs these for its demos.
import type { Glyphs } from '@omsoo/todae';
import {
  ArrowRight as PhArrowRight,
  CaretDown,
  CaretRight,
  Check as PhCheck,
  DotsThree,
  Envelope,
  GearSix,
  Info as PhInfo,
  MagnifyingGlass,
  Plus as PhPlus,
  Warning,
  X as PhX,
} from '@phosphor-icons/react';
import {
  IconAlertTriangle,
  IconArrowRight,
  IconCheck,
  IconChevronDown,
  IconChevronRight,
  IconDots,
  IconInfoCircle,
  IconMail,
  IconPlus,
  IconSearch,
  IconSettings,
  IconX,
} from '@tabler/icons-react';
import {
  ArrowRight,
  Check,
  ChevronDown,
  ChevronRight,
  Ellipsis,
  Info,
  Mail,
  Plus,
  Search,
  Settings,
  TriangleAlert,
  X,
} from 'lucide-react';
import type { ReactNode } from 'react';

export type IconLibraryId = 'lucide' | 'phosphor' | 'tabler';

/** The icons a demo uses beside the glyphs. */
type Icons = Record<'plus' | 'arrowRight' | 'settings' | 'search' | 'mail' | 'info' | 'warning', ReactNode>;

export type IconLibrary = {
  id: IconLibraryId;
  /** The library's own name, the same in every language. */
  name: string;
  /** Its npm package, for the import line a demo shows. */
  pkg: string;
  glyphs: Required<Glyphs>;
  icons: Icons;
};

export const ICON_LIBRARIES: readonly IconLibrary[] = [
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
    },
    icons: {
      plus: <Plus />,
      arrowRight: <ArrowRight />,
      settings: <Settings />,
      search: <Search />,
      mail: <Mail />,
      info: <Info />,
      warning: <TriangleAlert />,
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
    },
    icons: {
      plus: <PhPlus />,
      arrowRight: <PhArrowRight />,
      settings: <GearSix />,
      search: <MagnifyingGlass />,
      mail: <Envelope />,
      info: <PhInfo />,
      warning: <Warning />,
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
    },
    icons: {
      plus: <IconPlus />,
      arrowRight: <IconArrowRight />,
      settings: <IconSettings />,
      search: <IconSearch />,
      mail: <IconMail />,
      info: <IconInfoCircle />,
      warning: <IconAlertTriangle />,
    },
  },
];
