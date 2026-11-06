import 'temporal-polyfill/global';

/**
 * The moment every docs browser test sees as now. The date and time pickers
 * start at today and at the next time from now, and how far the time list
 * opens scrolled follows from that, so a real clock makes layout checks pass
 * or fail by the hour CI runs. At 02:34 the date-time picker example with
 * 15-minute steps opens its list at 02:45, scrolled a little, which is the
 * case that once flagged a focus ring as cut. The 18th is mid-month, so no
 * two date-range presets give the same range.
 */
export const FIXED_NOW = Temporal.Instant.from('2026-03-18T02:34:00Z');
export const FIXED_TIME_ZONE = 'UTC';

const zoned = (timeZone: Temporal.TimeZoneLike = FIXED_TIME_ZONE) => FIXED_NOW.toZonedDateTimeISO(timeZone);

// Assigned, not spied, so a test file's vi.restoreAllMocks() brings back this clock rather than the real one.
// A test that needs another day can still vi.spyOn a method on top of it.
const fixed: { [K in keyof typeof Temporal.Now]: (typeof Temporal.Now)[K] } = {
  timeZoneId: () => FIXED_TIME_ZONE,
  instant: () => FIXED_NOW,
  zonedDateTimeISO: (timeZone) => zoned(timeZone),
  plainDateTimeISO: (timeZone) => zoned(timeZone).toPlainDateTime(),
  plainDateISO: (timeZone) => zoned(timeZone).toPlainDate(),
  plainTimeISO: (timeZone) => zoned(timeZone).toPlainTime(),
};
for (const [name, value] of Object.entries(fixed)) {
  Object.defineProperty(Temporal.Now, name, { value, writable: true, configurable: true, enumerable: false });
}
