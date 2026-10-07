import { SITE_GROUPS } from '../../components/siteGroups';
import { localizePath, type Locale } from './config';

type GroupId = (typeof SITE_GROUPS)[number]['id'];
type Href = (typeof SITE_GROUPS)[number]['links'][number][0];

/** The site's own words: everything around the page content. Page text lives in each page's MDX. */
export type Dictionary = {
  siteDescription: string;
  tagline: string;
  /** Accessible name of the sidebar. */
  siteNav: string;
  /** Accessible name of the language switcher. */
  languageNav: string;
  /** Shown above a page that has no translation yet. */
  untranslated: string;
  contribute: string;
  /** The 404 page, which shows every language. */
  notFound: string;
  home: string;
  /** Section names; a missing one keeps its English name from `siteGroups.ts`. */
  groups: Partial<Record<GroupId, string>>;
  /** Link text by href; a missing one keeps its English text. Component and hook names stay as they are in code. */
  links: Partial<Record<Href, string>>;
};

const en: Dictionary = {
  siteDescription: 'Todae component docs',
  tagline: 'What you need to do today. Components, hooks, recipes, and tokens.',
  siteNav: 'Site',
  languageNav: 'Language',
  untranslated: 'This page is not translated yet, so it is shown in English.',
  contribute: 'Help translate it',
  notFound: 'Page not found.',
  home: 'Todae home',
  groups: {},
  links: {},
};

const ko: Dictionary = {
  siteDescription: 'Todae 컴포넌트 문서',
  tagline: '오늘 할 일에 필요한 것. 컴포넌트, 훅, 레시피, 토큰.',
  siteNav: '사이트',
  languageNav: '언어',
  untranslated: '이 페이지는 아직 한국어로 번역되지 않아 영어 원문으로 보여 드립니다.',
  contribute: '번역에 참여하기',
  notFound: '페이지를 찾을 수 없습니다.',
  home: 'Todae 홈',
  groups: {
    components: '컴포넌트',
    utilities: '유틸리티',
    recipes: '레시피',
    foundations: '기초',
    tools: '도구',
  },
  links: {
    '/recipes/chip-list': '오버플로를 처리하는 칩 목록',
    '/recipes/combobox': '콤보박스',
    '/composition': '컴포지션',
    '/tokens': '토큰',
    '/guides/build-on-todae': 'Todae로 디자인 시스템 만들기',
    '/platform': '네이티브 플랫폼',
    '/playground': '플레이그라운드',
  },
};

export const DICTIONARIES: Record<Locale, Dictionary> = { en, ko };

/** SITE_GROUPS with section names, link text and hrefs in `locale`. */
export function localizedGroups(locale: Locale) {
  const dict = DICTIONARIES[locale];
  return SITE_GROUPS.map((group) => ({
    id: group.id,
    label: dict.groups[group.id] ?? group.label,
    links: group.links.map(([href, label]) => [localizePath(href, locale), dict.links[href] ?? label] as const),
  }));
}
