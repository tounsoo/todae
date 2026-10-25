'use client'

import { Button, Dialog, Text } from '@tounsoo/todae'

export function Smoke() {
  return (
    <main>
      <Text.Root>SSR text</Text.Root>
      <Button.Root>SSR button</Button.Root>
      <Dialog.Root>
        <Dialog.Title>SSR dialog</Dialog.Title>
      </Dialog.Root>
    </main>
  )
}
