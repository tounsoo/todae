import { useContext, useEffect, useLayoutEffect, type ComponentPropsWithRef, type ReactNode } from 'react';
import { cx } from './cx.js';
import { ValidationScopeContext } from './Form.context.js';
import type { FormFieldError } from './validity.js';
import styles from './ErrorMessage.module.css';

/**
 * Validation text below a control. With an `id` it renders as given, and you
 * wire `aria-describedby` yourself. Without one, inside a Field.Group or
 * Fieldset.Root in a Form.Root, it shows the scope's error while there is one
 * and wires the controls' `aria-describedby` to itself.
 */
export type ErrorMessageRootProps = (
  | {
      /** Required outside a validation scope. Inside one, leave it out to take the scope's error. */
      id: string;
      children?: ReactNode;
    }
  | {
      id?: undefined;
      /** Text. In a validation scope, a function of the scope's error, and without children, the error's message. */
      children?: ReactNode | ((error: FormFieldError) => ReactNode);
    }
) & {
  className?: string;
} & Omit<ComponentPropsWithRef<'span'>, 'id' | 'children'>;

function Root({ id, className, children, ...props }: ErrorMessageRootProps) {
  const scope = useContext(ValidationScopeContext);
  const auto = id === undefined;
  const register = auto ? scope?.registerMessage : undefined;
  // The scope wires the controls to this message's id only while one is mounted, so it never dangles.
  useLayoutEffect(() => register?.(), [register]);
  const misuse =
    process.env.NODE_ENV === 'production'
      ? undefined
      : auto && !scope
        ? 'ErrorMessage.Root without an id must render inside a Field.Group or Fieldset.Root in a Form.Root'
        : !auto && typeof children === 'function'
          ? 'ErrorMessage.Root takes a function child only without an id, inside a validation scope'
          : undefined;
  useEffect(() => {
    if (misuse) console.error(misuse);
  }, [misuse]);
  if (auto && scope) {
    if (!scope.error) return null;
    return (
      <span {...props} id={scope.id} data-todae-error="" className={cx(styles.error, className)}>
        {typeof children === 'function' ? children(scope.error) : (children ?? scope.error.message)}
      </span>
    );
  }
  if (typeof children === 'function') return null;
  return (
    <span {...props} id={id} data-todae-error="" className={cx(styles.error, className)}>
      {children}
    </span>
  );
}

export const ErrorMessage = { Root } as const;
