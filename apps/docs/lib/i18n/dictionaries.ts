import { childLinks, flatLinks, HOME_FEATURED, INDEX_GROUPS, SITE_GROUPS, type IndexGroupId, type SiteHref } from '../../components/siteGroups';
import { localizePath, type Locale } from './config';

type GroupId = (typeof SITE_GROUPS)[number]['id'];

/** The site's own words: everything around the page content. Page text lives in each page's MDX. */
export type Dictionary = {
  /** Accessible name of the sidebar. */
  siteNav: string;
  /** Name of the sidebar toggle that shows or hides a page's child pages. `{name}` is the page's link text. */
  subpages: string;
  /** Accessible name of the top bar's links. */
  mainNav: string;
  /** The top bar's links. */
  topLinks: Record<'start' | 'components' | 'playground', string>;
  /** First link on every page, shown on focus. */
  skipToContent: string;
  /** Title and accessible name of a page's list of its own sections. */
  onThisPage: string;
  /** The button that opens the sidebar on narrow screens, and the drawer's close button. */
  openMenu: string;
  closeMenu: string;
  /** The light and dark switch in the top bar. */
  theme: Record<'label' | 'system' | 'light' | 'dark', string>;
  /** Accessible name of the GitHub link. */
  github: string;
  /** The footer's license line; `{license}` is where the link to the license goes, and `licenseName` is its text. */
  license: string;
  licenseName: string;
  /** The footer's release line; `{version}` is the package version, `{changelog}` is where the link to the changelog goes, and `changelog` is its text. */
  release: string;
  changelog: string;
  /** The home page's opening section. */
  hero: Record<'eyebrow' | 'title' | 'lead' | 'start' | 'playground' | 'showcase', string>;
  /** One line under each section on the home page. */
  groupBlurbs: Record<GroupId, string>;
  /** Pages in a section; `{count}` is the number. */
  groupCount: string;
  groupCountOne: string;
  /** The home page's link to a section's catalog; `{count}` is the number of pages the catalog lists. */
  seeAll: string;
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
  playground: Record<
    | 'appearance'
    | 'density'
    | 'icons'
    | 'rail'
    | 'title'
    | 'lead'
    | 'presets'
    | 'tokens'
    | 'editTheme'
    | 'closeSheet'
    | 'resizeSheet'
    | 'tokenLayer'
    | 'filter'
    | 'noMatch'
    | 'changed'
    | 'color'
    | 'reset'
    | 'export'
    | 'exportHint'
    | 'copied'
    | 'copyFailed'
    | 'stage',
    string
  >;
  /** Accessible names of scrollable code examples and tables, before the nearest heading. */
  regions: Record<'code' | 'table', string>;
  /** Token catalog headings. */
  tokensTable: Record<'path' | 'context' | 'cssVar' | 'value' | 'ref', string>;
  /** Props table caption and column headings; `required` labels a badge on the name and `default` labels a line under the description. `{name}` in the caption is the component name. */
  propsTable: Record<'caption' | 'name' | 'type' | 'required' | 'default' | 'description', string>;
  /** Section names; a missing one keeps its English name from `siteGroups.ts`. */
  groups: Partial<Record<GroupId, string>>;
  /** Link text by href; a missing one keeps its English text. Component, hook and pattern names (Button, useField, Combobox, ChipList) stay in English. */
  links: Partial<Record<SiteHref, string>>;
};

