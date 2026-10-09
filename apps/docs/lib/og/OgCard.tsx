import { DOCS_ORIGIN } from '../origin';
import { localizePath } from '../i18n/config';
import { SITE_NAME } from '../i18n/metadata';
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

/** Long titles step down so they stay on two or three lines. */
function titleSize(title: string): number {
  if (title.length <= 14) return 104;
  if (title.length <= 24) return 88;
  return 72;
}

/** The address a reader would see, without the scheme. */
export function displayUrl(page: Pick<OgPage, 'locale' | 'slug'>): string {
  const host = new URL(DOCS_ORIGIN).host;
  const path = localizePath(page.slug ? `/${page.slug}` : '/', page.locale);
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
        padding: 64,
        gap: 56,
        background: canvas,
        color: ink,
        fontFamily: 'Geist, "Noto Sans KR"',
      }}
    >
      <div style={{ display: 'flex', flexDirection: 'column', flex: 1, justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, fontSize: 36, fontWeight: 700, letterSpacing: '-0.02em' }}>
          {/* The site's brand mark: two bars on a soft tile. */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'space-between',
              width: 44,
              height: 44,
              padding: '7px 0',
              borderRadius: 11,
              background: raised,
              border: `1.5px solid ${line}`,
            }}
          >
            <div style={{ width: 22, height: 17, background: ink }} />
            <div style={{ width: 30, height: 8, background: ink }} />
          </div>
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
        <div style={{ display: 'flex', fontFamily: '"Geist Mono"', fontSize: 24, color: muted }}>{displayUrl(page)}</div>
      </div>
      {/* The token motif: the gray ramp as swatches on the dotted panel the home page shows its components on. */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          gap: 10,
          width: 260,
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
