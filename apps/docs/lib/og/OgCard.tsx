import { BrandMark } from '../brand';
import { DOCS_ORIGIN } from '../origin';
import { OG_IMAGE_SIZE, pagePath, SITE_NAME } from '../i18n/metadata';
import { coreColor } from './colors';
import type { OgPage } from './pages';

// The light docs theme: canvas gray.50, ink gray.900, as the site resolves its semantic tokens.
const canvas = coreColor('gray.50');
const raised = coreColor('gray.100');
const line = coreColor('gray.200');
const ink = coreColor('gray.900');
const muted = coreColor('gray.600');

/** The gray ramp, light to dark, as the motif: Todae is tokens first. */
const RAMP = ['50', '100', '200', '300', '400', '500', '600', '700', '800', '900', '950'] as const;
const ACCENTS = ['green.300', 'amber.300', 'red.300'] as const;

/** The card's size and the left column the text sits in, beside the swatch panel. */
const PADDING = 64;
const GAP = 56;
const PANEL = 260;
export const TEXT_WIDTH = OG_IMAGE_SIZE.width - 2 * PADDING - GAP - PANEL;

/**
 * Roughly how wide `text` sets, in ems. The renderer cannot measure, so this
 * errs wide: Geist Bold averages about 0.55em a character and Hangul is square.
 */
export function estimateEms(text: string, mono = false): number {
  let ems = 0;
  for (const char of text) {
    if (mono) ems += 0.62;
    else if (/[\u1100-\u11ff\u3130-\u318f\uac00-\ud7af]/.test(char)) ems += 1;
    else if (/[A-Z]/.test(char)) ems += 0.7;
    else ems += 0.6;
  }
  return ems;
}

/**
 * The largest title size, up to 104px, at which the longest word fits the
 * column on one line (a word cannot break) and the whole title fits in three.
 */
export function titleSize(title: string): number {
  const longest = Math.max(...title.split(/\s+/).map((word) => estimateEms(word)));
  const fits = Math.min(TEXT_WIDTH / longest, (3 * TEXT_WIDTH) / (estimateEms(title) * 1.15));
  return Math.floor(Math.min(104, fits));
}

/** The address size, up to 24px, at which it stays on one line. */
export function urlSize(url: string): number {
  return Math.floor(Math.min(24, TEXT_WIDTH / estimateEms(url, true)));
}

/** The address a reader would see, without the scheme. */
export function displayUrl(page: Pick<OgPage, 'locale' | 'slug'>): string {
  const host = new URL(DOCS_ORIGIN).host;
  const path = pagePath(page.locale, page.slug);
  return path === '/' ? host : host + path;
}

/** Every string the card draws, so the fonts can be cut down to them. */
export function ogText(page: OgPage): string {
  return [SITE_NAME, page.eyebrow, page.title, displayUrl(page), ...RAMP].join('');
}

/** The 1200×630 social image for one page, drawn in the docs' own light theme. */
export function OgCard({ page }: { page: OgPage }) {
  return (
    <div
      lang={page.locale}
      style={{
        display: 'flex',
        width: '100%',
        height: '100%',
        padding: PADDING,
        gap: GAP,
        background: canvas,
        color: ink,
        fontFamily: 'Geist, "Noto Sans KR"',
      }}
    >
      <div style={{ display: 'flex', flexDirection: 'column', flex: 1, justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, fontSize: 36, fontWeight: 700, letterSpacing: '-0.02em' }}>
          <BrandMark size={52} color={ink} background={canvas} />
          {SITE_NAME}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 28 }}>
          {page.eyebrow && (
            <div
              style={{
                display: 'flex',
                padding: '8px 20px',
                borderRadius: 999,
                border: `1.5px solid ${line}`,
                background: raised,
                color: muted,
                fontSize: 26,
                fontWeight: 500,
              }}
            >
              {page.eyebrow}
            </div>
          )}
          <div
            style={{
              display: 'flex',
              fontSize: titleSize(page.title),
              fontWeight: 700,
              lineHeight: 1.05,
              letterSpacing: '-0.035em',
              wordBreak: page.locale === 'ko' ? 'keep-all' : 'normal',
            }}
          >
            {page.title}
          </div>
        </div>
        <div style={{ display: 'flex', fontFamily: '"Geist Mono"', fontSize: urlSize(displayUrl(page)), color: muted, whiteSpace: 'nowrap' }}>
          {displayUrl(page)}
        </div>
      </div>
      {/* The token motif: the gray ramp as swatches on the dotted panel the home page shows its components on. */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          gap: 10,
          width: PANEL,
          padding: 28,
          borderRadius: 28,
          border: `1.5px solid ${line}`,
          backgroundColor: raised,
          backgroundImage: `radial-gradient(circle at 2px 2px, ${line} 2px, transparent 0)`,
          backgroundSize: '24px 24px',
        }}
      >
        {RAMP.map((step) => (
          <div key={step} style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <div
              style={{
                display: 'flex',
                flex: 1,
                height: 30,
                borderRadius: 8,
                background: coreColor(`gray.${step}`),
                border: `1.5px solid ${line}`,
              }}
            />
            <div style={{ display: 'flex', width: 44, fontFamily: '"Geist Mono"', fontSize: 18, color: muted }}>{step}</div>
          </div>
        ))}
        <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
          {ACCENTS.map((path) => (
            <div key={path} style={{ display: 'flex', width: 30, height: 30, borderRadius: 999, background: coreColor(path) }} />
          ))}
        </div>
      </div>
    </div>
  );
}
