/// <reference lib="esnext.temporal" preserve="true" />
import type { ComponentPropsWithRef, ReactNode } from 'react';
import { cx } from './cx.js';
import styles from './Message.module.css';

/** Who wrote the message. It sets layout and tokens only: a user's message sits at the end side in a bubble. */
export type MessageFrom = 'user' | 'assistant' | 'system';

/**
 * One turn of a conversation, as an `article`. It knows nothing about any
 * agent SDK's message shape: the product maps its own data onto the parts.
 */
export type MessageRootProps = ComponentPropsWithRef<'article'> & {
  /** Who wrote it. Sets `data-from`. Default `assistant`. */
  from?: MessageFrom;
  /** True while the message is still arriving. Sets `aria-busy` and `data-streaming`. */
  streaming?: boolean;
};
export type MessageAvatarProps = ComponentPropsWithRef<'div'>;
export type MessageHeaderProps = ComponentPropsWithRef<'div'>;
export type MessageContentProps = ComponentPropsWithRef<'div'>;
/** When the actions row shows: always, or only while the message is hovered or holds focus. */
export type MessageActionsReveal = 'always' | 'hover';
export type MessageActionsProps = ComponentPropsWithRef<'div'> & {
  /**
   * `hover` hides the row until the pointer is over the message or focus is
   * inside it. On a screen with no hover, such as a phone, it always shows.
   * Default `always`.
   */
  reveal?: MessageActionsReveal;
};
export type MessageTimeProps = Omit<ComponentPropsWithRef<'time'>, 'dateTime'> & {
  /** When the message was sent, in the time zone to show it in. */
  value: Temporal.ZonedDateTime;
  /** The locale to write it in, such as "ko". The runtime's own when not set, so set it when a server renders the message. */
  locale?: string;
  /** Intl's `dateStyle`. With neither style set, the time is written in the `short` time style. */
  dateStyle?: Intl.DateTimeFormatOptions['dateStyle'];
  /** Intl's `timeStyle`. With neither style set, it is `short`. */
  timeStyle?: Intl.DateTimeFormatOptions['timeStyle'];
  /** Text to show in place of the formatted value, such as "2 min ago". `dateTime` still comes from `value`. */
  children?: ReactNode;
};

function Root({ className, from = 'assistant', streaming = false, ...props }: MessageRootProps) {
  return (
    <article
      aria-busy={streaming || undefined}
      {...props}
      data-from={from}
      data-streaming={streaming ? '' : undefined}
      className={cx(styles.root, className)}
    />
  );
}

function Avatar({ className, ...props }: MessageAvatarProps) {
  return <div {...props} className={cx(styles.avatar, className)} />;
}

function Header({ className, ...props }: MessageHeaderProps) {
  return <div {...props} className={cx(styles.header, className)} />;
}

function Content({ className, ...props }: MessageContentProps) {
  return <div {...props} className={cx(styles.content, className)} />;
}

function Actions({ className, reveal = 'always', ...props }: MessageActionsProps) {
  return <div {...props} data-reveal={reveal} className={cx(styles.actions, className)} />;
}

// One formatter per locale, style and zone: a conversation formats many times on each render.
const formats = /* @__PURE__ */ new Map<string, Intl.DateTimeFormat>();

function format(value: Temporal.ZonedDateTime, locale: string | undefined, options: Intl.DateTimeFormatOptions) {
  const key = `${locale ?? ''}|${options.dateStyle ?? ''}|${options.timeStyle ?? ''}|${value.timeZoneId}`;
  let formatter = formats.get(key);
  if (!formatter) {
    // Gregorian whatever the locale's own calendar, as formatDate writes dates.
    formatter = new Intl.DateTimeFormat(locale, { ...options, calendar: 'gregory', timeZone: value.timeZoneId });
    formats.set(key, formatter);
  }
  return formatter.format(value.epochMilliseconds);
}

function Time({ className, value, locale, dateStyle, timeStyle, children, ...props }: MessageTimeProps) {
  const options = dateStyle || timeStyle ? { dateStyle, timeStyle } : { timeStyle: 'short' as const };
  return (
    <time
      {...props}
      dateTime={value.toInstant().toString({ smallestUnit: 'second' })}
      className={cx(styles.time, className)}
    >
      {children ?? format(value, locale, options)}
    </time>
  );
}

export const Message = { Root, Avatar, Header, Content, Time, Actions } as const;
