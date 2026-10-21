import {
  createContext,
  useContext,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ComponentPropsWithRef,
} from 'react';
import { cx } from './cx.js';
import { useComposedRefs } from './props.js';
import styles from './Avatar.module.css';
import type { CategoryTone } from './tone.js';

export type AvatarSize = 'sm' | 'md' | 'lg';

/** `neutral`, or a category hue. `categoryTone(id)` picks a stable one per person. */
export type AvatarTone = 'neutral' | CategoryTone;

/** Where the avatar's image stands: `idle` while no Avatar.Image renders. */
export type AvatarImageStatus = 'idle' | 'loading' | 'loaded' | 'error';

/**
 * A `span` that shows an image, or a fallback while the image loads, when it
 * fails, or when there is none. With `label` the avatar is one image named by
 * `label` (`role="img"`), whichever of the two shows. Without `label` it is
 * decorative and hidden from assistive technology: use that when the name is
 * already written next to it.
 */
export type AvatarRootProps = {
  /** Names the avatar for assistive technology, such as "Ada Lovelace". */
  label?: string;
  /** Inside an `Avatar.Group`, the group's size when left out. */
  size?: AvatarSize;
  /**
   * Colors behind the fallback. `neutral` reads avatar.bg and avatar.fg; other
   * tones read the avatar.<tone> contract tokens.
   */
  tone?: AvatarTone;
} & Omit<ComponentPropsWithRef<'span'>, 'role' | 'aria-label' | 'aria-labelledby'>;

/**
 * A `div` with `role="group"` that stacks several `Avatar.Root`s, each over the
 * one before. Name it with `aria-label` or `aria-labelledby`.
 */
export type AvatarGroupProps = {
  'aria-label'?: string;
  'aria-labelledby'?: string;
  /** Size for the avatars inside that set no `size` of their own. */
  size?: AvatarSize;
} & Omit<ComponentPropsWithRef<'div'>, 'role'>;

/**
 * An `img` drawn over the fallback, which goes once it loads. It takes no `alt`: the avatar's
 * `label` names it, so the image and the fallback share one name.
 */
export type AvatarImageProps = Omit<ComponentPropsWithRef<'img'>, 'alt'>;

/** Shows until the image loads, and stays when it fails or there is none: initials or an icon. */
export type AvatarFallbackProps = ComponentPropsWithRef<'span'>;

type AvatarContextValue = {
  status: AvatarImageStatus;
  setStatus: (status: AvatarImageStatus) => void;
};

const AvatarContext = /* @__PURE__ */ createContext<AvatarContextValue | null>(null);

const AvatarGroupContext = /* @__PURE__ */ createContext<AvatarSize | null>(null);

function useAvatar(part: string): AvatarContextValue {
  const ctx = useContext(AvatarContext);
  if (!ctx) throw new Error(`Avatar.${part} must render inside Avatar.Root`);
  return ctx;
}

function Root({ label, size: ownSize, tone = 'neutral', className, 'aria-hidden': ariaHidden, ...props }: AvatarRootProps) {
  const [status, setStatus] = useState<AvatarImageStatus>('idle');
  const value = useMemo(() => ({ status, setStatus }), [status]);
  const groupSize = useContext(AvatarGroupContext);
  const size = ownSize ?? groupSize ?? 'md';
  const named = Boolean(label);
  return (
    <AvatarContext.Provider value={value}>
      <span
        {...props}
        role={named ? 'img' : undefined}
        aria-label={named ? label : undefined}
        aria-hidden={named ? ariaHidden : (ariaHidden ?? true)}
        data-size={size}
        data-tone={tone}
        data-status={status}
        className={cx(styles.root, className)}
      />
    </AvatarContext.Provider>
  );
}

function Image({ src, srcSet, ref, onLoad, onError, className, ...props }: AvatarImageProps) {
  const { setStatus } = useAvatar('Image');
  const own = useRef<HTMLImageElement>(null);
  const refs = useComposedRefs(own, ref);
  // The source the status was last decided for, so a change can be told
  // apart from a first run or a StrictMode re-run.
  const decided = useRef<string | null>(null);

  // A changed source is loading until the image's own load or error event
  // says otherwise: right after React sets it, some engines still report the
  // old image as complete. On the first run the image is read from the
  // element, as one that finished before React attached its handlers, such as
  // one from the cache before hydration, gets no load event: a natural width
  // means it loaded. A width of 0 is either a broken image or an SVG with no
  // intrinsic size, so the source is set again: the element loads it once more
  // and its own event decides. No source at all is a failure, so the fallback
  // stays.
  useLayoutEffect(() => {
    const img = own.current!;
    const source = `${src ?? ''} ${srcSet ?? ''}`;
    const changed = decided.current !== null && decided.current !== source;
    decided.current = source;
    if (!src && !srcSet) setStatus('error');
    else if (changed || !img.complete) setStatus('loading');
    else if (img.naturalWidth > 0) setStatus('loaded');
    else {
      setStatus('loading');
      if (img.hasAttribute('src')) img.src = img.getAttribute('src')!;
      else img.srcset = img.getAttribute('srcset')!;
    }
    return () => setStatus('idle');
  }, [src, srcSet, setStatus]);

  return (
    <img
      {...props}
      ref={refs}
      src={src || undefined}
      srcSet={srcSet || undefined}
      alt=""
      onLoad={(event) => {
        setStatus('loaded');
        onLoad?.(event);
      }}
      onError={(event) => {
        setStatus('error');
        onError?.(event);
      }}
      className={cx(styles.image, className)}
    />
  );
}

function Fallback({ className, ...props }: AvatarFallbackProps) {
  const { status } = useAvatar('Fallback');
  if (status === 'loaded') return null;
  return <span {...props} className={cx(styles.fallback, className)} />;
}

function Group({ size = 'md', className, ...props }: AvatarGroupProps) {
  return (
    <AvatarGroupContext.Provider value={size}>
      <div {...props} role="group" data-size={size} className={cx(styles.group, className)} />
    </AvatarGroupContext.Provider>
  );
}

export const Avatar = { Root, Image, Fallback, Group } as const;
