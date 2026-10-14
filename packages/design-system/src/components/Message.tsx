import type { ComponentPropsWithRef } from 'react';
import { cx } from './cx';
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
  /** True while the message is still arriving. Sets `aria-busy` and `data-streaming`, and Message.Content draws a caret after the text. */
  streaming?: boolean;
};
export type MessageAvatarProps = ComponentPropsWithRef<'div'>;
export type MessageHeaderProps = ComponentPropsWithRef<'div'>;
export type MessageContentProps = ComponentPropsWithRef<'div'>;
export type MessageActionsProps = ComponentPropsWithRef<'div'>;

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

function Actions({ className, ...props }: MessageActionsProps) {
  return <div {...props} className={cx(styles.actions, className)} />;
}

export const Message = { Root, Avatar, Header, Content, Actions } as const;
