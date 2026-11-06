/**
 * Which cases measure each public part of todae. The `satisfies` below fails
 * the typecheck, so `pnpm check`, when a new public component, hook or Field
 * control has no entry, and `coverage.test.tsx` checks the same against the
 * built package.
 */
import { BASICS } from './cases/basics.tsx';
import { CONTROLS } from './cases/controls.tsx';
import { FORMS } from './cases/forms.tsx';
import { HOOKS } from './cases/hooks.tsx';
import { OVERLAYS } from './cases/overlays.tsx';
import { STRUCTURE } from './cases/structure.tsx';
import type { Coverage, CoverageGroup, Part } from './cases/types.tsx';

export const GROUPS = { BASICS, FORMS, CONTROLS, OVERLAYS, STRUCTURE, HOOKS } satisfies Record<string, CoverageGroup>;

export const COVERAGE = { ...BASICS, ...FORMS, ...CONTROLS, ...OVERLAYS, ...STRUCTURE, ...HOOKS } satisfies Record<Part, Coverage>;
