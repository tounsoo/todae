'use client';

import { Button } from '@tounsoo/todae';
import { ArrowRight } from 'lucide-react';

/** Links drawn as buttons through render. The one without href looks disabled. */
export default function ButtonLinks() {
  return (
    <>
      <Button.Root render={(props) => <a {...props} href="https://www.npmjs.com/package/@tounsoo/todae" />}>
        Install
        <Button.Icon>
          <ArrowRight />
        </Button.Icon>
      </Button.Root>
      <Button.Root variant="secondary" render={(props) => <a {...props} href="https://github.com/tounsoo/todae" />}>
        Source
      </Button.Root>
      <Button.Root variant="secondary" render={(props) => <a {...props} />}>
        Not yet available
      </Button.Root>
    </>
  );
}
