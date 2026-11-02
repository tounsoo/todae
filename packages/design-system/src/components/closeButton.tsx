import { useGlyphs } from '../providers/GlyphsProvider.js';
import { Button, type ButtonActionProps } from './Button.js';
import { useButtonName } from './buttonName.js';
import { CrossGlyph, glyphOr } from './glyphs.js';

export type CloseButtonProps = ButtonActionProps & {
  /** The name it falls back to when its own text doesn't name it, such as the `close` or `dismiss` string. */
  fallbackName: string;
};

/**
 * The close part Dialog, Drawer, BottomSheet, Toast, Alert and Attachment
 * share: a ghost Button.Root that shows the close glyph when it has no content
 * of its own. Text a screen reader reads, such as "Cancel", names it;
 * `fallbackName` names one without, such as the glyph. Each caller adds its
 * own class, marker and click action.
 */
export function CloseButton({ fallbackName, 'aria-label': ariaLabel, children, ref, ...props }: CloseButtonProps) {
  const [label, refs] = useButtonName(children, ariaLabel, ref, fallbackName);
  const { close } = useGlyphs();
  return (
    <Button.Root
      variant="ghost"
      // Todae's own close shows no tip, as a text × never did: a dialog's first
      // focus often lands on it.
      tooltip={children == null ? false : undefined}
      aria-label={label}
      {...props}
      ref={refs}
    >
      {children ?? <Button.Icon>{glyphOr(close, <CrossGlyph />)}</Button.Icon>}
    </Button.Root>
  );
}
