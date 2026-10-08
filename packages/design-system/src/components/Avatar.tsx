import {
  createContext,
  useContext,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ComponentPropsWithRef,
} from 'react';
import { cx } from './cx';
import { useComposedRefs } from './props';
import styles from './Avatar.module.css';

export type AvatarSize = 'sm' | 'md' | 'lg';

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
  size?: AvatarSize;
} & Omit<ComponentPropsWithRef<'span'>, 'role' | 'aria-label' | 'aria-labelledby'>;

/**
 * An `img` that shows once it has loaded. It takes no `alt`: the avatar's
 * `label` names it, so the image and the fallback share one name.
 */
export type AvatarImageProps = Omit<ComponentPropsWithRef<'img'>, 'alt'>;

/** Shows until the image loads, and stays when it fails or there is none: initials or an icon. */
export type AvatarFallbackProps = ComponentPropsWithRef<'span'>;

type AvatarContextValue = {
  status: AvatarImageStatus;
  setStatus: (status: AvatarImageStatus) => void;
};

const AvatarContext = createContext<AvatarContextValue | null>(null);

function useAvatar(part: string): AvatarContextValue {
  const ctx = useContext(AvatarContext);
  if (!ctx) throw new Error(`Avatar.${part} must render inside Avatar.Root`);
  return ctx;
}

function Root({ label, size = 'md', className, 'aria-hidden': ariaHidden, ...props }: AvatarRootProps) {
  const [status, setStatus] = useState<AvatarImageStatus>('idle');
  const value = useMemo(() => ({ status, setStatus }), [status]);
  const named = Boolean(label);
  return (
    <AvatarContext.Provider value={value}>
      <span
        {...props}
        role={named ? 'img' : undefined}
        aria-label={named ? label : undefined}
        aria-hidden={named ? ariaHidden : (ariaHidden ?? true)}
        data-size={size}
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

  // A new source starts over. An image that finished before React attached
  // its handlers, such as one from the cache before hydration, gets no load
  // event, so decode() says whether it is usable; it also accepts an SVG with
  // no intrinsic size, which reports a natural width of 0. No source at all is
  // a failure, so the fallback stays.
  useLayoutEffect(() => {
    const img = own.current;
    let current = true;
    if ((!src && !srcSet) || !img) setStatus('error');
    else if (img.complete) {
      setStatus('loading');
      img.decode().then(
        () => current && setStatus('loaded'),
        () => current && setStatus('error'),
      );
    } else setStatus('loading');
    return () => {
      current = false;
      setStatus('idle');
    };
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

export const Avatar = { Root, Image, Fallback } as const;
