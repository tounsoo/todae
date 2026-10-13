'use client';

import { Button, ToggleGroup, type Appearance } from '@omsoo.design/todae';
import type { Locale } from '../lib/i18n/config';
import { DICTIONARIES } from '../lib/i18n/dictionaries';
import { MonitorIcon, MoonIcon, SunIcon } from './icons';
import { useAppearanceChoice } from './Providers';

const CHOICES = [
  ['system', MonitorIcon],
  ['light', SunIcon],
  ['dark', MoonIcon],
] as const;

/** System, light or dark for the whole site. */
export function ThemeSwitcher({ locale }: { locale: Locale }) {
  const words = DICTIONARIES[locale].theme;
  const { appearance, setAppearance } = useAppearanceChoice();
  return (
    <ToggleGroup.Root
      className="theme-switcher"
      aria-label={words.label}
      value={appearance}
      // Pressing the pressed item clears a single group; the site always has a choice.
      onValueChange={(next) => {
        if (next) setAppearance(next as Appearance);
      }}
    >
      {CHOICES.map(([value, Icon]) => (
        <ToggleGroup.Item key={value} value={value} variant="ghost" aria-label={words[value]}>
          <Button.Icon>
            <Icon />
          </Button.Icon>
        </ToggleGroup.Item>
      ))}
    </ToggleGroup.Root>
  );
}
