/**
 * The shapes every case file shares: one case, and the coverage entry that
 * ties each public part of todae to the cases that measure it.
 */
import type * as Todae from '@tounsoo/todae';
import type { ReactElement } from 'react';

export type CaseProps = { copies: number; tick: number };

export type Scenario = {
  id: string;
  title: string;
  /** Instance counts to run. Leave it out to run every size the run asks for. */
  copies?: readonly number[];
  Case: (props: CaseProps) => ReactElement;
  /** One user action on the first instance. Its time runs through React's update and a forced layout. */
  interact?: (container: HTMLElement) => void;
};

type Exports = typeof Todae;
type Name = Extract<keyof Exports, string>;

/** Every public hook: an export named `use…`. */
export type Hook = Extract<Name, `use${string}`>;

/**
 * Every public component: a capitalized export that isn't a SCREAMING_CASE
 * constant such as `CATEGORY_TONES` or `SHEET_NARROW_WIDTH`. That counts part
 * namespaces, functions such as `MentionText` and providers, and any future
 * namespace or object component, whatever its shape.
 */
export type Component = {
  [K in Name]: K extends Hook ? never : K extends Capitalize<K> ? (K extends Uppercase<K> ? never : K) : never;
}[Name];

/** Field's members are separate controls, such as `Field.DatePicker`, so each one counts on its own. */
export type FieldPart = `Field.${Extract<keyof Exports['Field'], string>}`;

/** Everything the bench must cover. Adding a public component, hook or Field control adds a part. */
export type Part = Component | Hook | FieldPart;

/**
 * How a part is measured:
 * - its own cases;
 * - `via`, the cases of another part that render it, such as a hook that only
 *   reaches apps through one component;
 * - `skip`, with the reason it can't be measured on its own.
 */
export type Coverage = readonly Scenario[] | { via: Part } | { skip: string };

/** One case file's share of the coverage. Each part sits in exactly one file. */
export type CoverageGroup = Partial<Record<Part, Coverage>>;

/** Sizes for a part a page has one or a few of, such as a dialog or a toast region. */
export const PAGE_SIZES = [1, 10] as const;

export const range = (copies: number) => Array.from({ length: copies }, (_, index) => index);

export function first<T extends Element>(container: HTMLElement, selector: string): T {
  const element = container.querySelector<T>(selector);
  if (!element) throw new Error(`no element matches ${selector}`);
  return element;
}

export const click = (selector: string) => (container: HTMLElement) => first<HTMLElement>(container, selector).click();

export const focus = (selector: string) => (container: HTMLElement) => first<HTMLElement>(container, selector).focus();

export type ItemProps = { index: number; tick: number };

/** Renders `copies` of one item component, each with its index and the tick. */
export const many = (Item: (props: ItemProps) => ReactElement) =>
  function ManyCase({ copies, tick }: CaseProps) {
    return (
      <>
        {range(copies).map((index) => (
          <Item key={index} index={index} tick={tick} />
        ))}
      </>
    );
  };
