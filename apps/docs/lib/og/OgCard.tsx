import { BrandMark } from '../brand';
import { OG_IMAGE_SIZE, SITE_NAME } from '../i18n/metadata';
import { coreColor } from './colors';
import type { OgPage } from './pages';

// Graphite's dark ramp: ink canvas, a faint texture one step up, light text.
const canvas = coreColor('gray.950');
const texture = coreColor('gray.900');
const ink = coreColor('gray.50');
const muted = coreColor('gray.500');

/** 토대, the name in Hangul, set huge and cropped behind the title. */
const TEXTURE = '토대';

const PADDING = 80;
/** The width the title and eyebrow sit in. */
export const TEXT_WIDTH = OG_IMAGE_SIZE.width - 2 * PADDING;
/** The height left for the title under the brand row and the eyebrow. */
export const TITLE_HEIGHT = 300;
const LINE_HEIGHT = 1.05;

/**
 * Roughly how wide `text` sets, in ems. The renderer cannot measure, so this
 * errs wide: Geist Bold averages about 0.55em a character and Hangul is square.
 */
export function estimateEms(text: string): number {
  let ems = 0;
  for (const char of text) {
    if (/[\u1100-\u11ff\u3130-\u318f\uac00-\ud7af]/.test(char)) ems += 1;
    else if (/[A-Z]/.test(char)) ems += 0.7;
    else ems += 0.6;
  }
  return ems;
}

/**
 * The largest title size, up to 200px, at which the longest word fits the
 * column on one line (a word cannot break) and the lines the whole title
 * wraps to, with slack for line ends, fit the title's height.
 */
export function titleSize(title: string): number {
  const longest = Math.max(...title.split(/\s+/).map((word) => estimateEms(word)));
  const ems = estimateEms(title) * 1.15;
  let size = Math.floor(Math.min(200, TEXT_WIDTH / longest));
  while (size > 1 && Math.ceil((ems * size) / TEXT_WIDTH) * LINE_HEIGHT * size > TITLE_HEIGHT) size -= 1;
  return size;
}

/** Every string the card draws, so the fonts can be cut down to them. The eyebrow draws in capitals. */
export function ogText(page: OgPage): string {
  return [SITE_NAME, TEXTURE, page.eyebrow.toUpperCase(), page.title].join('');
}

/** The 1200×630 social image for one page, drawn in Graphite's dark ramp. */
export function OgCard({ page }: { page: OgPage }) {
  return (
    <div
      lang={page.locale}
      style={{
        display: 'flex',
        position: 'relative',
        width: '100%',
        height: '100%',
        padding: PADDING,
        background: canvas,
        color: ink,
        fontFamily: 'Geist, "Noto Sans KR"',
      }}
    >
      <div
        style={{
          display: 'flex',
          position: 'absolute',
          right: -60,
          bottom: -170,
          fontFamily: '"Noto Sans KR"',
          fontSize: 520,
          fontWeight: 700,
          letterSpacing: '-0.04em',
          color: texture,
        }}
      >
        {TEXTURE}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', flex: 1, justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, fontSize: 38, fontWeight: 700, letterSpacing: '-0.02em' }}>
          <BrandMark size={52} color={ink} background={canvas} />
          {SITE_NAME}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 20 }}>
          {page.eyebrow && (
            <div style={{ display: 'flex', fontFamily: '"Geist Mono", "Noto Sans KR"', fontSize: 24, letterSpacing: page.locale === 'ko' ? 0 : '0.08em', textTransform: 'uppercase', color: muted }}>
              {page.eyebrow}
            </div>
          )}
          <div
            style={{
              display: 'flex',
              maxWidth: TEXT_WIDTH,
              fontSize: titleSize(page.title),
              fontWeight: 700,
              lineHeight: LINE_HEIGHT,
              letterSpacing: '-0.04em',
              wordBreak: page.locale === 'ko' ? 'keep-all' : 'normal',
              textWrap: 'balance',
            }}
          >
            {page.title}
          </div>
        </div>
      </div>
    </div>
  );
}
