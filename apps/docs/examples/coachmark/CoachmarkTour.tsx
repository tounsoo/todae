'use client';

import { Button, Coachmark, Stack, Text } from '@tounsoo/todae';
import { useRef, useState, type RefObject } from 'react';

type Step = { title: string; text: string; target: RefObject<HTMLButtonElement | null> };

// An example, not a component: the steps, their order and whether the person
// has seen the tour are the product's. Each step is one Coachmark.Root.
export default function CoachmarkTour() {
  const searchRef = useRef<HTMLButtonElement>(null);
  const filterRef = useRef<HTMLButtonElement>(null);
  const shareRef = useRef<HTMLButtonElement>(null);
  const nextRef = useRef<HTMLButtonElement>(null);
  const [at, setAt] = useState<number | null>(null);
  const steps: Step[] = [
    { title: 'Search', text: 'Find any report by its name or owner.', target: searchRef },
    { title: 'Filter', text: 'Narrow the list to one team or quarter.', target: filterRef },
    { title: 'Share', text: 'Send a link to the reports you picked.', target: shareRef },
  ];
  const step = steps[at ?? 0]!;
  const last = at === steps.length - 1;
  return (
    <Stack.Root gap="normal">
      <Stack.Root direction="row" gap="condensed" wrap>
        <Button.Root ref={searchRef} variant="secondary">
          Search
        </Button.Root>
        <Button.Root ref={filterRef} variant="secondary">
          Filter
        </Button.Root>
        <Button.Root ref={shareRef} variant="secondary">
          Share
        </Button.Root>
      </Stack.Root>
      <div>
        <Button.Root onClick={() => setAt(0)}>Start the tour</Button.Root>
      </div>
      <Coachmark.Root
        targetRef={step.target}
        open={at !== null}
        onOpenChange={(open) => {
          if (!open) setAt(null);
        }}
        initialFocusRef={nextRef}
      >
        <Coachmark.Title>{step.title}</Coachmark.Title>
        {/* Focus stays on Next from step to step, so the new text is announced as it changes. */}
        <Coachmark.Description aria-live="polite">{step.text}</Coachmark.Description>
        <Coachmark.Footer align="center">
          <Text.Root as="span" tone="muted">
            {(at ?? 0) + 1} of {steps.length}
          </Text.Root>
          {at !== null && at > 0 && (
            <Button.Root
              variant="secondary"
              onClick={() => {
                setAt(at - 1);
                // Back leaves the footer on the first step, so focus stays on Next.
                nextRef.current?.focus();
              }}
            >
              Back
            </Button.Root>
          )}
          <Button.Root ref={nextRef} onClick={() => setAt(last || at === null ? null : at + 1)}>
            {last ? 'Done' : 'Next'}
          </Button.Root>
        </Coachmark.Footer>
      </Coachmark.Root>
    </Stack.Root>
  );
}
