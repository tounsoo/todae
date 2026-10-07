import type { ComponentType } from 'react';

/**
 * Every English page except the home page, by slug. A locale serves one of
 * these, under an "untranslated" notice, until it has its own page. Add a
 * line here when you add a docs page; a test fails until you do.
 */
export const ENGLISH_PAGES: Record<string, () => Promise<{ default: ComponentType }>> = {
  'alert': () => import('../../app/(en)/alert/page.mdx'),
  'bottomsheet': () => import('../../app/(en)/bottomsheet/page.mdx'),
  'button': () => import('../../app/(en)/button/page.mdx'),
  'checkbox': () => import('../../app/(en)/checkbox/page.mdx'),
  'chip': () => import('../../app/(en)/chip/page.mdx'),
  'composition': () => import('../../app/(en)/composition/page.mdx'),
  'description': () => import('../../app/(en)/description/page.mdx'),
  'dialog': () => import('../../app/(en)/dialog/page.mdx'),
  'disclosure': () => import('../../app/(en)/disclosure/page.mdx'),
  'errormessage': () => import('../../app/(en)/errormessage/page.mdx'),
  'field': () => import('../../app/(en)/field/page.mdx'),
  'fieldset': () => import('../../app/(en)/fieldset/page.mdx'),
  'guides/build-on-todae': () => import('../../app/(en)/guides/build-on-todae/page.mdx'),
  'label': () => import('../../app/(en)/label/page.mdx'),
  'link': () => import('../../app/(en)/link/page.mdx'),
  'menu': () => import('../../app/(en)/menu/page.mdx'),
  'optionlist': () => import('../../app/(en)/optionlist/page.mdx'),
  'platform': () => import('../../app/(en)/platform/page.mdx'),
  'playground': () => import('../../app/(en)/playground/page'),
  'popover': () => import('../../app/(en)/popover/page.mdx'),
  'radio': () => import('../../app/(en)/radio/page.mdx'),
  'recipes/chip-list': () => import('../../app/(en)/recipes/chip-list/page.mdx'),
  'recipes/combobox': () => import('../../app/(en)/recipes/combobox/page.mdx'),
  'stack': () => import('../../app/(en)/stack/page.mdx'),
  'switch': () => import('../../app/(en)/switch/page.mdx'),
  'tabs': () => import('../../app/(en)/tabs/page.mdx'),
  'text': () => import('../../app/(en)/text/page.mdx'),
  'tokens': () => import('../../app/(en)/tokens/page.mdx'),
  'tooltip': () => import('../../app/(en)/tooltip/page.mdx'),
  'utilities/use-chip-field': () => import('../../app/(en)/utilities/use-chip-field/page.mdx'),
  'utilities/use-chip-list': () => import('../../app/(en)/utilities/use-chip-list/page.mdx'),
  'utilities/use-combobox': () => import('../../app/(en)/utilities/use-combobox/page.mdx'),
  'utilities/use-field': () => import('../../app/(en)/utilities/use-field/page.mdx'),
  'utilities/use-popover': () => import('../../app/(en)/utilities/use-popover/page.mdx'),
  'utilities/use-roving-focus': () => import('../../app/(en)/utilities/use-roving-focus/page.mdx'),
  'utilities/use-sheet-presentation': () => import('../../app/(en)/utilities/use-sheet-presentation/page.mdx'),
  'utilities/use-tooltip': () => import('../../app/(en)/utilities/use-tooltip/page.mdx'),
  'visually-hidden': () => import('../../app/(en)/visually-hidden/page.mdx'),
};
