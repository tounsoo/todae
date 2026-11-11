// Kept apart from props.ts, which uses hooks, so server-safe parts can import it.
export function cx(...classes: (string | false | null | undefined)[]): string {
  return classes.filter(Boolean).join(' ');
}
