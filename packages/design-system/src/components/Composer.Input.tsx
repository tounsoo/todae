import type { KeyboardEvent } from 'react';
import { Field, type FieldTextareaProps } from './Field.js';
import { mergeDescribedBy } from './Field.context.js';
import { OptionList } from './OptionList.js';
import { Popover } from './Popover.js';
import { tokenAtCaret, useMentions, type MentionDraft } from '../hooks/useMentions.js';
import { useMentionPeek } from '../hooks/useMentionPeek.js';
import type { MentionSource } from '../mentions/source.js';
import { Attachments, Root, Submit, Toolbar } from './Composer.js';
export type { ComposerAttachmentsProps, ComposerRootProps, ComposerSubmitProps, ComposerToolbarProps } from './Composer.js';

type MentionFieldProps = Omit<FieldTextareaProps, 'value' | 'defaultValue' | 'onChange' | 'onValueChange'>;

type NamedField =
  | (MentionFieldProps & { 'aria-label': string; 'aria-labelledby'?: string })
  | (MentionFieldProps & { 'aria-labelledby': string; 'aria-label'?: never });

export type ComposerInputProps = NamedField & {
  mentions?: readonly MentionSource[];
  value?: MentionDraft;
  defaultValue?: MentionDraft;
  onValueChange?: (value: MentionDraft) => void;
  /** Keeps the suggestion list closed. */
  disabled?: boolean;
};

function Input({
  mentions = [],
  value,
  defaultValue,
  onValueChange,
  maxLength,
  disabled,
  id,
  className,
  'aria-label': ariaLabel,
  'aria-labelledby': ariaLabelledBy,
  onKeyDown,
  'aria-describedby': describedBy,
  ...props
}: ComposerInputProps) {
  const mentionsApi = useMentions({
    triggers: mentions,
    value,
    defaultValue,
    onValueChange,
    maxLength,
    disabled,
    id,
  });
  const el = mentionsApi.textareaRef.current;
  const caret = el && el.selectionStart === el.selectionEnd ? el.selectionStart : null;
  const token = !mentionsApi.open && caret !== null ? tokenAtCaret(mentionsApi.value.tokens, caret) : null;
  const source = token ? (mentions.find((item) => item.char === token.char) ?? null) : null;
  const peek = useMentionPeek({
    source,
    id: token?.value ?? null,
    mode: 'caret',
    active: token !== null && !mentionsApi.open,
    text: token?.text ?? '',
    focusRef: mentionsApi.textareaRef,
    anchorName: mentionsApi.caretPeekAnchorName,
  });
  const onEscape = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key !== 'Escape' || mentionsApi.open || !peek.open) return;
    event.preventDefault();
    peek.close();
  };
  const described = mergeDescribedBy(describedBy, peek.open ? peek.triggerProps['aria-describedby'] : undefined);
  return (
    <>
      <Field.Root aria-label={ariaLabel} aria-labelledby={ariaLabelledBy} className={className}>
        <Field.Textarea
          {...mentionsApi.getTextareaProps({
            ...props,
            'aria-describedby': described,
            onKeyDown: (event) => {
              onKeyDown?.(event);
              if (!event.defaultPrevented) onEscape(event);
            },
          })}
        />
      </Field.Root>
      <Popover.Root {...mentionsApi.getPopoverProps()}>
        <OptionList.Root {...mentionsApi.getListboxProps()}>
          {mentionsApi.items.map((item) => (
            <OptionList.Option key={item.id} {...mentionsApi.getOptionProps(item)} />
          ))}
        </OptionList.Root>
      </Popover.Root>
      {source?.renderPeek ? (
        <Popover.Root {...peek.peekProps} inert={peek.inert ? true : undefined}>
          {peek.loading ? <span data-loading="" aria-hidden="true" /> : null}
          {peek.entity !== undefined ? source.renderPeek(peek.entity, peek.context) : null}
        </Popover.Root>
      ) : null}
    </>
  );
}

export const Composer = { Root, Attachments, Toolbar, Submit, Input };
