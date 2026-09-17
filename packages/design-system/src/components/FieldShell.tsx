import {
  Children,
  createContext,
  isValidElement,
  useContext,
  useId,
  useRef,
  type CSSProperties,
  type MouseEvent,
  type ReactElement,
  type ReactNode,
  type RefObject,
} from 'react';
import styles from './FieldShell.module.css';

export type FieldShellProps = {
  disabled?: boolean;
  invalid?: boolean;
  id?: string;
  name?: string;
  'aria-describedby'?: string;
  'aria-labelledby'?: string;
  'aria-label'?: string;
  className?: string;
  style?: CSSProperties;
  children?: ReactNode;
};

export type FieldContextValue = {
  inputId: string;
  disabled: boolean;
  invalid: boolean;
  name?: string;
  describedBy?: string;
  labelledBy?: string;
  ariaLabel?: string;
  inputRef: RefObject<HTMLInputElement | null>;
};

const FieldContext = createContext<FieldContextValue | null>(null);

export function useField(): FieldContextValue {
  const ctx = useContext(FieldContext);
  if (!ctx) throw new Error('Field parts must render inside TextField or ChipField');
  return ctx;
}

export type FieldAdornmentProps = {
  children?: ReactNode;
  interactive?: boolean;
  className?: string;
};

function Adornment({
  children,
  interactive,
  className,
  hidden,
}: FieldAdornmentProps & { hidden?: boolean }) {
  return (
    <span
      className={[styles.adornment, className].filter(Boolean).join(' ')}
      aria-hidden={hidden && !interactive ? true : undefined}
    >
      {children}
    </span>
  );
}

export function IconStart(props: FieldAdornmentProps) {
  return <Adornment {...props} hidden />;
}

export function IconEnd(props: FieldAdornmentProps) {
  return <Adornment {...props} hidden />;
}

export function Prefix({ children, className }: FieldAdornmentProps) {
  return <span className={[styles.adornment, className].filter(Boolean).join(' ')}>{children}</span>;
}

export function Suffix({ children, className }: FieldAdornmentProps) {
  return <span className={[styles.adornment, className].filter(Boolean).join(' ')}>{children}</span>;
}

export function collectFieldParts(children: ReactNode): {
  iconStart: ReactElement | null;
  iconEnd: ReactElement | null;
  prefix: ReactElement | null;
  suffix: ReactElement | null;
  rest: ReactNode[];
} {
  const slots = {
    iconStart: null as ReactElement | null,
    iconEnd: null as ReactElement | null,
    prefix: null as ReactElement | null,
    suffix: null as ReactElement | null,
    rest: [] as ReactNode[],
  };
  Children.forEach(children, (child) => {
    if (!isValidElement(child)) {
      if (child != null && child !== false) slots.rest.push(child);
      return;
    }
    if (child.type === IconStart) slots.iconStart = child;
    else if (child.type === IconEnd) slots.iconEnd = child;
    else if (child.type === Prefix) slots.prefix = child;
    else if (child.type === Suffix) slots.suffix = child;
    else slots.rest.push(child);
  });
  return slots;
}

function isInteractiveTarget(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) return false;
  return Boolean(target.closest('button, a, input, textarea, select, [tabindex]'));
}

export function FieldRoot({
  disabled,
  invalid,
  id,
  name,
  className,
  style,
  children,
  ...aria
}: FieldShellProps) {
  const autoId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const inputId = id ?? autoId;
  const slots = collectFieldParts(children);

  function onMouseDown(event: MouseEvent<HTMLDivElement>) {
    if (disabled || isInteractiveTarget(event.target)) return;
    event.preventDefault();
    inputRef.current?.focus();
  }

  return (
    <FieldContext.Provider
      value={{
        inputId,
        disabled: Boolean(disabled),
        invalid: Boolean(invalid),
        name,
        describedBy: aria['aria-describedby'],
        labelledBy: aria['aria-labelledby'],
        ariaLabel: aria['aria-label'],
        inputRef,
      }}
    >
      <div
        className={[styles.shell, className].filter(Boolean).join(' ')}
        style={style}
        data-disabled={disabled ? '' : undefined}
        data-invalid={invalid ? '' : undefined}
        onMouseDown={onMouseDown}
      >
        {slots.iconStart}
        {slots.prefix}
        <div className={styles.body}>{slots.rest}</div>
        {slots.suffix}
        {slots.iconEnd}
      </div>
    </FieldContext.Provider>
  );
}

export { styles as fieldStyles };
