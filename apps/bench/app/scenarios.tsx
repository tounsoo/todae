/**
 * The cases the benchmark renders. Each one draws `copies` instances of a part
 * (or one whole page) and takes `tick`, which changes the label of every
 * instance, so the update step re-renders all of them.
 *
 * The cases use todae's public API only, so the same file also measures an
 * older build (`--against`). The billing case renders this checkout's docs
 * demo on either build, so it compares todae under today's demo code. A case
 * whose parts that build lacks fails on its own and is reported as failed;
 * the rest still run.
 *
 * `coverage.ts` ties every public component, hook and Field control to its
 * cases, and the cases themselves live in `cases/`, one file per area.
 */
import { Preview } from '../../docs/components/playground/Preview.tsx';
import { COVERAGE } from './coverage.ts';
import { click, range, type Coverage, type Scenario } from './cases/types.tsx';

export type { CaseProps, Scenario } from './cases/types.tsx';

const own = (coverage: Coverage): readonly Scenario[] => (Array.isArray(coverage) ? coverage : []);

const BASELINE: Scenario = {
  id: 'html-button',
  title: 'Plain HTML button (baseline)',
  Case: ({ copies, tick }) => (
    <>
      {range(copies).map((index) => (
        <button key={index} type="button">
          Save {index} {tick}
        </button>
      ))}
    </>
  ),
  interact: click('button'),
};

const BILLING: Scenario = {
  id: 'billing-page',
  title: 'Billing playground page (docs demo)',
  copies: [1],
  // The update switches the page's language, which re-renders all of it.
  Case: ({ tick }) => <Preview locale={tick % 2 === 0 ? 'en' : 'ko'} />,
  interact: click('input[type="checkbox"], [role="switch"]'),
};

export const SCENARIOS: readonly Scenario[] = [BASELINE, ...Object.values(COVERAGE).flatMap(own), BILLING];
