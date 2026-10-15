import type { Strings } from '@omsoo.design/todae';
import type { Locale } from './config';

/** Todae's own text in Korean, for the parts of the site that render in the reader's language, such as the playground's preview. */
const KOREAN: Strings = {
  close: '닫기',
  dismiss: '닫기',
  notifications: '알림',
  breadcrumbs: '이동 경로',
  pagination: '페이지',
  resizeSheet: '시트 크기 조절',
  options: '옵션',
  removeChip: (label) => `${label} 삭제`,
  removeAttachment: (name) => (name ? `${name} 삭제` : '삭제'),
  moreChips: (count) => `${count}개 더 있음`,
  moreChipsPanel: (count) => `칩 ${count}개 더 보기`,
  characterLimit: (max) => `최대 ${max}자`,
  charactersLeft: (remaining) => `${remaining}자 남음`,
  characterLimitReached: '글자 수 한도에 도달했습니다',
  createOption: (query) => `"${query}" 만들기`,
  suggestions: '추천',
  suggestionCount: (count) => (count === 0 ? '추천 없음' : `추천 ${count}개`),
  saturation: '채도',
  brightness: '밝기',
  hue: '색상',
  colorPicker: '색 선택',
  datePicker: '날짜 선택',
  timePicker: '시각 선택',
  previousMonth: '이전 달',
  nextMonth: '다음 달',
  previousYears: '이전 연도',
  nextYears: '다음 연도',
  copied: '복사했습니다',
  copyFailed: '복사하지 못했습니다',
  conversation: '대화',
  scrollToLatest: '최신 메시지로 이동',
  messageStarted: '새 메시지',
  messageFinished: '메시지 완료',
  send: '보내기',
  stop: '중지',
  stepDone: '완료',
  stepCurrent: '진행 중',
  stepPending: '시작 전',
  stepError: '실패',
};

/** The strings to give StringsProvider for a locale. English is Todae's default, so it sets none. */
export const TODAE_STRINGS: Record<Locale, Partial<Strings>> = { en: {}, ko: KOREAN };
