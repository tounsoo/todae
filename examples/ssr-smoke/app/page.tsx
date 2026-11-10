import { Badge } from '@tounsoo/todae/badge'
import { Stack } from '@tounsoo/todae/stack'
import { Text } from '@tounsoo/todae/text'
import { Smoke } from './smoke'

export const dynamic = 'force-dynamic'

// A Server Component renders the server-safe subpath entries directly. The
// main entry's components render inside the client component below.
export default function Page() {
  return (
    <Stack.Root>
      <Text.Root>Server text</Text.Root>
      <Badge.Root>Server badge</Badge.Root>
      <Smoke />
    </Stack.Root>
  )
}
