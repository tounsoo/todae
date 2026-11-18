import { recurrence } from './recurrence';
import styles from './EventCalendar.module.css';

export function EventCalendar() {
  return `${recurrence} ${styles.root ?? ''}`;
}
