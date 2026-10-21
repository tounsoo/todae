import { createContext, useContext, useLayoutEffect, type RefObject } from 'react';
import type { FormFieldError, ValidityCarrier } from './validity.js';

/** Errors you found, keyed by a control's `name`, such as a server's reply. */
export type FormErrors = Readonly<Record<string, string>>;

/** The server text an edit has hidden, per control name: an entry shows again as soon as its text is not the hidden one. */
export type Dismissal = ReadonlyMap<string, string>;

/** One control of a scope as the scope last read it. */
export type Reading = {
  carrier: ValidityCarrier;
  name: string;
  /** What the browser says is wrong, in Todae's words; null when the control is valid. */
  native: FormFieldError | null;
  /** The control's name for a person, for Form.Summary. */
  label: string;
  /** The control's id, for the summary's link. */
  id: string;
  /** Whether the control is disabled, itself or through a disabled fieldset. */
  disabled: boolean;
};

/** A scope that shows an error, as Form.Summary lists it. */
export type SummaryEntry = {
  scopeId: string;
  error: FormFieldError;
  /** The control the scope shows, as it read it. */
  reading: Reading;
};

export type FormContextValue = {
  /** Submit attempts since the last reset. */
  attempt: number;
  /** Resets so far: a scope's reveal from an earlier one no longer counts. */
  epoch: number;
  errors: FormErrors | undefined;
  dismissal: Dismissal;
  /** What failed at the last attempt or reply, less what is fixed or gone since: what Form.Summary lists. */
  failed: readonly SummaryEntry[];
  formRef: RefObject<HTMLFormElement | null>;
  /** Form.Summary's element while it renders one. */
  summaryRef: RefObject<HTMLElement | null>;
  /** Reads the page again for `failed`: a scope's readings changed or it left. Call it from an effect or an event, never in render. */
  refresh: () => void;
  /** A person edited the controls with these names with no change event, as a pick in a picker does: ends the wait for a reply and hides the entries of `errors` under those names. */
  edited: (names: readonly string[]) => void;
};

export const FormContext = /* @__PURE__ */ createContext<FormContextValue | null>(null);

/** What a Field.Group or Fieldset.Root inside a Form.Root gives its controls and its ErrorMessage. */
export type ValidationScopeValue = {
  /** The id ErrorMessage.Root takes in auto mode. */
  id: string;
  /** What the scope shows now. */
  error: FormFieldError | null;
  /** Re-reads the scope's controls after this commit, once however often it is called. */
  revalidate: () => void;
  /** A person edited a control of the scope with no change event: it counts as touched, as a change event inside it does. */
  touch: () => void;
  /** An auto ErrorMessage.Root mounted in the scope; returns its cleanup. */
  registerMessage: () => () => void;
};

export const ValidationScopeContext = /* @__PURE__ */ createContext<ValidationScopeValue | null>(null);

/** Re-reads the nearest scope's controls after every commit of the caller: a value set with no event still changes validity. */
export function useRevalidate(): void {
  const scope = useContext(ValidationScopeContext);
  const revalidate = scope?.revalidate;
  useLayoutEffect(() => revalidate?.());
}
