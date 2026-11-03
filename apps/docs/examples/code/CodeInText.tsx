'use client';

import { Code } from '@tounsoo/todae/code';
import { CodeBlock } from '@tounsoo/todae/code-block';
import { Stack } from '@tounsoo/todae/stack';
import { Text } from '@tounsoo/todae/text';

export default function CodeInText() {
  return (
    <Stack.Root gap="condensed">
      <Text.Root>
        Call <Code.Root>getPlan()</Code.Root> before you render the billing page.
      </Text.Root>
      <CodeBlock.Root tabIndex={0} role="region" aria-label="Example code">
        <code>{`const plan = await getPlan();\nrender(<Billing plan={plan} />);`}</code>
      </CodeBlock.Root>
    </Stack.Root>
  );
}
