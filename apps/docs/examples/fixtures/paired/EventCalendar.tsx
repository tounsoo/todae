import { recurrence } from './recurrence.ts';
import styles from './EventCalendar.module.css';

export function EventCalendar() {
  return `${recurrence} ${styles.root ?? ''}`;
}
