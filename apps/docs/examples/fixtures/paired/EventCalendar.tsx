import { recurrence } from './recurrence';
import styles from './EventCalendar.module.css';
import lane from './Lane.module.css';

export function EventCalendar() {
  return `${recurrence} ${styles.root ?? ''} ${lane.root ?? ''}`;
}
