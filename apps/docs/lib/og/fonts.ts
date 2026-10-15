type Weight = 400 | 500 | 700;

export type OgFont = { name: string; data: ArrayBuffer; weight: Weight; style: 'normal' };

/**
 * One weight of a Google font, cut down to the characters in `text`. The
 * image renderer needs the TrueType file itself, which Google serves to a
 * request without a browser user agent.
 */
async function googleFont(family: string, weight: Weight, text: string): Promise<OgFont> {
  const css = await fetch(
    `https://fonts.googleapis.com/css2?family=${encodeURIComponent(family)}:wght@${weight}&text=${encodeURIComponent(text)}`,
  ).then((response) => {
    if (!response.ok) throw new Error(`Google Fonts answered ${response.status} for ${family} ${weight}`);
    return response.text();
  });
  const url = /src: url\((.+?)\) format\('(?:opentype|truetype)'\)/.exec(css)?.[1];
  if (!url) throw new Error(`No TrueType file for ${family} ${weight}`);
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Google Fonts answered ${response.status} for the ${family} ${weight} file`);
  return { name: family, data: await response.arrayBuffer(), weight, style: 'normal' };
}

/**
 * Geist for Latin text, since the image renderer has no system faces to fall
 * back on, Noto Sans KR for Hangul, which Geist lacks, and Geist Mono for the
 * address. The renderer takes each
 * character from the first font that has it.
 */
export async function ogFonts(text: string): Promise<OgFont[]> {
  const unique = [...new Set(text)].join('');
  return Promise.all([
    googleFont('Geist', 500, unique),
    googleFont('Geist', 700, unique),
    googleFont('Noto Sans KR', 500, unique),
    googleFont('Noto Sans KR', 700, unique),
    googleFont('Geist Mono', 400, unique),
  ]);
}
