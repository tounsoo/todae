// The first day of a locale's week, shared by Calendar and formatRelativeTime: no hooks or context.

/** A day of the week, 1 for Monday to 7 for Sunday, as Temporal numbers them. */
export type DayOfWeek = 1 | 2 | 3 | 4 | 5 | 6 | 7;

// Browsers ship the method; Node 22 and older Chromium and Safari, the accessor.
type WeekInfoLocale = Intl.Locale & {
  getWeekInfo?: () => { firstDay: number };
  weekInfo?: { firstDay: number };
};

/** The first day of `locale`'s week, or of the runtime's own locale when not set. Sunday when Intl can't say. */
export function localeFirstDay(locale?: string): DayOfWeek {
  try {
    const info = new Intl.Locale(locale ?? new Intl.DateTimeFormat().resolvedOptions().locale) as WeekInfoLocale;
    const day = (info.getWeekInfo?.() ?? info.weekInfo)?.firstDay;
    if (day && day >= 1 && day <= 7) return day as DayOfWeek;
  } catch {
    // A locale Intl cannot read keeps the default.
  }
  return 7;
}
