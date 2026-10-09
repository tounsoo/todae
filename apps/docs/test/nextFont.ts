// next/font/google only works inside Next's compiler. Unit tests get a font with no class or variable.
const font = () => ({ className: '', variable: '', style: { fontFamily: 'sans-serif' } });

export const Geist = font;
export const Geist_Mono = font;