const en: Dictionary = {
  siteNav: 'Site',
  subpages: '{name} pages',
  mainNav: 'Main',
  topLinks: { start: 'Get started', components: 'Components', playground: 'Playground' },
  skipToContent: 'Skip to content',
  onThisPage: 'On this page',
  openMenu: 'Open navigation',
  closeMenu: 'Close',
  theme: { label: 'Theme', system: 'System', light: 'Light', dark: 'Dark' },
  github: 'Todae on GitHub',
  license: 'Todae is released under the {license}.',
  licenseName: 'MIT License',
  release: 'Version {version} · {changelog}',
  changelog: 'Changelog',
  hero: {
    eyebrow: 'Todae (토대) means foundation',
    title: 'The foundation your design system builds on.',
    lead: 'Todae gives you accessible components, headless hooks and DTCG tokens built on native HTML. Rename, restyle and extend them into your own system without forking.',
    start: 'Get started',
    playground: 'Open the playground',
    showcase: 'Todae components, live',
  },
  groupBlurbs: {
    foundations: 'How Todae is put together, its tokens, and how to build on it.',
    components: 'Accessible parts with one root each, styled from tokens.',
    utilities: 'The behavior under the components, for your own markup.',
    recipes: 'Copyable glue for flows that depend on your product data.',
    tools: 'Try a theme on live components before you write one.',
  },
  groupCount: '{count} pages',
  groupCountOne: '1 page',
  seeAll: 'See all {count}',
  languageNav: 'Language',
  untranslated: 'This page is not translated yet, so it is shown in English.',
  contribute: 'Help translate it',
  example: 'Example',
  playground: {
    appearance: 'Appearance',
    density: 'Density',
    icons: 'Icons',
    rail: 'Theme controls',
    title: 'Playground',
    lead: 'Start from a preset, change any token, and copy the result as ThemeProvider overrides.',
    presets: 'Presets',
    tokens: 'Tokens',
    editTheme: 'Edit theme',
    closeSheet: 'Close theme controls',
    resizeSheet: 'Resize theme controls',
    tokenLayer: 'Token layer',
    filter: 'Filter tokens',
    noMatch: 'No token matches.',
    changed: '{count} changed',
    color: 'color',
    reset: 'Reset',
    export: 'Copy JSON',
    exportHint: 'Edits apply to the appearance you make them in. When light and dark differ, the JSON holds both; pass the one that matches the appearance.',
    copied: 'Copied theme override JSON.',
    copyFailed: 'Could not copy. Clipboard permission was denied.',
    stage: 'Preview',
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
  },
  notFound: 'Page not found.',
  home: 'Todae home',
  groups: {},
  links: {},
};

const ko: Dictionary = {
  siteNav: '사이트',
  subpages: '{name} 하위 페이지',
  mainNav: '주요 메뉴',
  topLinks: { start: '시작하기', components: '컴포넌트', playground: '플레이그라운드' },
  skipToContent: '본문으로 건너뛰기',
  onThisPage: '이 페이지의 내용',
  openMenu: '탐색 메뉴 열기',
  closeMenu: '닫기',
  theme: { label: '테마', system: '시스템', light: '라이트', dark: '다크' },
  github: 'GitHub의 Todae',
  license: 'Todae는 {license}로 배포됩니다.',
  licenseName: 'MIT 라이선스',
  release: '버전 {version} · {changelog}',
  changelog: '변경 내역',
  hero: {
    eyebrow: '디자인 시스템의 토대',
    title: '회사의 디자인 시스템을 그 위에 세우세요.',
    lead: 'Todae는 네이티브 HTML 위에 만든 접근성 있는 컴포넌트, 헤드리스 훅, DTCG 토큰을 제공합니다. 포크하지 않고도 이름을 바꾸고, 스타일을 입히고, 확장해 자신만의 시스템으로 만들 수 있습니다.',
    start: '시작하기',
    playground: '플레이그라운드 열기',
    showcase: '실제로 동작하는 Todae 컴포넌트',
  },
  groupBlurbs: {
    foundations: 'Todae의 구조와 토큰, 그리고 그 위에 시스템을 만드는 방법.',
    components: '토큰으로 스타일을 입힌, 루트가 하나인 접근성 있는 부품.',
    utilities: '컴포넌트 아래의 동작을 직접 만든 마크업에 쓰는 훅.',
    recipes: '제품 데이터에 따라 달라지는 흐름을 위한 복사용 코드.',
    tools: '코드를 쓰기 전에 실제 컴포넌트에 테마를 입혀 보세요.',
  },
  groupCount: '{count}개 페이지',
  groupCountOne: '1개 페이지',
  seeAll: '전체 {count}개 보기',
  languageNav: '언어',
  untranslated: '이 페이지는 아직 한국어로 번역되지 않아 영어 원문으로 보여 드립니다.',
  contribute: '번역에 참여하기',
  example: '예시',
  playground: {
    appearance: '외관 (appearance)',
    density: '밀도 (density)',
    icons: '아이콘',
    rail: '테마 컨트롤',
    title: '플레이그라운드',
    lead: '프리셋에서 시작해 원하는 토큰을 바꾸고, 결과를 ThemeProvider 오버라이드로 복사하세요.',
    presets: '프리셋',
    tokens: '토큰',
    editTheme: '테마 편집',
    closeSheet: '테마 컨트롤 닫기',
    resizeSheet: '테마 컨트롤 크기 조절',
    tokenLayer: '토큰 레이어',
    filter: '토큰 필터',
    noMatch: '일치하는 토큰이 없습니다.',
    changed: '{count}개 변경됨',
    color: '색상',
    reset: '초기화',
    export: 'JSON 복사',
    exportHint: '수정은 그때의 외관(라이트 또는 다크)에만 적용됩니다. 라이트와 다크가 다르면 JSON에 둘 다 담기니, 현재 외관에 맞는 쪽을 전달하세요.',
    copied: '테마 오버라이드 JSON을 복사했습니다.',
    copyFailed: '복사하지 못했습니다. 클립보드 권한이 거부되었습니다.',
    stage: '미리보기',
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
    '/composition': '조합',
    '/tokens': '토큰',
    '/guides/get-started': '시작하기',
    '/guides/build-on-todae': 'Todae로 디자인 시스템 만들기',
    '/guides/css-layers': 'CSS 레이어',
    '/platform': '네이티브 플랫폼',
    '/mcp': 'MCP 서버',
    '/playground': '플레이그라운드',
  },
};

