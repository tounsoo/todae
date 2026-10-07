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
  /** Accessible name of each live example. */
  example: string;
  /** The playground's interface. */
  playground: Record<'appearance' | 'density' | 'rail' | 'title' | 'tokenLayer' | 'color' | 'reset' | 'export' | 'copied' | 'copyFailed' | 'stage' | 'buttons' | 'buttonHint' | 'defaultTone' | 'mutedTone' | 'accentTone', string>;
  /** Accessible names of scrollable code examples and tables, before the nearest heading. */
  regions: Record<'code' | 'table', string>;
  /** Token catalog headings. */
  tokensTable: Record<'path' | 'context' | 'cssVar' | 'value' | 'ref', string>;
  /** Props table headings. `{name}` in the caption is the component name. */
  propsTable: Record<'caption' | 'name' | 'type' | 'required' | 'default' | 'description' | 'yes' | 'no', string>;
  /** Section names; a missing one keeps its English name from `siteGroups.ts`. */
  groups: Partial<Record<GroupId, string>>;
  /** Link text by href; a missing one keeps its English text. Component, hook and pattern names (Button, useField, Combobox, Chip list) stay in English. */
  links: Partial<Record<Href, string>>;
};

const en: Dictionary = {
  siteDescription: 'Todae component docs',
  tagline: 'What you need to do today. Components, hooks, recipes, and tokens.',
  siteNav: 'Site',
  languageNav: 'Language',
  untranslated: 'This page is not translated yet, so it is shown in English.',
  contribute: 'Help translate it',
  example: 'Example',
  playground: {
    appearance: 'Appearance',
    density: 'Density',
    rail: 'Theme controls',
    title: 'Playground',
    tokenLayer: 'Token layer',
    color: 'color',
    reset: 'Reset all',
    export: 'Export',
    copied: 'Copied theme override JSON.',
    copyFailed: 'Could not copy. Clipboard permission was denied.',
    stage: 'Live demos',
    buttons: 'Buttons',
    buttonHint: 'Hover, press, and tab to a button to see hover / active / focus.',
    defaultTone: 'Default tone',
    mutedTone: 'Muted tone',
    accentTone: 'Accent tone',
  },
  regions: { code: 'Code example', table: 'Table' },
  tokensTable: { path: 'Path', context: 'Context', cssVar: 'CSS variable', value: 'Value', ref: 'Ref' },
  propsTable: {
    caption: '{name} props',
    name: 'Name',
    type: 'Type',
    required: 'Required',
    default: 'Default',
    description: 'Description',
    yes: 'yes',
    no: 'no',
  },
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
  example: '예시',
  playground: {
    appearance: '외관 (appearance)',
    density: '밀도 (density)',
    rail: '테마 컨트롤',
    title: '플레이그라운드',
    tokenLayer: '토큰 레이어',
    color: '색상',
    reset: '모두 초기화',
    export: '내보내기',
    copied: '테마 오버라이드 JSON을 복사했습니다.',
    copyFailed: '복사하지 못했습니다. 클립보드 권한이 거부되었습니다.',
    stage: '라이브 데모',
    buttons: '버튼',
    buttonHint: '버튼에 마우스를 올리거나, 누르거나, Tab으로 이동해 hover / active / focus 상태를 확인하세요.',
    defaultTone: '기본 톤',
    mutedTone: 'Muted 톤',
    accentTone: 'Accent 톤',
  },
  regions: { code: '코드 예시', table: '표' },
  tokensTable: { path: '경로', context: '컨텍스트', cssVar: 'CSS 변수', value: '값', ref: '참조' },
  propsTable: {
    caption: '{name} props',
    name: '이름',
    type: '타입',
    required: '필수',
    default: '기본값',
    description: '설명',
    yes: '예',
    no: '아니요',
  },
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
    '/recipes/chip-list': '오버플로를 처리하는 Chip list',
    '/composition': '조합',
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
