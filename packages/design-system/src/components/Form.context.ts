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
};

/** A scope that shows an error, as Form.Summary lists it. */
export type SummaryEntry = { scopeId: string; error: FormFieldError; label: string; carrier: ValidityCarrier };

export type FormContextValue = {
  /** Submit attempts since the last reset. */
  attempt: number;
  /** Resets so far: a scope's reveal from an earlier one no longer counts. */
  epoch: number;
  errors: FormErrors | undefined;
  dismissal: Dismissal;
  /** The ids of the scopes that were failing at the last attempt or reply; Form.Summary lists those that still are. */
  failed: readonly string[];
  /** Changes whenever Form.Summary has to read the page again. */
  version: number;
  formRef: RefObject<HTMLFormElement | null>;
  /** Form.Summary's element while it renders one. */
  summaryRef: RefObject<HTMLElement | null>;
  /** A scope's shown error changed or the scope left: the summary may list something else now. */
  bump: () => void;
  /** Every scope reads its controls again, for a change the page made with no event. */
  rescan: () => void;
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