export const DICTIONARIES: Record<Locale, Dictionary> = { en, ko };

/** SITE_GROUPS with section names, link text and hrefs in `locale`. Each link's third element is its child pages, localized the same way. */
export function localizedGroups(locale: Locale) {
  const dict = DICTIONARIES[locale];
  const localize = ([href, label]: readonly [SiteHref, string, ...unknown[]]) => [localizePath(href, locale), dict.links[href] ?? label] as const;
  return SITE_GROUPS.map((group) => ({
    id: group.id,
    label: dict.groups[group.id] ?? group.label,
    links: group.links.map((link) => [...localize(link), childLinks(link).map(localize)] as const),
  }));
}

export function catalog(locale: Locale, id: IndexGroupId) {
  const group = localizedGroups(locale).find((item) => item.id === id);
  if (!group) throw new Error(`SITE_GROUPS has no ${id} group`);
  return { title: group.label, description: DICTIONARIES[locale].groupBlurbs[id], links: group.links };
}

function isIndexGroup(id: string): id is IndexGroupId {
  return INDEX_GROUPS.some((indexId) => indexId === id);
}

/** One card per section for the home page. A catalog section shows its featured items and a link to the catalog; any other shows its parent links. */
export function homeGroups(locale: Locale) {
  const dict = DICTIONARIES[locale];
  return SITE_GROUPS.map((group) => {
    const count: number = group.links.length;
    const card = {
      id: group.id,
      label: dict.groups[group.id] ?? group.label,
      blurb: dict.groupBlurbs[group.id],
      countLabel: count === 1 ? dict.groupCountOne : dict.groupCount.replace('{count}', String(count)),
    };
    if (!isIndexGroup(group.id)) {
      const links = group.links.map(([href, label]): [string, string] => [localizePath(href, locale), dict.links[href] ?? label]);
      return { ...card, links, seeAll: null };
    }
    const english = new Map<string, string>(flatLinks(group.links));
    const links = HOME_FEATURED[group.id].map((href): [string, string] => {
      const label = dict.links[href] ?? english.get(href);
      if (label === undefined) throw new Error(`${href} is featured on the home page but has no link text`);
      return [localizePath(href, locale), label];
    });
    const seeAll: [string, string] = [localizePath(`/${group.id}`, locale), dict.seeAll.replace('{count}', String(count))];
    return { ...card, links, seeAll };
  });
}
