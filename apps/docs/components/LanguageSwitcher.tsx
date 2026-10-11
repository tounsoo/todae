'use client';

import { Link } from '@omsoo/todae/link';
import { Stack } from '@omsoo/todae/stack';
import { usePathname } from 'next/navigation';
import { useSyncExternalStore } from 'react';
import { LOCALE_NAMES, LOCALES, localizePath, type Locale } from '../lib/i18n/config';
import { DICTIONARIES } from '../lib/i18n/dictionaries';
import { SiteLink } from './SiteLink';

// The Navigation API, which TypeScript's DOM types leave out. Its currententrychange fires for every URL
// change in the tab: a hash link, back and forward, and the history.pushState of a client-side navigation.
declare global {
  interface Window {
    navigation?: EventTarget;
  }
}

// Next changes the URL in an insertion effect, where React allows no updates, so the read waits a microtask.
function subscribe(onChange: () => void) {
  const later = () => queueMicrotask(onChange);
  window.navigation?.addEventListener('currententrychange', later);
  return () => window.navigation?.removeEventListener('currententrychange', later);
}

// usePathname has no query or hash. Read them so every way of following the link keeps the reader's place.
const getSuffix = () => window.location.search + window.location.hash;
const getServerSuffix = () => '';

/** Links to the current page in each language, or to each home page with `toHome`. Each name is written in its own language. */
export function LanguageSwitcher({ locale, toHome = false }: { locale: Locale; toHome?: boolean }) {
  // Null outside the app router, such as in a component test.
  const path = usePathname() ?? '/';
  const suffix = useSyncExternalStore(subscribe, getSuffix, getServerSuffix);
  return (
    <nav className="language-switcher" aria-label={DICTIONARIES[locale].languageNav}>
      <Stack.Root as="ul" direction="row" gap="condensed">
        {LOCALES.map((target) => {
          // Another language, or a 404's home page, has its own root layout, which Next always loads in full,
          // so next/link would only add a prefetch.
          const Anchor = target === locale && !toHome ? SiteLink : Link.Root;
          return (
            <li key={target}>
              <Anchor
                href={localizePath(toHome ? '/' : path + suffix, target)}
                hrefLang={target}
                lang={target}
                aria-current={target === locale ? 'true' : undefined}
              >
                {LOCALE_NAMES[target]}
              </Anchor>
            </li>
          );
        })}
      </Stack.Root>
    </nav>
  );
}
